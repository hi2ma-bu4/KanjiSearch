# Public OCR model notes

- Source model: `ilaylow/PP_OCRv5_mobile_onnx`
- Recognition file: `rec.onnx`
- Language group: Chinese/Japanese
- License: Apache-2.0

## Why this model

- Lightweight ONNX variant suitable for live preview in the browser
- Based on PaddleOCR PP-OCRv5 mobile recognition weights
- Covers Japanese together with Chinese, kana, handwriting, and rare characters

## Important limitations

- This is still a line-recognition model, not a document parser.
- The app keeps using client-side line splitting before inference.
- The dictionary is shared with the PP-OCRv5 server Japanese/Chinese model.
