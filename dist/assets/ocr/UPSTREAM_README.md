---
license: apache-2.0
language:
- en
- fr
- de
- es
- it
- pt
- nl
- pl
- cs
- sk
- hr
- bs
- sr
- sl
- da
- "no"
- sv
- is
- et
- lt
- hu
- sq
- cy
- ga
- tr
- id
- ms
- af
- sw
- tl
- uz
- la
- ru
- bg
- uk
- be
- ko
- zh
- ja
- th
- el
- hi
- mr
- ne
- sa
- ar
- ur
- fa
- ta
- te
tags:
- ocr
- optical-character-recognition
- text-detection
- text-recognition
- paddleocr
- onnx
- computer-vision
- document-ai
library_name: onnx
pipeline_tag: image-to-text
---

# PP-OCR ONNX Models

Multilingual OCR models from PaddleOCR, converted to ONNX format for production deployment.

**Use as a complete pipeline**: Integrate with [monkt.com](https://monkt.com) for end-to-end document processing.

**Source**: [PaddlePaddle PP-OCRv5 Collection](https://huggingface.co/collections/PaddlePaddle/pp-ocrv5-684a5356aef5b4b1d7b85e4b)  
**Format**: ONNX (optimized for inference)  
**License**: Apache 2.0

---

## Overview

**16 models** covering **48+ languages**:
- 11 PP-OCRv5 models (latest, highest accuracy)
- 5 PP-OCRv3 models (legacy, additional language support)

---

## Quick Start

### Download from HuggingFace

```bash
pip install huggingface_hub rapidocr-onnxruntime
```

<details>
<summary><b>Download specific language models</b></summary>

```python
from huggingface_hub import hf_hub_download

# Download English models
det_path = hf_hub_download("monkt/paddleocr-onnx", "detection/v5/det.onnx")
rec_path = hf_hub_download("monkt/paddleocr-onnx", "languages/english/rec.onnx")
dict_path = hf_hub_download("monkt/paddleocr-onnx", "languages/english/dict.txt")

# Use with RapidOCR
from rapidocr_onnxruntime import RapidOCR
ocr = RapidOCR(det_model_path=det_path, rec_model_path=rec_path, rec_keys_path=dict_path)
result, elapsed = ocr("document.jpg")
```

</details>

<details>
<summary><b>Download entire language folder</b></summary>

```python
from huggingface_hub import snapshot_download

# Download all French/German/Spanish (Latin) models
snapshot_download("monkt/paddleocr-onnx", allow_patterns=["detection/v5/*", "languages/latin/*"])

# Download Arabic models (v3)
snapshot_download("monkt/paddleocr-onnx", allow_patterns=["detection/v3/*", "languages/arabic/*"])
```

</details>

<details>
<summary><b>Clone entire repository</b></summary>

```bash
git clone https://huggingface.co/monkt/paddleocr-onnx
cd paddleocr-onnx
```

</details>

### Basic Usage

```python
from rapidocr_onnxruntime import RapidOCR

ocr = RapidOCR(
    det_model_path="detection/v5/det.onnx",
    rec_model_path="languages/english/rec.onnx",
    rec_keys_path="languages/english/dict.txt"
)

result, elapsed = ocr("document.jpg")
for line in result:
    print(line[1][0])  # Extracted text
```

---

## Available Models

### PP-OCRv5 Recognition Models

| Language Group | Path | Languages | Accuracy | Size |
|----------------|------|-----------|----------|------|
| English | `languages/english/` | English | 85.25% | 7.5 MB |
| Latin | `languages/latin/` | French, German, Spanish, Italian, Portuguese, + 27 more | 84.7% | 7.5 MB |
| East Slavic | `languages/eslav/` | Russian, Bulgarian, Ukrainian, Belarusian | 81.6% | 7.5 MB |
| Korean | `languages/korean/` | Korean | 88.0% | 13 MB |
| Chinese/Japanese | `languages/chinese/` | Chinese, Japanese | - | 81 MB |
| Thai | `languages/thai/` | Thai | 82.68% | 7.5 MB |
| Greek | `languages/greek/` | Greek | 89.28% | 7.4 MB |

### PP-OCRv3 Recognition Models (Legacy)

| Language Group | Path | Languages | Version | Size |
|----------------|------|-----------|---------|------|
| Devanagari | `languages/hindi/` | Hindi, Marathi, Nepali, Sanskrit | v3 | 8.6 MB |
| Arabic | `languages/arabic/` | Arabic, Urdu, Persian/Farsi | v3 | 8.6 MB |
| Tamil | `languages/tamil/` | Tamil | v3 | 8.6 MB |
| Telugu | `languages/telugu/` | Telugu | v3 | 8.6 MB |

### Detection Models

| Model | Path | Version | Size |
|-------|------|---------|------|
| PP-OCRv5 Detection | `detection/v5/det.onnx` | v5 | 84 MB |
| PP-OCRv3 Detection | `detection/v3/det.onnx` | v3 | 2.3 MB |

**Note**: Use v5 detection with v5 recognition models. Use v3 detection with v3 recognition models.

### Preprocessing Models (Optional)

| Model | Path | Purpose | Accuracy | Size |
|-------|------|---------|----------|------|
| Document Orientation | `preprocessing/doc-orientation/` | Corrects rotated documents (0°, 90°, 180°, 270°) | 99.06% | 6.5 MB |
| Text Line Orientation | `preprocessing/textline-orientation/` | Corrects upside-down text (0°, 180°) | 98.85% | 6.5 MB |
| Document Unwarping | `preprocessing/doc-unwarping/` | Fixes curved/warped documents | - | 30 MB |

---

## Language Support

### PP-OCRv5 Languages (40+)

**Latin Script** (32 languages): English, French, German, Spanish, Italian, Portuguese, Dutch, Polish, Czech, Slovak, Croatian, Bosnian, Serbian, Slovenian, Danish, Norwegian, Swedish, Icelandic, Estonian, Lithuanian, Hungarian, Albanian, Welsh, Irish, Turkish, Indonesian, Malay, Afrikaans, Swahili, Tagalog, Uzbek, Latin

**Cyrillic**: Russian, Bulgarian, Ukrainian, Belarusian

**East Asian**: Chinese (Simplified, Traditional), Japanese (Hiragana, Katakana, Kanji), Korean

**Southeast Asian**: Thai

**Other**: Greek

### PP-OCRv3 Languages (8)

**South Asian**: Hindi, Marathi, Nepali, Sanskrit, Tamil, Telugu

**Middle Eastern**: Arabic, Urdu, Persian/Farsi

---

## Usage Examples

<details>
<summary><b>PP-OCRv5 Models (English, Latin, East Asian, etc.)</b></summary>

```python
from rapidocr_onnxruntime import RapidOCR

# English
ocr = RapidOCR(
    det_model_path="detection/v5/det.onnx",
    rec_model_path="languages/english/rec.onnx",
    rec_keys_path="languages/english/dict.txt"
)

# French, German, Spanish, etc. (32 languages)
ocr = RapidOCR(
    det_model_path="detection/v5/det.onnx",
    rec_model_path="languages/latin/rec.onnx",
    rec_keys_path="languages/latin/dict.txt"
)

# Russian, Bulgarian, Ukrainian, Belarusian
ocr = RapidOCR(
    det_model_path="detection/v5/det.onnx",
    rec_model_path="languages/eslav/rec.onnx",
    rec_keys_path="languages/eslav/dict.txt"
)

# Korean
ocr = RapidOCR(
    det_model_path="detection/v5/det.onnx",
    rec_model_path="languages/korean/rec.onnx",
    rec_keys_path="languages/korean/dict.txt"
)

# Chinese/Japanese
ocr = RapidOCR(
    det_model_path="detection/v5/det.onnx",
    rec_model_path="languages/chinese/rec.onnx",
    rec_keys_path="languages/chinese/dict.txt"
)

# Thai
ocr = RapidOCR(
    det_model_path="detection/v5/det.onnx",
    rec_model_path="languages/thai/rec.onnx",
    rec_keys_path="languages/thai/dict.txt"
)

# Greek
ocr = RapidOCR(
    det_model_path="detection/v5/det.onnx",
    rec_model_path="languages/greek/rec.onnx",
    rec_keys_path="languages/greek/dict.txt"
)
```

</details>

<details>
<summary><b>PP-OCRv3 Models (Hindi, Arabic, Tamil, Telugu)</b></summary>

```python
from rapidocr_onnxruntime import RapidOCR

# Hindi, Marathi, Nepali, Sanskrit
ocr = RapidOCR(
    det_model_path="detection/v3/det.onnx",
    rec_model_path="languages/hindi/rec.onnx",
    rec_keys_path="languages/hindi/dict.txt"
)

# Arabic, Urdu, Persian/Farsi
ocr = RapidOCR(
    det_model_path="detection/v3/det.onnx",
    rec_model_path="languages/arabic/rec.onnx",
    rec_keys_path="languages/arabic/dict.txt"
)

# Tamil
ocr = RapidOCR(
    det_model_path="detection/v3/det.onnx",
    rec_model_path="languages/tamil/rec.onnx",
    rec_keys_path="languages/tamil/dict.txt"
)

# Telugu
ocr = RapidOCR(
    det_model_path="detection/v3/det.onnx",
    rec_model_path="languages/telugu/rec.onnx",
    rec_keys_path="languages/telugu/dict.txt"
)
```

</details>

---

## Full Pipeline with Preprocessing

<details>
<summary><b>Optional preprocessing for rotated/distorted documents</b></summary>

Preprocessing models improve accuracy on rotated or distorted documents:

```python
from rapidocr_onnxruntime import RapidOCR

# Complete pipeline with preprocessing
ocr = RapidOCR(
    det_model_path="detection/v5/det.onnx",
    rec_model_path="languages/english/rec.onnx",
    rec_keys_path="languages/english/dict.txt",
    # Optional preprocessing
    use_angle_cls=True,
    angle_cls_model_path="preprocessing/textline-orientation/PP-LCNet_x1_0_textline_ori.onnx"
)

result, elapsed = ocr("rotated_document.jpg")
```

**When to use preprocessing**:
- **Document Orientation** (`doc-orientation/`): Scanned documents with unknown rotation (0°/90°/180°/270°)
- **Text Line Orientation** (`textline-orientation/`): Upside-down text lines (0°/180°)
- **Document Unwarping** (`doc-unwarping/`): Curved pages, warped documents, camera photos

**Performance impact**: +10-30% accuracy on distorted images, minimal speed overhead.

</details>

---

## Repository Structure

```
.
├── detection/
│   ├── v5/
│   │   ├── det.onnx             # 84 MB - PP-OCRv5 detection
│   │   └── config.json
│   └── v3/
│       ├── det.onnx             # 2.3 MB - PP-OCRv3 detection
│       └── config.json
│
├── languages/
│   ├── english/
│   │   ├── rec.onnx             # 7.5 MB
│   │   ├── dict.txt
│   │   └── config.json
│   ├── latin/                   # 32 languages
│   ├── eslav/                   # Russian, Bulgarian, Ukrainian, Belarusian
│   ├── korean/
│   ├── chinese/                 # Chinese, Japanese
│   ├── thai/
│   ├── greek/
│   ├── hindi/                   # Hindi, Marathi, Nepali, Sanskrit (v3)
│   ├── arabic/                  # Arabic, Urdu, Persian (v3)
│   ├── tamil/                   # Tamil (v3)
│   └── telugu/                  # Telugu (v3)
│
└── preprocessing/
    ├── doc-orientation/
    ├── textline-orientation/
    └── doc-unwarping/
```

---

## Model Selection

| Document Language | Model Path |
|-------------------|------------|
| English | `languages/english/` |
| French, German, Spanish, Italian, Portuguese | `languages/latin/` |
| Russian, Bulgarian, Ukrainian, Belarusian | `languages/eslav/` |
| Korean | `languages/korean/` |
| Chinese, Japanese | `languages/chinese/` |
| Thai | `languages/thai/` |
| Greek | `languages/greek/` |
| Hindi, Marathi, Nepali, Sanskrit | `languages/hindi/` + `detection/v3/` |
| Arabic, Urdu, Persian/Farsi | `languages/arabic/` + `detection/v3/` |
| Tamil | `languages/tamil/` + `detection/v3/` |
| Telugu | `languages/telugu/` + `detection/v3/` |

---

## Technical Specifications

- **Framework**: PaddleOCR → ONNX
- **ONNX Opset**: 11
- **Precision**: FP32
- **Input Format**: RGB images (dynamic size)
- **Inference**: CPU/GPU via onnxruntime

### Detection Model
- **Input**: `(batch, 3, height, width)` - dynamic
- **Output**: Text bounding boxes

### Recognition Model
- **Input**: `(batch, 3, 32, width)` - height fixed at 32px
- **Output**: CTC logits → decoded with dictionary

---

## Performance

### Accuracy (PP-OCRv5)

| Model | Accuracy | Dataset |
|-------|----------|---------|
| Greek | 89.28% | 2,799 images |
| Korean | 88.0% | 5,007 images |
| English | 85.25% | 6,530 images |
| Latin | 84.7% | 3,111 images |
| Thai | 82.68% | 4,261 images |
| East Slavic | 81.6% | 7,031 images |

---

## FAQ

**Q: Which version should I use?**  
A: Use PP-OCRv5 models for best accuracy. Use PP-OCRv3 only for South Asian languages not available in v5.

**Q: Can I mix v5 and v3 models?**  
A: No. Use `detection/v5/det.onnx` with v5 recognition models, and `detection/v3/det.onnx` with v3 recognition models.

**Q: GPU acceleration?**  
A: Install `onnxruntime-gpu` instead of `onnxruntime` for 10x faster inference.

**Q: Commercial use?**  
A: Yes. Apache 2.0 license allows commercial use.

---

## Credits

- **Original Models**: [PaddlePaddle Team](https://github.com/PaddlePaddle/PaddleOCR)
- **Conversion**: [paddle2onnx](https://github.com/PaddlePaddle/Paddle2ONNX)
- **Source**: [PP-OCRv5 Collection](https://huggingface.co/collections/PaddlePaddle/pp-ocrv5-684a5356aef5b4b1d7b85e4b)

---

## Links

- [PaddleOCR GitHub](https://github.com/PaddlePaddle/PaddleOCR)
- [PaddleOCR Documentation](https://paddlepaddle.github.io/PaddleOCR/)
- [ONNX Runtime](https://onnxruntime.ai/)
- [monkt.com](https://monkt.com) - Document processing pipeline

---

**License**: Apache 2.0