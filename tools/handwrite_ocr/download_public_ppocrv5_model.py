from __future__ import annotations

import argparse
import hashlib
import json
import urllib.request
from pathlib import Path


MODEL_ID = "monkt/paddleocr-onnx"
BASE_URL = f"https://huggingface.co/{MODEL_ID}/resolve/main"
FILES = {
    "rec.onnx": "languages/chinese/rec.onnx",
    "dict.txt": "languages/chinese/dict.txt",
    "config.json": "languages/chinese/config.json",
    "UPSTREAM_README.md": "README.md",
}
APACHE_LICENSE_URL = "https://raw.githubusercontent.com/PaddlePaddle/PaddleOCR/main/LICENSE"


def parse_args() -> argparse.Namespace:
    project_root = Path(__file__).resolve().parents[2]
    parser = argparse.ArgumentParser(
        description="Download an Apache-2.0 public ONNX OCR model for Japanese/Chinese handwriting-capable recognition."
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=project_root / "build" / "ocr" / "public-ppocrv5-chinese-japanese",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    output_dir = args.output_dir.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    checksums: dict[str, str] = {}
    for name, relative_path in FILES.items():
        target = output_dir / name
        download_file(f"{BASE_URL}/{relative_path}?download=true", target)
        checksums[name] = sha256_file(target)

    license_target = output_dir / "LICENSE-APACHE-2.0.txt"
    download_file(APACHE_LICENSE_URL, license_target)
    checksums[license_target.name] = sha256_file(license_target)

    metadata = {
        "model_id": MODEL_ID,
        "source_url": f"https://huggingface.co/{MODEL_ID}",
        "language_group": "Chinese/Japanese",
        "license": "Apache-2.0",
        "intended_use": "Short handwritten or printed Japanese text recognition on web clients.",
        "notes": [
            "Upstream README states this language group covers Chinese and Japanese.",
            "PaddleOCR PP-OCRv5 model cards state Japanese, handwriting, vertical text, and rare-character support.",
            "This download is a pre-converted ONNX model from monkt/paddleocr-onnx.",
        ],
        "files": checksums,
    }
    (output_dir / "MODEL_INFO.json").write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    summary = {
        name: (output_dir / name).stat().st_size for name in list(FILES.keys()) + ["LICENSE-APACHE-2.0.txt", "MODEL_INFO.json"]
    }
    print(json.dumps({"output_dir": str(output_dir), "sizes": summary}, ensure_ascii=False, indent=2))
    return 0


def download_file(url: str, destination: Path) -> None:
    print(f"Downloading {url} -> {destination}")
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "KanjiSearch/1.0 (+https://github.com/)",
        },
    )
    with urllib.request.urlopen(request, timeout=120) as response, destination.open("wb") as output:
        while True:
            chunk = response.read(1024 * 1024)
            if not chunk:
                break
            output.write(chunk)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


if __name__ == "__main__":
    raise SystemExit(main())
