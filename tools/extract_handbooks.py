#!/usr/bin/env python3
"""Extract Word handbook content into the site's searchable JSON model."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
from pathlib import Path

from docx import Document
from docx.oxml.ns import qn
from docx.table import Table
from docx.text.paragraph import Paragraph


CAMPUSES = {
    "main-campus": {
        "name": "Main Campus",
        "shortName": "MC",
        "sourceLabel": "MC NICU Faculty Orientation Document (2026)",
    },
    "akron": {
        "name": "Akron General",
        "shortName": "AK",
        "sourceLabel": "NSICU Faculty Orientation Handbook — Akron (2026)",
    },
}


def clean_text(value: str) -> str:
    value = value.replace("\u2002", " ").replace("\u00a0", " ")
    value = re.sub(r"[ \t]+", " ", value)
    value = re.sub(r" *\n *", " · ", value)
    return value.strip()


def slugify(value: str) -> str:
    value = value.lower().replace("&", " and ")
    value = re.sub(r"[^a-z0-9]+", "-", value).strip("-")
    return value[:88] or "section"


def iter_body_blocks(document: Document):
    for child in document.element.body.iterchildren():
        if child.tag == qn("w:p"):
            yield Paragraph(child, document)
        elif child.tag == qn("w:tbl"):
            yield Table(child, document)


def paragraph_images(paragraph: Paragraph, document: Document, media_dir: Path, campus: str):
    images = []
    for blip in paragraph._p.xpath(".//a:blip"):
        rel_id = blip.get(qn("r:embed"))
        if not rel_id or rel_id not in document.part.rels:
            continue
        part = document.part.rels[rel_id].target_part
        source_name = Path(str(part.partname)).name
        digest = hashlib.sha1(part.blob).hexdigest()[:10]
        target_name = f"{campus}-{digest}-{source_name}"
        target = media_dir / target_name
        if not target.exists():
            target.write_bytes(part.blob)
        images.append(
            {
                "type": "image",
                "src": f"/handbook-media/{target_name}",
                "alt": "Reference figure from the source handbook",
            }
        )
    return images


def table_block(table: Table):
    rows = []
    for row in table.rows:
        values = [clean_text(cell.text) for cell in row.cells]
        if any(values):
            rows.append(values)
    if not rows:
        return None

    width = max(len(row) for row in rows)
    normalized = [row + [""] * (width - len(row)) for row in rows]
    return {"type": "table", "rows": normalized}


def add_unique_slug(section: dict, used: set[str]):
    base = slugify(section["title"])
    candidate = base
    index = 2
    while candidate in used:
        candidate = f"{base}-{index}"
        index += 1
    used.add(candidate)
    section["slug"] = candidate


def extract_handbook(source: Path, campus: str, media_dir: Path):
    document = Document(source)
    campus_meta = CAMPUSES[campus]
    sections = []
    current = None
    used_slugs: set[str] = set()
    preface = []

    def ensure_section():
        nonlocal current
        if current is None:
            current = {
                "title": "Welcome & source overview",
                "level": 1,
                "parent": None,
                "blocks": [],
            }
            add_unique_slug(current, used_slugs)
            sections.append(current)
        return current

    for block in iter_body_blocks(document):
        if isinstance(block, Paragraph):
            text = clean_text(block.text)
            style_name = block.style.name if block.style else "Normal"
            image_blocks = paragraph_images(block, document, media_dir, campus)

            heading_match = re.match(r"Heading (\d+)", style_name)
            if heading_match and text:
                level = int(heading_match.group(1))
                parent = next(
                    (s["slug"] for s in reversed(sections) if s["level"] < level),
                    None,
                )
                current = {
                    "title": text,
                    "level": level,
                    "parent": parent,
                    "blocks": [],
                }
                add_unique_slug(current, used_slugs)
                sections.append(current)
                current["blocks"].extend(image_blocks)
                continue

            if text:
                target = ensure_section()
                block_type = "list-item" if style_name == "List Paragraph" else "paragraph"
                target["blocks"].append({"type": block_type, "text": text})
                if len(sections) == 1 and len(preface) < 8:
                    preface.append(text)
            if image_blocks:
                ensure_section()["blocks"].extend(image_blocks)
        else:
            table = table_block(block)
            if table:
                ensure_section()["blocks"].append(table)

    for index, section in enumerate(sections):
        section["order"] = index
        searchable = [section["title"]]
        for block in section["blocks"]:
            if block["type"] in {"paragraph", "list-item"}:
                searchable.append(block["text"])
            elif block["type"] == "table":
                searchable.extend(cell for row in block["rows"] for cell in row)
        section["searchText"] = clean_text(" ".join(searchable)).lower()

    return {
        "id": campus,
        **campus_meta,
        "sourceFile": source.name,
        "preface": preface,
        "stats": {
            "sections": len(sections),
            "tables": sum(
                block["type"] == "table"
                for section in sections
                for block in section["blocks"]
            ),
            "figures": sum(
                block["type"] == "image"
                for section in sections
                for block in section["blocks"]
            ),
        },
        "sections": sections,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--main-campus", type=Path, required=True)
    parser.add_argument("--akron", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--media-dir", type=Path, required=True)
    args = parser.parse_args()

    if args.media_dir.exists():
        shutil.rmtree(args.media_dir)
    args.media_dir.mkdir(parents=True, exist_ok=True)
    args.output.parent.mkdir(parents=True, exist_ok=True)

    payload = {
        "generatedFrom": "2026 faculty orientation source documents",
        "handbooks": [
            extract_handbook(args.main_campus, "main-campus", args.media_dir),
            extract_handbook(args.akron, "akron", args.media_dir),
        ],
    }
    args.output.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    main()
