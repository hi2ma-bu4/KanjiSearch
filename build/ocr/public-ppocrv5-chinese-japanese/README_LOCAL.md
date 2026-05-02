# Public OCR model notes

- Source model: `monkt/paddleocr-onnx`
- Recognition file: `rec.onnx`
- Language group: Chinese/Japanese
- License: Apache-2.0

## Why this model

- Publicly downloadable ONNX
- Apache-2.0 license with commercial use allowed
- Upstream notes say the Chinese/Japanese group supports Japanese
- PaddleOCR PP-OCRv5 materials mention handwriting, vertical text, and rare-character support

## Important limitations

- This is a CTC recognition model for a single text line, not a newline-aware sequence model.
- If the app accepts multiple handwritten lines, the web side should split the canvas into lines and run recognition per line.
- The dictionary is broader than roughly JIS level 1-3. It includes wider Chinese/Japanese coverage.

## Included files

- `rec.onnx`
- `dict.txt`
- `config.json`
- `UPSTREAM_README.md`
- `LICENSE-APACHE-2.0.txt`
- `MODEL_INFO.json`
