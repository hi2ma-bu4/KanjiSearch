import { normalizeForDisplay, normalizeForSearch } from "../lib/textNormalization";
import type { JapaneseLookupAsset, LookupAnalysis, LookupKanjiEntry, LookupMixedSegment } from "./types";

function isHiragana(character: string): boolean {
	return /[\p{Script=Hiragana}ーゝゞ]/u.test(character);
}

function isKatakana(character: string): boolean {
	return /[\p{Script=Katakana}ーヽヾ]/u.test(character);
}

function isKana(character: string): boolean {
	return isHiragana(character) || isKatakana(character);
}

function isKanji(character: string): boolean {
	return /[\p{Script=Han}々〆〇ヶヵ]/u.test(character);
}

function isSupportedCharacter(character: string): boolean {
	return isKana(character) || isKanji(character);
}

function unique(values: string[]): string[] {
	return [...new Set(values)];
}

function lookupKanjiEntries(text: string, asset: JapaneseLookupAsset): LookupKanjiEntry[] {
	const entries: LookupKanjiEntry[] = [];
	for (const character of [...text]) {
		if (!isKanji(character)) {
			continue;
		}

		const readings = asset.kanji[character];
		entries.push({
			kanji: character,
			on: readings?.on ?? [],
			kun: readings?.kun ?? [],
			hasEntry: Boolean(readings),
		});
	}
	return entries;
}

function createKanaSegment(text: string): LookupMixedSegment {
	return {
		kind: "kana",
		text,
		readings: [],
		entries: [],
		note: "かな部分として扱いました。",
	};
}

function createUnsupportedSegment(text: string): LookupMixedSegment {
	return {
		kind: "unsupported",
		text,
		readings: [],
		entries: [],
		note: "記号や判別不能な文字として扱いました。",
	};
}

function createWordSegment(text: string, asset: JapaneseLookupAsset): LookupMixedSegment {
	return {
		kind: "word",
		text,
		readings: asset.wordToReadings[text] ?? [],
		entries: lookupKanjiEntries(text, asset),
		note: undefined,
	};
}

function createKanjiSegment(text: string, asset: JapaneseLookupAsset): LookupMixedSegment {
	return {
		kind: "kanji",
		text,
		readings: [],
		entries: lookupKanjiEntries(text, asset),
		note: undefined,
	};
}

function segmentMixedText(text: string, asset: JapaneseLookupAsset): LookupMixedSegment[] {
	const characters = [...text];
	const segments: LookupMixedSegment[] = [];

	let index = 0;
	while (index < characters.length) {
		const current = characters[index];
		if (isKanji(current)) {
			let value = current;
			index += 1;

			while (index < characters.length && isKanji(characters[index])) {
				value += characters[index];
				index += 1;
			}

			let consumedKana = false;
			while (index < characters.length && isKana(characters[index])) {
				value += characters[index];
				index += 1;
				consumedKana = true;
			}

			segments.push(consumedKana ? createWordSegment(value, asset) : createKanjiSegment(value, asset));
			continue;
		}

		if (isKana(current)) {
			let value = current;
			index += 1;
			while (index < characters.length && isKana(characters[index])) {
				value += characters[index];
				index += 1;
			}
			segments.push(createKanaSegment(value));
			continue;
		}

		let value = current;
		index += 1;
		while (index < characters.length && !isSupportedCharacter(characters[index])) {
			value += characters[index];
			index += 1;
		}
		segments.push(createUnsupportedSegment(value));
	}

	return segments;
}

export function analyzeRecognizedText(text: string, asset: JapaneseLookupAsset): LookupAnalysis {
	const normalizedText = normalizeForDisplay(text.replace(/\s+/gu, ""));
	if (!normalizedText) {
		return {
			kind: "unsupported",
			text: normalizedText,
			unsupportedText: "",
			note: "辞書補助に使える文字が見つかりませんでした。",
		};
	}

	const characters = [...normalizedText];
	const unsupportedCharacters = characters.filter((character) => !isSupportedCharacter(character));
	const allHiragana = characters.every((character) => isHiragana(character));
	const allKatakana = characters.every((character) => isKatakana(character));
	const allKanji = characters.every((character) => isKanji(character));

	if (allHiragana || allKatakana) {
		const normalizedReading = normalizeForSearch(normalizedText);
		return {
			kind: "reading",
			text: normalizedText,
			normalizedReading,
			words: asset.readingToWords[normalizedReading] ?? [],
			note: allKatakana ? "片仮名は読みとして扱い、ひらがなに直して検索しました。" : undefined,
		};
	}

	if (allKanji) {
		return {
			kind: "kanji",
			text: normalizedText,
			entries: lookupKanjiEntries(normalizedText, asset),
		};
	}

	const segments = segmentMixedText(normalizedText, asset);
	const supportedSegmentCount = segments.filter((segment) => segment.kind !== "unsupported").length;
	if (supportedSegmentCount === 0) {
		return {
			kind: "unsupported",
			text: normalizedText,
			unsupportedText: unique(unsupportedCharacters).join(" "),
			note: "記号のみだったため、辞書補助は表示できません。",
		};
	}

	return {
		kind: "mixed",
		text: normalizedText,
		segments,
		note: unsupportedCharacters.length > 0 ? `混在していたため分割して扱いました。記号などは対象外です: ${unique(unsupportedCharacters).join(" ")}` : "混在していたため、送り仮名として扱うか分割して表示しています。",
	};
}
