#!/usr/bin/env python3
"""Validate taxonomy, localization safety, checksums, and SVG hygiene."""

from __future__ import annotations

import hashlib
import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MANIFEST_PATH = ROOT / "manifest.json"
EXPECTED_COUNTS = {
    "families": 8,
    "provenance": 3,
    "resources": 6,
    "statuses": 6,
    "institutions": 6,
    "issues": 12,
}
FORBIDDEN = ["<text", "font-family", "<script", "<foreignObject"]


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    failures: list[str] = []
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    assets = manifest.get("assets", [])
    ids = [item.get("assetId") for item in assets]
    paths = [item.get("path") for item in assets]
    for value, count in Counter(ids).items():
        if count > 1:
            failures.append(f"duplicate assetId: {value}")
    for value, count in Counter(paths).items():
        if count > 1:
            failures.append(f"duplicate path: {value}")
    counts = Counter(item.get("category") for item in assets)
    for category, expected in EXPECTED_COUNTS.items():
        if counts[category] != expected:
            failures.append(f"{category}: expected {expected}, found {counts[category]}")
    for item in assets:
        rel = Path(item["path"])
        path = (ROOT / rel).resolve()
        if ROOT.resolve() not in path.parents:
            failures.append(f"path escapes kit root: {rel}")
            continue
        if not path.is_file():
            failures.append(f"missing file: {rel}")
            continue
        if digest(path) != item.get("checksumSha256"):
            failures.append(f"checksum mismatch: {rel}")
        source = path.read_text(encoding="utf-8")
        for token in FORBIDDEN:
            if token.lower() in source.lower():
                failures.append(f"forbidden runtime SVG token {token!r}: {rel}")
        if re.search(r'(?:href|xlink:href)=["\']https?://', source, flags=re.I):
            failures.append(f"external SVG dependency: {rel}")
        if not re.search(r'<svg[^>]+viewBox="0 0 [\d.]+ [\d.]+"', source):
            failures.append(f"missing normalized viewBox: {rel}")
        if item.get("containsSemanticText") is not False:
            failures.append(f"containsSemanticText must be false: {rel}")
        if item.get("localizationSafe") is not True:
            failures.append(f"localizationSafe must be true: {rel}")
        if not str(item.get("altText", "")).strip():
            failures.append(f"missing altText: {rel}")
    taxonomy = manifest.get("taxonomy", {})
    if taxonomy.get("families") != ["staff", "policy", "evidence", "coalition", "constituency", "institution", "political", "tactic"]:
        failures.append("family taxonomy does not match approved order")
    if taxonomy.get("provenance") != ["official", "derived", "simulated"]:
        failures.append("provenance taxonomy must contain only official, derived, simulated")
    if failures:
        print("Civic Illustration Kit validation failed:")
        for failure in failures:
            print(f"- {failure}")
        return 1
    print(f"Civic Illustration Kit valid: {len(assets)} assets across {len(EXPECTED_COUNTS)} categories")
    return 0


if __name__ == "__main__":
    sys.exit(main())
