"""
src/utils/asset_scanner.py - Extended reference discovery scanner for asset audits.
"""
import json
import re
from pathlib import Path
from typing import Set


def extract_references_from_file(file_path: Path) -> Set[str]:
    """
    Parses a single file path string, identifying asset filename references
    within structural JSON parameters and Markdown hyperlink or image syntax tokens.
    """
    discovered_refs: Set[str] = set()
    if not file_path.is_file():
        return discovered_refs

    try:
        content = file_path.read_text(encoding="utf-8", errors="ignore")

        # 1. Parse JSON configuration files to harvest metadata asset string patterns
        if file_path.suffix.lower() == ".json":
            try:
                data = json.loads(content)
                # Recursively parse values inside JSON objects
                def walk_json(node):
                    if isinstance(node, str):
                        # Extract basic filename patterns
                        if any(ext in node.lower() for ext in [".png", ".svg", ".jpg", ".pdf", ".json"]):
                            discovered_refs.add(Path(node).name)
                    elif isinstance(node, dict):
                        for val in node.values():
                            walk_json(val)
                    elif isinstance(node, list):
                        for item in node:
                            walk_json(item)

                walk_json(data)
            except json.JSONDecodeError:
                pass  # Gracefully pass structural exceptions

        # 2. Parse Markdown elements to capture links, imagery tokens, and literal paths
        elif file_path.suffix.lower() == ".md":
            # Match standard Markdown links/images syntax: ![Alt text](path/to/asset.png)
            markdown_pattern = re.compile(r"\[.*?\]\((.*?\.(?:png|svg|jpg|jpeg|pdf|json|md))\)")
            for match in markdown_pattern.finditer(content):
                asset_path = match.group(1)
                discovered_refs.add(Path(asset_path).name)

            # Match raw inline literal filepath lookups
            raw_path_pattern = re.compile(r"[\s\"']([\w\-_/.]+\.(?:png|svg|jpg|jpeg|pdf|json|md))[\s\"']")
            for match in raw_path_pattern.finditer(content):
                asset_path = match.group(1)
                discovered_refs.add(Path(asset_path).name)

    except Exception as e:
        print(f"Error reading file {file_path}: {e}")

    return discovered_refs
