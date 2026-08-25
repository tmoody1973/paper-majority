#!/usr/bin/env python3
"""Generate a review sheet from the Civic Illustration Kit manifest."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MANIFEST = ROOT / "manifest.json"
OUTPUT = ROOT / "kit-sheet.svg"


def inner_svg(path: Path) -> tuple[str, float, float]:
    content = path.read_text(encoding="utf-8")
    match = re.search(r'<svg[^>]*width="([\d.]+)"[^>]*height="([\d.]+)"', content)
    if not match:
        raise ValueError(f"Missing SVG dimensions: {path}")
    width, height = float(match.group(1)), float(match.group(2))
    inner = re.sub(r'^.*?<svg[^>]*>', '', content, flags=re.S)
    inner = re.sub(r'</svg>\s*$', '', inner, flags=re.S)
    inner = re.sub(r'<title>.*?</title>', '', inner, flags=re.S)
    return inner, width, height


def esc(value: str) -> str:
    return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def main() -> None:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    assets = manifest["assets"]
    categories = ["families", "provenance", "resources", "statuses", "institutions", "issues"]
    cols = 6
    cell_w = 180
    cell_h = 170
    margin = 60
    sheet_w = margin * 2 + cols * cell_w

    grouped = {category: [a for a in assets if a["category"] == category] for category in categories}
    section_heights = {}
    for category, items in grouped.items():
        rows = (len(items) + cols - 1) // cols
        section_heights[category] = 74 + rows * cell_h
    sheet_h = 130 + sum(section_heights.values()) + 50

    parts = [
        '<?xml version="1.0" encoding="utf-8"?>',
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{sheet_w}" height="{sheet_h}" viewBox="0 0 {sheet_w} {sheet_h}">',
        f'<rect width="{sheet_w}" height="{sheet_h}" fill="#F2EEE6"/>',
        '<text x="60" y="60" font-family="Arial" font-size="32" font-weight="700" fill="#182C38">Paper Majority Civic Illustration Kit</text>',
        '<text x="60" y="92" font-family="Arial" font-size="16" fill="#58636B">Reusable, localization-safe SVG grammar. Labels on this sheet are review-only and are not runtime assets.</text>',
        f'<line x1="60" y1="112" x2="{sheet_w - 60}" y2="112" stroke="#CDB995" stroke-width="2"/>',
    ]
    y = 138
    for category in categories:
        items = grouped[category]
        parts.append(f'<text x="60" y="{y + 24}" font-family="Arial" font-size="21" font-weight="700" fill="#182C38">{esc(category.title())}</text>')
        y += 54
        for index, asset in enumerate(items):
            col, row = index % cols, index // cols
            x = margin + col * cell_w
            cy = y + row * cell_h
            inner, width, height = inner_svg(ROOT / asset["path"])
            target = 108 if category != "issues" else 118
            scale = min(target / width, target / height)
            tx = x + (cell_w - width * scale) / 2
            ty = cy + 4
            parts.append(f'<g transform="translate({tx:.2f},{ty:.2f}) scale({scale:.4f})">{inner}</g>')
            label = asset["assetId"].split("-", 1)[-1].replace("-", " ").title()
            parts.append(f'<text x="{x + cell_w / 2}" y="{cy + 133}" text-anchor="middle" font-family="Arial" font-size="13" font-weight="700" fill="#35444C">{esc(label)}</text>')
            parts.append(f'<text x="{x + cell_w / 2}" y="{cy + 151}" text-anchor="middle" font-family="Arial" font-size="10" fill="#667278">{esc(asset["assetId"])}</text>')
        rows = (len(items) + cols - 1) // cols
        y += rows * cell_h + 20
    parts.append("</svg>")
    OUTPUT.write_text("\n".join(parts) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT.relative_to(ROOT)} with {len(assets)} assets")


if __name__ == "__main__":
    main()
