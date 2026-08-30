import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import pytest
from src.utils.asset_scanner import extract_references_from_file


def test_extract_references_from_json(tmp_path: Path):
    json_file = tmp_path / "config.json"
    json_file.write_text('{"icon": "assets/logo.png", "doc": "data.json"}', encoding="utf-8")

    refs = extract_references_from_file(json_file)
    assert "logo.png" in refs
    assert "data.json" in refs


def test_extract_references_from_markdown(tmp_path: Path):
    md_file = tmp_path / "README.md"
    md_file.write_text(
        'Check out ![Diagram](docs/diagram.svg) and relative link [Guide](manual.pdf). Also "inline/image.jpg".',
        encoding="utf-8"
    )

    refs = extract_references_from_file(md_file)
    assert "diagram.svg" in refs
    assert "manual.pdf" in refs
    assert "image.jpg" in refs
