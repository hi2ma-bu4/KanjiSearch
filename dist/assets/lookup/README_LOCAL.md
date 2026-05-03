This directory stores the preprocessed lookup asset used by the app.

Source dictionaries:
- http://ftp.edrdg.org/pub/Nihongo/edict2.gz
- http://ftp.edrdg.org/pub/Nihongo/kanjidic2.xml.gz

The generated `japanese-lookup.json` is intentionally reduced for this app:
- hiragana reading lookup keeps short readings and short kanji words
- mixed-word lookup keeps kanji words that include okurigana
- kanji lookup keeps `ja_on` and `ja_kun`

Regenerate with:
- `node tools/build_japanese_lookup.mjs`
