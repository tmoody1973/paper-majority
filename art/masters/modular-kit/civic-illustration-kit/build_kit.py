#!/usr/bin/env python3
"""Build the Paper Majority Civic Illustration Kit.

The kit contains reusable SVG primitives. It does not generate completed card
illustrations, lawmaker likenesses, community scenes, or semantic interface
text. All output paths are resolved relative to this file.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SVG_ROOT = ROOT / "svg"
MANIFEST_PATH = ROOT / "manifest.json"

PALETTE = {
    "ink": "#203B49",
    "inkDark": "#182C38",
    "paper": "#F2EEE6",
    "card": "#FBF4DF",
    "official": "#2878A8",
    "derived": "#267783",
    "simulated": "#9A6816",
    "staff": "#6A5485",
    "policy": "#B6503A",
    "evidence": "#267783",
    "coalition": "#9A6816",
    "constituency": "#3D754E",
    "institution": "#254F78",
    "political": "#844263",
    "tactic": "#58636B",
    "mustard": "#EDB24A",
    "creamBlue": "#D8EAF4",
    "creamTeal": "#D6EEEC",
    "creamViolet": "#E8E0F1",
    "creamCoral": "#F6E7DA",
    "creamGreen": "#DFE8CF",
    "creamOchre": "#F0DDC4",
}

INK = PALETTE["ink"]
CARD = PALETTE["card"]


def esc(value: str) -> str:
    return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def document(width: int, height: int, title: str, body: str) -> str:
    return (
        '<?xml version="1.0" encoding="utf-8"?>\n'
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
        f'viewBox="0 0 {width} {height}" role="img">\n'
        f'  <title>{esc(title)}</title>\n{body}\n</svg>\n'
    )


def issue_tile(title: str, tint: str, body: str, badge: str) -> str:
    markup = (
        f'  <rect x="10" y="10" width="220" height="220" rx="28" fill="{tint}"/>\n'
        f'{body}\n'
        f'  <circle cx="184" cy="174" r="22" fill="{PALETTE["mustard"]}" '
        f'stroke="{INK}" stroke-width="3"/>\n{badge}'
    )
    return document(240, 240, title, markup)


def icon_document(title: str, body: str, size: int = 64) -> str:
    return document(size, size, title, body)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


ASSETS: list[dict] = []


def write_asset(
    *,
    asset_id: str,
    category: str,
    filename: str,
    svg: str,
    width: int,
    height: int,
    alt_text: str,
    intended_use: list[str],
    color_role: str | None = None,
    representation_review: str = "not-required",
) -> None:
    output = SVG_ROOT / category / filename
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(svg, encoding="utf-8")
    ASSETS.append(
        {
            "assetId": asset_id,
            "category": category,
            "path": output.relative_to(ROOT).as_posix(),
            "width": width,
            "height": height,
            "altText": alt_text,
            "intendedUse": intended_use,
            "colorRole": color_role,
            "containsSemanticText": False,
            "localizationSafe": True,
            "representationReview": representation_review,
            "usageStatus": "prototype",
            "checksumSha256": sha256(output),
        }
    )


def build_issues() -> None:
    issues = {
        "housing": (
            "Housing and rent",
            PALETTE["creamTeal"],
            f'  <rect x="70" y="120" width="100" height="75" rx="8" fill="#C97B51" stroke="{INK}" stroke-width="4"/>\n'
            f'  <path d="M60 122 120 72 180 122Z" fill="#B55A40" stroke="{INK}" stroke-width="4" stroke-linejoin="round"/>\n'
            f'  <rect x="108" y="155" width="24" height="40" rx="3" fill="{CARD}" stroke="{INK}" stroke-width="3"/>\n'
            f'  <rect x="80" y="136" width="20" height="20" rx="3" fill="{CARD}" stroke="{INK}" stroke-width="3"/>\n'
            f'  <rect x="140" y="136" width="20" height="20" rx="3" fill="{CARD}" stroke="{INK}" stroke-width="3"/>',
            f'  <rect x="174" y="173" width="5" height="10" fill="{INK}"/>\n'
            f'  <rect x="182" y="165" width="5" height="18" fill="{INK}"/>\n'
            f'  <rect x="190" y="158" width="5" height="25" fill="{INK}"/>\n',
            "not-required",
        ),
        "elections": (
            "Elections and voting",
            PALETTE["creamBlue"],
            f'  <path d="M65 120H175L165 195H75Z" fill="{PALETTE["official"]}" stroke="{INK}" stroke-width="4" stroke-linejoin="round"/>\n'
            f'  <rect x="58" y="105" width="124" height="18" rx="6" fill="{INK}"/>\n'
            f'  <rect x="98" y="55" width="56" height="72" rx="6" fill="{CARD}" stroke="{INK}" stroke-width="3.5" transform="rotate(-8 126 91)"/>\n'
            f'  <path d="M110 88 120 98 142 74" fill="none" stroke="{PALETTE["derived"]}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" transform="rotate(-8 126 91)"/>',
            '  <path d="M172 174 180 181 194 163" fill="none" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>\n',
            "not-required",
        ),
        "education": (
            "Education",
            PALETTE["creamViolet"],
            f'  <path d="M60 110 120 100V175L60 185Z" fill="{PALETTE["staff"]}" stroke="{INK}" stroke-width="4" stroke-linejoin="round"/>\n'
            f'  <path d="M180 110 120 100V175L180 185Z" fill="#604D78" stroke="{INK}" stroke-width="4" stroke-linejoin="round"/>\n'
            f'  <path d="M72 124 108 118M72 143 108 137M132 118 168 124M132 137 168 143" fill="none" stroke="{CARD}" stroke-width="4" stroke-linecap="round"/>',
            f'  <path d="m184 160 4 10 11 1-8 7 2 11-9-6-10 6 3-11-8-7 11-1Z" fill="{INK}"/>\n',
            "not-required",
        ),
        "healthcare": (
            "Healthcare",
            PALETTE["creamTeal"],
            f'  <rect x="65" y="90" width="110" height="100" rx="14" fill="{CARD}" stroke="{INK}" stroke-width="4"/>\n'
            f'  <rect x="108" y="112" width="24" height="56" rx="5" fill="{PALETTE["evidence"]}"/>\n'
            f'  <rect x="92" y="128" width="56" height="24" rx="5" fill="{PALETTE["evidence"]}"/>',
            '  <path d="M168 174h7l4-12 7 25 5-13h8" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>\n',
            "not-required",
        ),
        "environment": (
            "Environment and climate",
            PALETTE["creamGreen"],
            f'  <path d="M120 60c45 15 58 65 20 105-30 30-70 10-72-27-2-38 22-68 52-78Z" fill="#7FA872" stroke="{INK}" stroke-width="4" stroke-linejoin="round"/>\n'
            f'  <path d="M120 68c-8 37-12 72-24 104" fill="none" stroke="{INK}" stroke-width="3" stroke-linecap="round"/>',
            '  <path d="M184 157c10 14 8 26 0 26s-10-12 0-26Z" fill="white"/>\n',
            "not-required",
        ),
        "transportation": (
            "Transportation",
            PALETTE["creamOchre"],
            f'  <rect x="55" y="105" width="130" height="65" rx="14" fill="#C97B51" stroke="{INK}" stroke-width="4"/>\n'
            f'  <path d="M68 118h30v24H68zm37 0h30v24h-30zm37 0h30v24h-30z" fill="{CARD}" stroke="{INK}" stroke-width="2.5"/>\n'
            f'  <circle cx="85" cy="175" r="13" fill="{PALETTE["inkDark"]}"/><circle cx="155" cy="175" r="13" fill="{PALETTE["inkDark"]}"/>',
            '  <path d="M171 174h24m-8-8 8 8-8 8" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>\n',
            "not-required",
        ),
        "public-safety": (
            "Public safety",
            PALETTE["creamBlue"],
            f'  <path d="M120 62 174 82v44c0 35-23 61-54 75-31-14-54-40-54-75V82Z" fill="{PALETTE["institution"]}" stroke="{INK}" stroke-width="4" stroke-linejoin="round"/>\n'
            f'  <path d="m94 127 18 18 36-42" fill="none" stroke="{CARD}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>',
            '  <circle cx="184" cy="174" r="7" fill="white"/>\n',
            "pending",
        ),
        "justice": (
            "Justice",
            PALETTE["creamViolet"],
            f'  <path d="M120 65v105M72 90h96M72 90l-14 38h28Zm96 0-14 38h28Z" fill="{PALETTE["staff"]}" stroke="{INK}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>\n'
            f'  <rect x="96" y="166" width="48" height="13" rx="5" fill="{INK}"/>',
            '  <path d="m171 174 8 8 15-18" fill="none" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>\n',
            "pending",
        ),
        "taxes-budget": (
            "Taxes and budget",
            PALETTE["creamBlue"],
            ''.join(f'  <ellipse cx="112" cy="{cy}" rx="43" ry="16" fill="{PALETTE["mustard"]}" stroke="{INK}" stroke-width="3"/>\n' for cy in [178, 161, 144, 127]),
            '  <rect x="171" y="174" width="5" height="10" fill="white"/><rect x="180" y="166" width="5" height="18" fill="white"/><rect x="189" y="158" width="5" height="26" fill="white"/>\n',
            "not-required",
        ),
        "employment-labor": (
            "Employment and labor",
            PALETTE["creamCoral"],
            f'  <rect x="98" y="82" width="44" height="22" rx="6" fill="none" stroke="{INK}" stroke-width="4"/>\n'
            f'  <rect x="62" y="104" width="116" height="82" rx="12" fill="#8F4E39" stroke="{INK}" stroke-width="4"/>\n'
            f'  <rect x="62" y="132" width="116" height="14" fill="#B55A40"/><rect x="110" y="126" width="20" height="26" rx="4" fill="{CARD}" stroke="{INK}" stroke-width="3"/>',
            '  <rect x="171" y="174" width="5" height="10" fill="white"/><rect x="180" y="166" width="5" height="18" fill="white"/><rect x="189" y="160" width="5" height="24" fill="white"/>\n',
            "pending",
        ),
        "immigration": (
            "Immigration",
            PALETTE["creamTeal"],
            f'  <rect x="80" y="70" width="92" height="128" rx="10" fill="{PALETTE["evidence"]}" stroke="{INK}" stroke-width="4"/>\n'
            f'  <circle cx="126" cy="118" r="18" fill="{CARD}" stroke="{INK}" stroke-width="3"/>\n'
            f'  <path d="M96 158h60M96 172h44" stroke="{CARD}" stroke-width="5" stroke-linecap="round"/>',
            f'  <ellipse cx="184" cy="174" rx="9" ry="15" fill="none" stroke="{INK}" stroke-width="2"/><path d="M169 174h30" stroke="{INK}" stroke-width="2"/>\n',
            "pending",
        ),
        "civil-rights": (
            "Civil rights",
            PALETTE["creamViolet"],
            f'  <circle cx="120" cy="126" r="58" fill="{CARD}" stroke="{INK}" stroke-width="4"/>\n'
            f'  <path d="M83 126h74M120 89v74" stroke="{PALETTE["political"]}" stroke-width="8" stroke-linecap="round"/>\n'
            f'  <circle cx="83" cy="126" r="10" fill="{PALETTE["mustard"]}"/><circle cx="157" cy="126" r="10" fill="{PALETTE["mustard"]}"/><circle cx="120" cy="89" r="10" fill="{PALETTE["mustard"]}"/><circle cx="120" cy="163" r="10" fill="{PALETTE["mustard"]}"/>',
            '  <path d="m171 174 8 8 15-18" fill="none" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>\n',
            "pending",
        ),
    }
    for slug, (title, tint, body, badge, review) in issues.items():
        write_asset(
            asset_id=f"issue-{slug}",
            category="issues",
            filename=f"{slug}.svg",
            svg=issue_tile(title, tint, body, badge),
            width=240,
            height=240,
            alt_text=f"Issue symbol for {title.lower()}",
            intended_use=["issue-selection", "briefing-pack", "sourcebook"],
            representation_review=review,
        )


def build_families() -> None:
    c = PALETTE
    families = {
        "staff": ('  <circle cx="32" cy="22" r="10" fill="currentColor"/><path d="M14 54c2-15 9-22 18-22s16 7 18 22Z" fill="currentColor"/>', "Person symbol for Staff cards"),
        "policy": ('  <path d="M16 8h24l10 10v38H16Z" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/><path d="M40 8v12h10M24 31h18M24 41h18" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>', "Document symbol for Policy cards"),
        "evidence": ('  <path d="M12 52h40M17 47V31M29 47V20M41 47V12" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>', "Chart symbol for Evidence cards"),
        "coalition": ('  <path d="m8 30 15-12 9 8 9-8 15 12-20 20c-3 3-6 3-9 0Z" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/><path d="m23 18 9 8 9-8" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>', "Handshake symbol for Coalition cards"),
        "constituency": ('  <circle cx="22" cy="24" r="8" fill="currentColor"/><circle cx="42" cy="24" r="8" fill="currentColor"/><path d="M8 54c1-12 6-19 14-19s13 7 14 19M28 54c1-12 6-19 14-19s13 7 14 19" fill="currentColor"/>', "Two-person symbol for Constituency cards"),
        "institution": ('  <path d="m8 24 24-14 24 14ZM12 52h40M17 26v22M27 26v22M37 26v22M47 26v22" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>', "Civic building symbol for Institution cards"),
        "political": ('  <path d="M10 30h13l25-12v28L23 34H10Z" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/><path d="m21 35 5 17" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>', "Megaphone symbol for Political cards"),
        "tactic": ('  <path d="M10 14h15c0 7 14 7 14 0h15v15c-7 0-7 14 0 14v11H39c0-7-14-7-14 0H10V39c7 0 7-14 0-14Z" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/>', "Interlocking-piece symbol for Tactic cards"),
    }
    for slug, (body, alt) in families.items():
        body = f'  <g style="color:{c[slug]}">{body}</g>'
        write_asset(
            asset_id=f"family-{slug}", category="families", filename=f"{slug}.svg",
            svg=icon_document(f"{slug.title()} family", body), width=64, height=64,
            alt_text=alt, intended_use=["card-family", "filter", "legend"], color_role=slug,
        )


def build_provenance() -> None:
    provenance = {
        "official": (PALETTE["official"], '  <rect x="10" y="10" width="44" height="44" rx="10" fill="currentColor"/><path d="m20 32 8 8 17-19" fill="none" stroke="white" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>', "Rounded-square check for official records"),
        "derived": (PALETTE["derived"], '  <path d="m32 6 26 26-26 26L6 32Z" fill="currentColor"/><path d="M20 23h23L30 32l13 9H20" fill="none" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>', "Diamond formula symbol for derived context"),
        "simulated": (PALETTE["simulated"], '  <path d="m32 5 24 14v27L32 59 8 46V19Z" fill="currentColor"/><path d="m32 17 4 10 11 1-8 7 3 11-10-6-10 6 3-11-8-7 11-1Z" fill="white"/>', "Hexagon spark for simulated information"),
    }
    for slug, (color, body, alt) in provenance.items():
        write_asset(
            asset_id=f"provenance-{slug}", category="provenance", filename=f"{slug}.svg",
            svg=icon_document(f"{slug.title()} provenance", f'  <g style="color:{color}">{body}</g>'),
            width=64, height=64, alt_text=alt,
            intended_use=["provenance-badge", "sourcebook", "inspector"], color_role=slug,
        )


def build_resources() -> None:
    color = PALETTE["ink"]
    resources = {
        "staff-attention": ('  <circle cx="32" cy="32" r="23" fill="none" stroke="currentColor" stroke-width="5"/><path d="M32 17v17l11 8" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>', "Clock symbol for Staff Attention"),
        "political-capital": ('  <circle cx="32" cy="32" r="24" fill="none" stroke="currentColor" stroke-width="5"/><path d="m32 15 5 11 12 1-9 8 3 12-11-7-11 7 3-12-9-8 12-1Z" fill="currentColor"/>', "Star token for Political Capital"),
        "district-trust": ('  <path d="m9 30 23-19 23 19v24H9Z" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/><path d="M24 38c0-7 8-8 8-2 0-6 8-5 8 2 0 6-8 11-8 11s-8-5-8-11Z" fill="currentColor"/>', "House and heart for District Trust"),
        "bill-momentum": ('  <path d="M13 8h24l10 10v38H13Z" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/><path d="M22 43 43 22m-12 0h12v12" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>', "Document and rising arrow for Bill Momentum"),
        "policy-integrity": ('  <path d="M32 10v42M14 20h36M14 20 7 40h14Zm36 0-7 20h14Z" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>', "Balanced scales for Policy Integrity"),
        "staff-morale": ('  <circle cx="32" cy="32" r="22" fill="none" stroke="currentColor" stroke-width="5"/><path d="M21 28h1m20 0h1M21 40c7 8 15 8 22 0" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>', "Positive face symbol for Staff Morale"),
    }
    for slug, (body, alt) in resources.items():
        write_asset(
            asset_id=f"resource-{slug}", category="resources", filename=f"{slug}.svg",
            svg=icon_document(slug.replace("-", " ").title(), f'  <g style="color:{color}">{body}</g>'),
            width=64, height=64, alt_text=alt, intended_use=["hud", "card-cost", "inspector"],
        )


def build_statuses() -> None:
    statuses = {
        "working": ('  <circle cx="32" cy="32" r="23" fill="none" stroke="currentColor" stroke-width="5"/><path d="M32 17v17l12 7" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>', "Working timer"),
        "expiring": ('  <path d="M10 52h44M17 12h30l-4 13-11 7 11 7 4 13H17l4-13 11-7-11-7Z" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/>', "Expiring hourglass"),
        "overextended": ('  <path d="m32 7 26 48H6Z" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/><path d="M32 22v17m0 8h.1" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>', "Overextended warning"),
        "locked": ('  <rect x="12" y="27" width="40" height="30" rx="7" fill="none" stroke="currentColor" stroke-width="5"/><path d="M21 27v-7c0-14 22-14 22 0v7" fill="none" stroke="currentColor" stroke-width="5"/>', "Locked status"),
        "conditional": ('  <path d="M11 32h42" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><circle cx="21" cy="32" r="10" fill="none" stroke="currentColor" stroke-width="5"/><path d="m39 22 14 10-14 10" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>', "Conditional support"),
        "committed": ('  <circle cx="32" cy="32" r="24" fill="none" stroke="currentColor" stroke-width="5"/><path d="m19 32 9 9 18-21" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>', "Committed support"),
    }
    for slug, (body, alt) in statuses.items():
        write_asset(
            asset_id=f"status-{slug}", category="statuses", filename=f"{slug}.svg",
            svg=icon_document(slug.title(), f'  <g style="color:{PALETTE["ink"]}">{body}</g>'),
            width=64, height=64, alt_text=alt, intended_use=["card-status", "stack-status", "inspector"],
        )


def build_institutions() -> None:
    institutions = {
        "committee": ('  <path d="M8 51h48M13 24h38M18 24v23M29 24v23M40 24v23M51 24v23M8 24 32 9l24 15" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>', "Committee building"),
        "house-floor": ('  <path d="M9 52h46M13 48h38V24H13ZM9 24 32 9l23 15" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/><circle cx="24" cy="36" r="4" fill="currentColor"/><circle cx="40" cy="36" r="4" fill="currentColor"/>', "House floor chamber"),
        "senate": ('  <path d="M8 52h48M14 48h36V22H14ZM10 22 32 9l22 13" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/><path d="M24 30h16v10H24Z" fill="currentColor"/>', "Senate chamber"),
        "bill-docket": ('  <path d="M13 8h24l12 12v36H13Z" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/><path d="M37 8v13h12M22 33h18M22 43h18" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>', "Bill docket"),
        "sourcebook": ('  <path d="M8 13h20c5 0 7 3 7 7v35c0-4-2-7-7-7H8Zm48 0H36v42c0-4 2-7 7-7h13Z" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/>', "Sourcebook"),
        "archive": ('  <path d="M10 14h44v12H10Zm5 12h34v30H15Z" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/><path d="M25 37h14" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>', "Archive box"),
    }
    for slug, (body, alt) in institutions.items():
        write_asset(
            asset_id=f"institution-{slug}", category="institutions", filename=f"{slug}.svg",
            svg=icon_document(slug.replace("-", " ").title(), f'  <g style="color:{PALETTE["institution"]}">{body}</g>'),
            width=64, height=64, alt_text=alt, intended_use=["desk-zone", "procedure", "sourcebook"],
        )


def main() -> None:
    ASSETS.clear()
    build_issues()
    build_families()
    build_provenance()
    build_resources()
    build_statuses()
    build_institutions()
    manifest = {
        "schemaVersion": 2,
        "kitId": "paper-majority-civic-illustration-kit",
        "generatorVersion": "2.0.0",
        "purpose": "Prototype-safe reusable SVG grammar for Paper Majority",
        "palette": PALETTE,
        "taxonomy": {
            "families": ["staff", "policy", "evidence", "coalition", "constituency", "institution", "political", "tactic"],
            "provenance": ["official", "derived", "simulated"],
            "issues": [asset["assetId"].removeprefix("issue-") for asset in ASSETS if asset["category"] == "issues"],
        },
        "rules": {
            "issueColorNeverOverridesFamilyColor": True,
            "semanticTextRenderedByGame": True,
            "realLawmakerLikenessesAllowed": False,
            "communityScenesRequireSeparateReview": True,
        },
        "assets": sorted(ASSETS, key=lambda item: (item["category"], item["assetId"])),
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"Generated {len(ASSETS)} SVG assets and {MANIFEST_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
