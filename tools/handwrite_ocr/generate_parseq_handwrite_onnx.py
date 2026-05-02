from __future__ import annotations

import argparse
import importlib
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import yaml


DEFAULT_PARSEQ_URL = "https://github.com/baudm/parseq.git"
DEFAULT_INPUT_HEIGHT = 32
DEFAULT_INPUT_WIDTH = 224
DEFAULT_MAX_CHARS = 10
DEFAULT_MAX_LABEL_LENGTH = 12
DEFAULT_MODEL_NAME = "kanjisearch-handwrite-10"
DEFAULT_CHARSET_NAME = "kanjisearch_handwrite_ja10"
DEFAULT_TRAIN_CONFIG_NAME = "main_kanjisearch_handwrite10"

EXTRA_JAPANESE_MARKS = (
    "\n",
    "々",
    "〆",
    "〇",
    "〻",
    "ゝ",
    "ゞ",
    "ゟ",
    "ヽ",
    "ヾ",
    "゛",
    "゜",
    "ー",
    "・",
)

JAPANESE_RANGES = (
    (0x3040, 0x309F),   # Hiragana
    (0x30A0, 0x30FF),   # Katakana
    (0x31F0, 0x31FF),   # Katakana phonetic extensions
    (0x3400, 0x4DBF),   # CJK Extension A
    (0x4E00, 0x9FFF),   # CJK Unified Ideographs
    (0xF900, 0xFAFF),   # CJK Compatibility Ideographs
    (0x20000, 0x2A6DF), # CJK Extension B
    (0x2A700, 0x2B73F), # CJK Extension C
    (0x2B740, 0x2B81F), # CJK Extension D
    (0x2B820, 0x2CEAF), # CJK Extension E/F
    (0x2CEB0, 0x2EBEF), # CJK Extension G/I
    (0x30000, 0x3134F), # CJK Extension G/H
)


def parse_args() -> argparse.Namespace:
    project_root = Path(__file__).resolve().parents[2]
    default_parseq_root = project_root / ".env" / "parseq"
    default_output_dir = project_root / "build" / "ocr" / DEFAULT_MODEL_NAME
    default_charset_source = project_root / "_memo" / "ndlocrlite-web" / "public" / "config" / "NDLmoji.yaml"

    parser = argparse.ArgumentParser(
        description=(
            "Prepare a PARSeq workspace for handwritten Japanese OCR and export "
            "a web-friendly ONNX model from a checkpoint."
        )
    )
    parser.add_argument("--parseq-root", type=Path, default=default_parseq_root)
    parser.add_argument("--output-dir", type=Path, default=default_output_dir)
    parser.add_argument("--charset-source", type=Path, default=default_charset_source)
    parser.add_argument("--checkpoint", type=Path, help="PARSeq checkpoint (*.ckpt) to export.")
    parser.add_argument(
        "--download-parseq",
        action="store_true",
        help="Clone the official PARSeq repository into --parseq-root when it is missing.",
    )
    parser.add_argument(
        "--parseq-ref",
        default="main",
        help="Git ref passed to clone --branch when --download-parseq is used.",
    )
    parser.add_argument("--parseq-url", default=DEFAULT_PARSEQ_URL)
    parser.add_argument("--input-height", type=int, default=DEFAULT_INPUT_HEIGHT)
    parser.add_argument("--input-width", type=int, default=DEFAULT_INPUT_WIDTH)
    parser.add_argument("--max-chars", type=int, default=DEFAULT_MAX_CHARS)
    parser.add_argument("--max-label-length", type=int, default=DEFAULT_MAX_LABEL_LENGTH)
    parser.add_argument("--charset-name", default=DEFAULT_CHARSET_NAME)
    parser.add_argument("--train-config-name", default=DEFAULT_TRAIN_CONFIG_NAME)
    parser.add_argument("--model-name", default=DEFAULT_MODEL_NAME)
    parser.add_argument("--onnx-name", default=f"{DEFAULT_MODEL_NAME}.onnx")
    parser.add_argument("--opset", type=int, default=17)
    parser.add_argument(
        "--keep-source-charset",
        action="store_true",
        help="Keep every character from the source YAML instead of filtering to Japanese handwriting chars.",
    )
    parser.add_argument(
        "--skip-parseq-patch",
        action="store_true",
        help="Do not patch PARSeq's attention mask dtype before export.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.max_label_length < args.max_chars + 1:
        raise ValueError(
            "--max-label-length must be at least max_chars + 1 "
            f"(received max_chars={args.max_chars}, max_label_length={args.max_label_length})"
        )

    parseq_root = args.parseq_root.resolve()
    output_dir = args.output_dir.resolve()
    charset_source = args.charset_source.resolve()

    ensure_parseq_checkout(
        parseq_root=parseq_root,
        download=args.download_parseq,
        repo_url=args.parseq_url,
        git_ref=args.parseq_ref,
    )

    if not args.skip_parseq_patch:
        patch_parseq_attention_mask(parseq_root)

    base_charset = load_charset_from_yaml(charset_source)
    charset = build_charset(
        base_charset,
        keep_source_charset=args.keep_source_charset,
    )

    charset_config_path = write_charset_config(
        parseq_root=parseq_root,
        charset_name=args.charset_name,
        charset=charset,
    )
    train_config_path = write_train_config(
        parseq_root=parseq_root,
        train_config_name=args.train_config_name,
        charset_name=args.charset_name,
        model_name=args.model_name,
        input_height=args.input_height,
        input_width=args.input_width,
        max_label_length=args.max_label_length,
    )

    output_dir.mkdir(parents=True, exist_ok=True)

    export_summary: dict[str, Any] = {
        "status": "prepared",
        "charset_size": len(charset),
        "charset_config": str(charset_config_path),
        "train_config": str(train_config_path),
    }

    if args.checkpoint:
        export_summary = export_checkpoint(
            parseq_root=parseq_root,
            checkpoint=args.checkpoint.resolve(),
            output_dir=output_dir,
            onnx_name=args.onnx_name,
            charset=charset,
            requested_height=args.input_height,
            requested_width=args.input_width,
            requested_max_label_length=args.max_label_length,
            opset=args.opset,
        )
    else:
        write_web_config(
            output_dir=output_dir,
            model_name=args.model_name,
            charset=charset,
            input_shape=[1, 3, args.input_height, args.input_width],
            max_length=args.max_label_length,
            checkpoint=None,
        )

    print_summary(
        {
            "parseq_root": str(parseq_root),
            "output_dir": str(output_dir),
            "charset_config": str(charset_config_path),
            "train_config": str(train_config_path),
            **export_summary,
        }
    )
    return 0


def ensure_parseq_checkout(parseq_root: Path, download: bool, repo_url: str, git_ref: str) -> None:
    if (parseq_root / "strhub").is_dir():
        return

    if not download:
        raise FileNotFoundError(
            f"PARSeq workspace not found: {parseq_root}\n"
            "Re-run with --download-parseq or point --parseq-root to an existing checkout."
        )

    parseq_root.parent.mkdir(parents=True, exist_ok=True)
    run_command(
        [
            "git",
            "clone",
            "--depth",
            "1",
            "--branch",
            git_ref,
            repo_url,
            str(parseq_root),
        ]
    )


def patch_parseq_attention_mask(parseq_root: Path) -> None:
    model_path = parseq_root / "strhub" / "models" / "parseq" / "model.py"
    if not model_path.is_file():
        raise FileNotFoundError(f"PARSeq model file not found: {model_path}")

    source = model_path.read_text(encoding="utf-8")
    old = "dtype=torch.bool"
    new = "dtype=torch.float"

    if new in source:
        return
    if old not in source:
        raise RuntimeError(
            "Could not find the expected attention mask dtype in PARSeq model.py. "
            "Review the upstream file before exporting to ONNX."
        )

    model_path.write_text(source.replace(old, new, 1), encoding="utf-8")


def load_charset_from_yaml(charset_source: Path) -> str:
    if not charset_source.is_file():
        raise FileNotFoundError(f"Charset source YAML not found: {charset_source}")

    with charset_source.open("r", encoding="utf-8") as handle:
        payload = yaml.safe_load(handle)

    model_config = payload.get("model", {}) if isinstance(payload, dict) else {}
    charset = model_config.get("charset_train") or model_config.get("charset_test")
    if not isinstance(charset, str) or not charset:
        raise ValueError(f"Could not read model.charset_train or model.charset_test from {charset_source}")
    return charset


def build_charset(base_charset: str, keep_source_charset: bool) -> str:
    if keep_source_charset:
        filtered = list(base_charset)
    else:
        filtered = [char for char in base_charset if is_japanese_handwrite_char(char)]

    for mark in EXTRA_JAPANESE_MARKS:
        if mark not in filtered:
            filtered.append(mark)

    return unique_preserve_order(filtered)


def is_japanese_handwrite_char(char: str) -> bool:
    if char in EXTRA_JAPANESE_MARKS:
        return True

    codepoint = ord(char)
    for start, end in JAPANESE_RANGES:
        if start <= codepoint <= end:
            return True
    return False


def unique_preserve_order(characters: list[str]) -> str:
    seen: set[str] = set()
    ordered: list[str] = []
    for char in characters:
        if char in seen:
            continue
        seen.add(char)
        ordered.append(char)
    return "".join(ordered)


def write_charset_config(parseq_root: Path, charset_name: str, charset: str) -> Path:
    destination = parseq_root / "configs" / "charset" / f"{charset_name}.yaml"
    destination.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "model": {
            "charset_train": charset,
            "charset_test": charset,
        }
    }
    header = "# @package _global_\n"
    destination.write_text(header + yaml.safe_dump(payload, allow_unicode=True, sort_keys=False), encoding="utf-8")
    return destination


def write_train_config(
    parseq_root: Path,
    train_config_name: str,
    charset_name: str,
    model_name: str,
    input_height: int,
    input_width: int,
    max_label_length: int,
) -> Path:
    destination = parseq_root / "configs" / f"{train_config_name}.yaml"
    destination.parent.mkdir(parents=True, exist_ok=True)

    payload = {
        "defaults": [
            "_self_",
            {"model": "parseq-tiny"},
            {"charset": charset_name},
            {"dataset": "real"},
        ],
        "model": {
            "_convert_": "all",
            "name": model_name,
            "img_size": [input_height, input_width],
            "max_label_length": max_label_length,
            "batch_size": 192,
            "weight_decay": 0.01,
            "warmup_pct": 0.02,
        },
        "data": {
            "_target_": "strhub.data.module.SceneTextDataModule",
            "root_dir": "data",
            "train_dir": "train",
            "batch_size": "${model.batch_size}",
            "img_size": "${model.img_size}",
            "charset_train": "${model.charset_train}",
            "charset_test": "${model.charset_train}",
            "max_label_length": "${model.max_label_length}",
            "remove_whitespace": False,
            "normalize_unicode": False,
            "augment": True,
            "num_workers": 4,
        },
        "trainer": {
            "_target_": "pytorch_lightning.Trainer",
            "_convert_": "all",
            "val_check_interval": 2000,
            "max_epochs": 150,
            "gradient_clip_val": 20,
            "accelerator": "auto",
            "devices": 1,
        },
        "ckpt_path": None,
        "pretrained": None,
        "hydra": {
            "output_subdir": "config",
            "run": {
                "dir": "outputs/${model.name}/${now:%Y-%m-%d}_${now:%H-%M-%S}",
            },
            "sweep": {
                "dir": "multirun/${model.name}/${now:%Y-%m-%d}_${now:%H-%M-%S}",
                "subdir": "${hydra.job.override_dirname}",
            },
        },
    }

    destination.write_text(yaml.safe_dump(payload, allow_unicode=True, sort_keys=False), encoding="utf-8")
    return destination


def export_checkpoint(
    parseq_root: Path,
    checkpoint: Path,
    output_dir: Path,
    onnx_name: str,
    charset: str,
    requested_height: int,
    requested_width: int,
    requested_max_label_length: int,
    opset: int,
) -> dict[str, Any]:
    if not checkpoint.is_file():
        raise FileNotFoundError(f"Checkpoint not found: {checkpoint}")

    if str(parseq_root) not in sys.path:
        sys.path.insert(0, str(parseq_root))
        importlib.invalidate_caches()

    import torch
    from strhub.models.utils import load_from_checkpoint

    model = load_from_checkpoint(str(checkpoint), charset_test=charset).eval().to("cpu")
    if hasattr(model, "refine_iters"):
        model.refine_iters = 1
    if hasattr(model, "decode_ar"):
        model.decode_ar = True

    hparams = getattr(model, "hparams", None)
    model_img_size = list(getattr(hparams, "img_size", [])) if hparams is not None else []
    if model_img_size and model_img_size != [requested_height, requested_width]:
        raise ValueError(
            "Checkpoint img_size does not match requested export size. "
            f"checkpoint={model_img_size}, requested={[requested_height, requested_width]}"
        )

    model_max_label_length = int(getattr(hparams, "max_label_length", requested_max_label_length))
    input_shape = [1, 3, requested_height, requested_width]
    dummy_input = torch.randn(*input_shape, dtype=torch.float32)

    with torch.inference_mode():
        logits = model(dummy_input)

    onnx_path = output_dir / onnx_name
    torch.onnx.export(
        model,
        dummy_input,
        str(onnx_path),
        export_params=True,
        training=torch.onnx.TrainingMode.EVAL,
        input_names=["image"],
        output_names=["logits"],
        opset_version=opset,
        do_constant_folding=True,
        dynamic_axes=None,
    )

    write_web_config(
        output_dir=output_dir,
        model_name=onnx_path.stem,
        charset=charset,
        input_shape=input_shape,
        max_length=model_max_label_length,
        checkpoint=checkpoint,
    )

    return {
        "status": "exported",
        "onnx_path": str(onnx_path),
        "output_shape": list(logits.shape),
        "charset_size": len(charset),
        "max_label_length": model_max_label_length,
    }


def write_web_config(
    output_dir: Path,
    model_name: str,
    charset: str,
    input_shape: list[int],
    max_length: int,
    checkpoint: Path | None,
) -> Path:
    payload = {
        "text_recognition": {
            "input_shape": input_shape,
            "max_length": max_length,
        },
        "model": {
            "name": model_name,
            "charset_train": charset,
            "charset_test": charset,
        },
        "meta": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "checkpoint": str(checkpoint) if checkpoint else None,
            "notes": (
                "Prepared for 1-10 handwritten Japanese characters with newline support. "
                "Train the checkpoint with the generated PARSeq config before export."
            ),
        },
    }

    destination = output_dir / "handwrite_ocr_config.yaml"
    destination.write_text(yaml.safe_dump(payload, allow_unicode=True, sort_keys=False), encoding="utf-8")
    return destination


def run_command(command: list[str]) -> None:
    subprocess.run(command, check=True)


def print_summary(summary: dict[str, Any]) -> None:
    print("Handwrite OCR preparation summary:")
    for key, value in summary.items():
        print(f"  - {key}: {value}")


if __name__ == "__main__":
    raise SystemExit(main())
