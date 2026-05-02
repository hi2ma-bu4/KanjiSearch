# Handwritten OCR ONNX generator

This directory contains a project-local helper for preparing a lightweight PARSeq setup for handwritten Japanese OCR and exporting a web-friendly ONNX model.

The script is based on the PARSeq notes in [_memo/ndlocr-lite/train/README.md](/C:/Users/snows/Documents/Program/js/KanjiSearch/_memo/ndlocr-lite/train/README.md) and trims the character set toward hiragana, katakana, kanji, and `\n` so the recognition head stays smaller than the full NDL config.

## What it does

- Prepares a PARSeq checkout under `.env/parseq`
- Applies the same ONNX export patch mentioned in the memo (`dtype=torch.bool` -> `dtype=torch.float`)
- Generates a charset config and a training config for roughly 1-10 handwritten characters
- Exports an ONNX model plus a small web config YAML when a checkpoint is provided

## Default model profile

- Input shape: `1 x 3 x 32 x 224`
- Max label length: `12`
- Character set: hiragana, katakana, CJK ideographs, Japanese iteration/prolonged-sound marks, newline

The defaults are meant for short canvas input. They are not enough by themselves; the checkpoint must be trained with the generated config or an equivalent config.

## PowerShell setup example

If `python` is not on `PATH`, replace `$PythonExe` with your installed `python.exe` path.

```powershell
$PythonExe = 'C:\Path\To\python.exe'
& $PythonExe -m venv .env\handwrite-ocr
& .\.env\handwrite-ocr\Scripts\python.exe -m pip install --upgrade pip
```

Clone and install PARSeq into the same environment:

```powershell
& .\.env\handwrite-ocr\Scripts\python.exe tools\handwrite_ocr\generate_parseq_handwrite_onnx.py --download-parseq
Push-Location .env\parseq
& ..\handwrite-ocr\Scripts\python.exe -m pip install -r requirements\core.cpu.txt -e .[train,test]
& ..\handwrite-ocr\Scripts\python.exe -m pip install pyyaml onnx
Pop-Location
```

## Prepare configs only

```powershell
& .\.env\handwrite-ocr\Scripts\python.exe tools\handwrite_ocr\generate_parseq_handwrite_onnx.py
```

This writes:

- `.env\parseq\configs\charset\kanjisearch_handwrite_ja10.yaml`
- `.env\parseq\configs\main_kanjisearch_handwrite10.yaml`
- `build\ocr\kanjisearch-handwrite-10\handwrite_ocr_config.yaml`

## Export ONNX from a trained checkpoint

```powershell
& .\.env\handwrite-ocr\Scripts\python.exe tools\handwrite_ocr\generate_parseq_handwrite_onnx.py `
  --checkpoint .env\parseq\outputs\kanjisearch-handwrite-10\2026-05-02_00-00-00\checkpoints\last.ckpt
```

This additionally writes:

- `build\ocr\kanjisearch-handwrite-10\kanjisearch-handwrite-10.onnx`

## Notes

- The script expects `PyYAML` in the active environment.
- ONNX export uses CPU and fixed input shape for easier `onnxruntime-web` use.
- If you want to keep the full source charset instead of the reduced Japanese-focused one, pass `--keep-source-charset`.
