const HALF_WIDTH_MAP: Record<string, string> = {
	ｱ: "ア",
	ｲ: "イ",
	ｳ: "ウ",
	ｴ: "エ",
	ｵ: "オ",
	ｶ: "カ",
	ｷ: "キ",
	ｸ: "ク",
	ｹ: "ケ",
	ｺ: "コ",
	ｻ: "サ",
	ｼ: "シ",
	ｽ: "ス",
	ｾ: "セ",
	ｿ: "ソ",
	ﾀ: "タ",
	ﾁ: "チ",
	ﾂ: "ツ",
	ﾃ: "テ",
	ﾄ: "ト",
	ﾅ: "ナ",
	ﾆ: "ニ",
	ﾇ: "ヌ",
	ﾈ: "ネ",
	ﾉ: "ノ",
	ﾊ: "ハ",
	ﾋ: "ヒ",
	ﾌ: "フ",
	ﾍ: "ヘ",
	ﾎ: "ホ",
	ﾏ: "マ",
	ﾐ: "ミ",
	ﾑ: "ム",
	ﾒ: "メ",
	ﾓ: "モ",
	ﾔ: "ヤ",
	ﾕ: "ユ",
	ﾖ: "ヨ",
	ﾗ: "ラ",
	ﾘ: "リ",
	ﾙ: "ル",
	ﾚ: "レ",
	ﾛ: "ロ",
	ﾜ: "ワ",
	ｦ: "ヲ",
	ﾝ: "ン",
	ｧ: "ァ",
	ｨ: "ィ",
	ｩ: "ゥ",
	ｪ: "ェ",
	ｫ: "ォ",
	ｬ: "ャ",
	ｭ: "ュ",
	ｮ: "ョ",
	ｯ: "ッ",
	ﾞ: "゛",
	ﾟ: "゜",
	ｰ: "ー",
};

const DAKUTEN_MAP: Record<string, string> = {
	"カ゛": "ガ",
	"キ゛": "ギ",
	"ク゛": "グ",
	"ケ゛": "ゲ",
	"コ゛": "ゴ",
	"サ゛": "ザ",
	"シ゛": "ジ",
	"ス゛": "ズ",
	"セ゛": "ゼ",
	"ソ゛": "ゾ",
	"タ゛": "ダ",
	"チ゛": "ヂ",
	"ツ゛": "ヅ",
	"テ゛": "デ",
	"ト゛": "ド",
	"ハ゛": "バ",
	"ヒ゛": "ビ",
	"フ゛": "ブ",
	"ヘ゛": "ベ",
	"ホ゛": "ボ",
	"ハ゜": "パ",
	"ヒ゜": "ピ",
	"フ゜": "プ",
	"ヘ゜": "ペ",
	"ホ゜": "ポ",
	"ウ゛": "ヴ",
	"ワ゛": "ヷ",
	"ヰ゛": "ヸ",
	"ヱ゛": "ヹ",
	"ヲ゛": "ヺ",
};

const SMALL_TO_LARGE_MAP: Record<string, string> = {
	ぁ: "あ",
	ぃ: "い",
	ぅ: "う",
	ぇ: "え",
	ぉ: "お",
	ゕ: "か",
	ゖ: "け",
	"\u{1B132}": "こ",
	っ: "つ",
	ゃ: "や",
	ゅ: "ゆ",
	ょ: "よ",
	ゎ: "わ",
	"\u{1B150}": "ゐ",
	"\u{1B151}": "ゑ",
	"\u{1B152}": "を",
	ァ: "ア",
	ィ: "イ",
	ゥ: "ウ",
	ェ: "エ",
	ォ: "オ",
	ヵ: "カ",
	ㇰ: "ク",
	ヶ: "ケ",
	"\u{1B155}": "コ",
	ㇱ: "シ",
	ㇲ: "ス",
	ッ: "ツ",
	ㇳ: "ト",
	ㇴ: "ヌ",
	ㇵ: "ハ",
	ㇶ: "ヒ",
	ㇷ: "フ",
	ㇷ゚: "プ",
	ㇸ: "ヘ",
	ㇹ: "ホ",
	ㇺ: "ム",
	ャ: "ヤ",
	ュ: "ユ",
	ョ: "ヨ",
	ㇻ: "ラ",
	ㇼ: "リ",
	ㇽ: "ル",
	ㇾ: "レ",
	ㇿ: "ロ",
	ヮ: "ワ",
	"\u{1B164}": "ヰ",
	"\u{1B165}": "ヱ",
	"\u{1B166}": "ヲ",
	"\u{1B167}": "ン",
};

const HISTORICAL_MAP: Record<string, string> = {
	ゐ: "い",
	ゑ: "え",
	ヰ: "イ",
	ヱ: "エ",
};

export function toFullWidthKatakana(text: string): string {
	let result = "";
	for (let i = 0; i < text.length; i++) {
		const char = text[i];
		const full = HALF_WIDTH_MAP[char] || char;
		result += full;
	}

	// Handle dakuten and handakuten
	let combined = "";
	for (let i = 0; i < result.length; i++) {
		const char = result[i];
		const next = result[i + 1];
		if (next === "゛" || next === "゜") {
			const pair = char + next;
			if (DAKUTEN_MAP[pair]) {
				combined += DAKUTEN_MAP[pair];
				i++;
				continue;
			}
		}
		combined += char;
	}
	return combined;
}

export function normalizeForDisplay(text: string): string {
	let normalized = toFullWidthKatakana(text);

	return [...normalized]
		.map((char) => {
			let c = char;
			c = SMALL_TO_LARGE_MAP[c] || c;
			c = HISTORICAL_MAP[c] || c;
			return c;
		})
		.join("");
}

export function normalizeForSearch(text: string): string {
	let normalized = normalizeForDisplay(text);

	// Convert Katakana to Hiragana
	normalized = [...normalized]
		.map((char) => {
			const code = char.charCodeAt(0);
			if (code >= 0x30a1 && code <= 0x30f6) {
				return String.fromCharCode(code - 0x60);
			}
			return char;
		})
		.join("");

	// Specific search mergers
	const searchMap: Record<string, string> = {
		ぢ: "じ",
		づ: "ず",
		ヶ: "け",
		ヵ: "か",
	};

	return [...normalized].map((char) => searchMap[char] || char).join("");
}
