import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const outputDir = path.join(projectRoot, "build", "lookup");
const outputFile = path.join(outputDir, "japanese-lookup.json");

const EDICT2_URL = "http://ftp.edrdg.org/pub/Nihongo/edict2.gz";
const KANJIDIC2_URL = "http://ftp.edrdg.org/pub/Nihongo/kanjidic2.xml.gz";

const MAX_READING_LENGTH = 8;
const MAX_READING_WORD_LENGTH = 4;
const MAX_MIXED_SURFACE_LENGTH = 8;
const MAX_READING_CANDIDATES = 100;
const MAX_WORD_READINGS = 100;

function countCharacters(text) {
	return [...text].length;
}

function hasKanji(text) {
	return /\p{Script=Han}/u.test(text);
}

function hasKana(text) {
	return /[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text);
}

function isKana(text) {
	return /^[\p{Script=Hiragana}\p{Script=Katakana}ーゝゞヽヾ]+$/u.test(text);
}

function toHiragana(text) {
	return [...text]
		.map((character) => {
			const codePoint = character.codePointAt(0);
			if (codePoint && codePoint >= 0x30a1 && codePoint <= 0x30f6) {
				return String.fromCodePoint(codePoint - 0x60);
			}
			return character;
		})
		.join("");
}

function unique(values) {
	return [...new Set(values)];
}

function normalizeReadings(readingField) {
	return unique(
		readingField
			.split(";")
			.map((value) => toHiragana(value.trim()))
			.filter((value) => value && isKana(value)),
	);
}

function normalizeSurfaces(surfaceField) {
	return unique(
		surfaceField
			.split(";")
			.map((value) => value.trim())
			.filter((value) => value && hasKanji(value)),
	);
}

function sortWords(left, right) {
	return right.priority - left.priority || left.word.length - right.word.length || left.word.localeCompare(right.word, "ja");
}

function sortReadings(left, right) {
	return right.priority - left.priority || left.reading.localeCompare(right.reading, "ja");
}

async function fetchGzipText(url, encoding) {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to download ${url}: ${response.status}`);
	}

	const compressed = new Uint8Array(await response.arrayBuffer());
	return new TextDecoder(encoding).decode(gunzipSync(compressed));
}

function buildEdictIndexes(edictText) {
	const readingToWords = new Map();
	const wordToReadings = new Map();

	for (const rawLine of edictText.split(/\r?\n/u)) {
		const line = rawLine.trim();
		if (!line || line.startsWith("　") || !line.includes("/")) {
			continue;
		}

		const head = line.slice(0, line.indexOf("/")).trim();
		const readingMatch = head.match(/\[([^\]]+)\]/u);
		if (!readingMatch) {
			continue;
		}

		const readings = normalizeReadings(readingMatch[1]);
		const surfaces = normalizeSurfaces(head.slice(0, readingMatch.index).trim());
		if (readings.length === 0 || surfaces.length === 0) {
			continue;
		}

		const priority = /\(P\)/u.test(line) ? 1 : 0;
		const shortReadings = readings.filter((reading) => countCharacters(reading) <= MAX_READING_LENGTH);
		const shortSurfaces = surfaces.filter((surface) => countCharacters(surface) <= MAX_READING_WORD_LENGTH);

		for (const reading of shortReadings) {
			const bucket = readingToWords.get(reading) ?? [];
			for (const surface of shortSurfaces) {
				if (!bucket.some((entry) => entry.word === surface)) {
					bucket.push({ word: surface, priority });
				}
			}
			if (bucket.length > 0) {
				readingToWords.set(reading, bucket);
			}
		}

		const mixedSurfaces = surfaces.filter((surface) => hasKana(surface) && countCharacters(surface) <= MAX_MIXED_SURFACE_LENGTH);
		for (const surface of mixedSurfaces) {
			const bucket = wordToReadings.get(surface) ?? [];
			for (const reading of readings) {
				if (!bucket.some((entry) => entry.reading === reading)) {
					bucket.push({ reading, priority });
				}
			}
			wordToReadings.set(surface, bucket);
		}
	}

	return {
		readingToWords: Object.fromEntries(
			[...readingToWords].map(([reading, entries]) => [
				reading,
				entries
					.sort(sortWords)
					.slice(0, MAX_READING_CANDIDATES)
					.map((entry) => entry.word),
			]),
		),
		wordToReadings: Object.fromEntries(
			[...wordToReadings].map(([word, entries]) => [
				word,
				entries
					.sort(sortReadings)
					.slice(0, MAX_WORD_READINGS)
					.map((entry) => entry.reading),
			]),
		),
	};
}

function buildKanjiIndex(kanjidicXml) {
	const kanji = {};

	for (const match of kanjidicXml.matchAll(/<character>([\s\S]*?)<\/character>/gu)) {
		const body = match[1];
		const literal = body.match(/<literal>(.*?)<\/literal>/u)?.[1];
		if (!literal) {
			continue;
		}

		const on = unique([...body.matchAll(/<reading r_type="ja_on">(.*?)<\/reading>/gu)].map((entry) => entry[1]));
		const kun = unique([...body.matchAll(/<reading r_type="ja_kun">(.*?)<\/reading>/gu)].map((entry) => entry[1]));
		if (on.length === 0 && kun.length === 0) {
			continue;
		}

		kanji[literal] = { on, kun };
	}

	return kanji;
}

async function main() {
	console.log("Downloading EDICT2...");
	const edictText = await fetchGzipText(EDICT2_URL, "euc-jp");

	console.log("Downloading KANJIDIC2...");
	const kanjidicXml = await fetchGzipText(KANJIDIC2_URL, "utf-8");

	console.log("Building lookup indexes...");
	const edictIndexes = buildEdictIndexes(edictText);
	const kanji = buildKanjiIndex(kanjidicXml);

	const asset = {
		metadata: {
			generatedAt: new Date().toISOString(),
			sources: [EDICT2_URL, KANJIDIC2_URL],
		},
		readingToWords: edictIndexes.readingToWords,
		wordToReadings: edictIndexes.wordToReadings,
		kanji,
	};

	await mkdir(outputDir, { recursive: true });
	await writeFile(outputFile, JSON.stringify(asset));

	console.log(`Wrote ${outputFile}`);
	console.log(
		JSON.stringify(
			{
				readingCount: Object.keys(asset.readingToWords).length,
				wordCount: Object.keys(asset.wordToReadings).length,
				kanjiCount: Object.keys(asset.kanji).length,
			},
			null,
			2,
		),
	);
}

await main();
