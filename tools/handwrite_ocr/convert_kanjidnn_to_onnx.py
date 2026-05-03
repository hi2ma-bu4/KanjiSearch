from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path

import onnx
import tensorflow as tf
import tf2onnx


def parse_args() -> argparse.Namespace:
    project_root = Path(__file__).resolve().parents[2]
    parser = argparse.ArgumentParser(
        description="Convert the local KanjiDNN Keras handwriting classifier into an ONNX model for browser use."
    )
    parser.add_argument(
        "--model-path",
        type=Path,
        default=project_root / ".cache" / "KanjiDNN_v2.keras",
    )
    parser.add_argument(
        "--label-config",
        type=Path,
        default=project_root / ".cache" / "kanjidnn-config.json",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=project_root / "build" / "ocr" / "kanjidnn-ja-handwritten",
    )
    parser.add_argument(
        "--opset",
        type=int,
        default=17,
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    model_path = args.model_path.resolve()
    label_config_path = args.label_config.resolve()
    output_dir = args.output_dir.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"Loading Keras model: {model_path}")
    model = tf.keras.models.load_model(model_path, compile=False)
    input_tensor = model.inputs[0]
    input_name = input_tensor.name.split(":", maxsplit=1)[0]
    input_shape = [dimension if isinstance(dimension, int) and dimension > 0 else 1 for dimension in input_tensor.shape]
    input_signature = [tf.TensorSpec(input_shape, tf.float32, name=input_name)]

    onnx_path = output_dir / "model.onnx"
    print(f"Converting to ONNX: {onnx_path}")
    tf2onnx.convert.from_keras(
        model,
        input_signature=input_signature,
        opset=args.opset,
        output_path=onnx_path,
    )

    labels = load_labels(label_config_path)
    labels_path = output_dir / "labels.txt"
    labels_path.write_text("\n".join(labels) + "\n", encoding="utf-8")

    metadata = {
        "source_model": str(model_path),
        "source_labels": str(label_config_path),
        "source_repository": "https://huggingface.co/gaiseras/kanjiDNN",
        "license": "Apache-2.0",
        "input_name": input_name,
        "input_shape": input_shape,
        "class_count": len(labels),
        "opset": args.opset,
        "intended_use": "Short handwritten Japanese character recognition for browser inference.",
    }
    (output_dir / "MODEL_INFO.json").write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    maybe_copy_local_license(model_path.parent, output_dir)
    validate_onnx(onnx_path)

    summary = {
        "output_dir": str(output_dir),
        "model_size": onnx_path.stat().st_size,
        "label_count": len(labels),
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


def load_labels(config_path: Path) -> list[str]:
    config = json.loads(config_path.read_text(encoding="utf-8"))
    id2label = config["id2label"]
    ordered_items = sorted(((int(index), label) for index, label in id2label.items()), key=lambda item: item[0])
    return [label for _, label in ordered_items]


def maybe_copy_local_license(cache_dir: Path, output_dir: Path) -> None:
    for candidate in ("LICENSE", "LICENSE.txt", "LICENSE-APACHE-2.0.txt"):
        source = cache_dir / candidate
        if source.exists():
            shutil.copy2(source, output_dir / source.name)
            return


def validate_onnx(onnx_path: Path) -> None:
    model = onnx.load(onnx_path)
    onnx.checker.check_model(model)


if __name__ == "__main__":
    raise SystemExit(main())
