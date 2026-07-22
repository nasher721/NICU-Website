#!/usr/bin/env python3
"""Extract and normalize handbook content into campus-scoped wiki assets."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
from pathlib import Path
from typing import Any

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


def normalize_search_text(value: str) -> str:
    return clean_text(value).casefold()


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


def table_images(table: Table, document: Document, media_dir: Path, campus: str):
    images = []
    seen = set()
    for row in table.rows:
        for cell in row.cells:
            for paragraph in cell.paragraphs:
                for image in paragraph_images(paragraph, document, media_dir, campus):
                    if image["src"] not in seen:
                        seen.add(image["src"])
                        images.append(image)
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


def add_unique_slug(section: dict[str, Any], used: set[str]):
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
            image_blocks = table_images(block, document, media_dir, campus)
            table = table_block(block)
            if image_blocks:
                ensure_section()["blocks"].extend(image_blocks)
            if table:
                ensure_section()["blocks"].append(table)

    return {
        "id": campus,
        **campus_meta,
        "sourceFile": source.name,
        "preface": preface,
        "sections": sections,
    }


def block_text(block: dict[str, Any]) -> list[str]:
    if block["type"] in {"paragraph", "list-item"}:
        return [block["text"]]
    if block["type"] == "table":
        return [cell for row in block["rows"] for cell in row]
    return []


def block_digest(blocks: list[dict[str, Any]]) -> str:
    encoded = json.dumps(blocks, ensure_ascii=False, separators=(",", ":")).encode()
    return hashlib.sha256(encoded).hexdigest()[:16]


def content_type(section: dict[str, Any]) -> str:
    title = normalize_search_text(section["title"])
    block_types = {block["type"] for block in section["blocks"]}
    if "smartphrase" in title:
        return "smartphrase"
    if block_types and block_types <= {"image"}:
        return "figure"
    if block_types and block_types <= {"table", "image"}:
        return "reference-table"
    return "article"


def section_aliases(section_text: str, aliases: list[dict[str, Any]], campus: str) -> list[str]:
    matches = []
    for alias in aliases:
        campuses = alias.get("campuses", list(CAMPUSES))
        if campus not in campuses:
            continue
        term = normalize_search_text(alias["term"])
        expansion = normalize_search_text(alias["expansion"])
        if term in section_text or expansion in section_text:
            matches.extend([alias["term"], alias["expansion"]])
    return list(dict.fromkeys(matches))


def heading_key(section: dict[str, Any], by_slug: dict[str, dict[str, Any]]) -> str:
    slugs = [section["slug"]]
    parent_slug = section.get("parent")
    visited = {section["slug"]}
    while parent_slug:
        if parent_slug in visited or parent_slug not in by_slug:
            raise ValueError(f"Invalid heading ancestry for {section['slug']}")
        visited.add(parent_slug)
        slugs.append(parent_slug)
        parent_slug = by_slug[parent_slug].get("parent")
    return "/".join(reversed(slugs))


def canonical_section_id(campus: str, source_key: str) -> str:
    digest = hashlib.sha256(f"{campus}\0{source_key}".encode()).hexdigest()[:12]
    return f"{campus}-section-{digest}"


def validate_metadata(metadata: dict[str, Any], handbooks: list[dict[str, Any]]):
    required = {
        "aliases",
        "shortcuts",
        "rankingPriorities",
        "verification",
        "sourceWarnings",
        "renamedSections",
        "redirects",
    }
    missing = required.difference(metadata)
    if missing:
        raise ValueError(f"Editorial metadata is missing: {', '.join(sorted(missing))}")

    slugs_by_campus = {
        handbook["id"]: {section["slug"] for section in handbook["sections"]}
        for handbook in handbooks
    }
    rename_sources: set[tuple[str, str]] = set()
    rename_targets: set[tuple[str, str]] = set()
    for rename in metadata["renamedSections"]:
        campus = rename.get("campus")
        previous_slug = rename.get("previousSlug")
        current_slug = rename.get("currentSlug")
        if campus not in CAMPUSES or campus == "*":
            raise ValueError("Renamed sections must name one explicit campus")
        if not previous_slug or not current_slug or previous_slug == current_slug:
            raise ValueError("Renamed sections require distinct previous/current canonical slugs")
        if current_slug not in slugs_by_campus[campus]:
            raise ValueError(f"Renamed section target is missing: {campus}/{current_slug}")
        if not rename.get("stableSourceKey") or not rename.get("reviewedOn") or not rename.get("reason"):
            raise ValueError(f"Renamed section lacks reviewed stable-ID metadata: {campus}/{current_slug}")
        source_key = (campus, previous_slug)
        target_key = (campus, current_slug)
        if source_key in rename_sources or target_key in rename_targets:
            raise ValueError(f"Duplicate renamed-section mapping for {campus}")
        rename_sources.add(source_key)
        rename_targets.add(target_key)

    convenience_sources: set[tuple[str, str]] = set()
    for redirect in metadata["redirects"]:
        campuses = list(CAMPUSES) if redirect.get("campus") == "*" else [redirect.get("campus")]
        if any(campus not in CAMPUSES for campus in campuses):
            raise ValueError("Convenience redirect uses an invalid campus")
        if not redirect.get("from") or not redirect.get("to"):
            raise ValueError("Convenience redirects require from/to slugs")
        for campus in campuses:
            source_key = (campus, redirect["from"])
            if source_key in convenience_sources or source_key in rename_sources:
                raise ValueError(f"Duplicate redirect source: {campus}/{redirect['from']}")
            if redirect["to"] not in slugs_by_campus[campus]:
                raise ValueError(f"Convenience redirect target is missing: {campus}/{redirect['to']}")
            convenience_sources.add(source_key)


def normalize_handbook(handbook: dict[str, Any], metadata: dict[str, Any]):
    campus = handbook["id"]
    if campus not in CAMPUSES:
        raise ValueError(f"Unsupported campus: {campus}")

    verification = metadata["verification"][campus]
    source_label = handbook["sourceLabel"]
    source_file = handbook["sourceFile"]
    sections = handbook["sections"]
    slug_to_section = {section["slug"]: section for section in sections}
    rename_source_keys = {
        item["currentSlug"]: item["stableSourceKey"]
        for item in metadata_for_campus(metadata, "renamedSections", campus)
    }

    for index, section in enumerate(sections):
        section["order"] = index
        section["sourceKey"] = rename_source_keys.get(section["slug"]) or heading_key(
            section, slug_to_section
        )
        section["id"] = canonical_section_id(campus, section["sourceKey"])

    slug_to_id = {section["slug"]: section["id"] for section in sections}
    for section in sections:
        body = clean_text(" ".join(text for block in section["blocks"] for text in block_text(block)))
        normalized_body = normalize_search_text(body)
        normalized_title = normalize_search_text(section["title"])
        parent_slug = section.get("parent")
        parent = slug_to_section.get(parent_slug)
        aliases = section_aliases(f"{normalized_title} {normalized_body}", metadata["aliases"], campus)
        section["campus"] = campus
        section["parentId"] = slug_to_id.get(parent_slug)
        section["contentType"] = content_type(section)
        section["path"] = f"/{campus}/{section['slug']}"
        section["source"] = {
            "handbook": source_label,
            "file": source_file,
            "year": verification["handbookYear"],
            "sectionOrder": section["order"],
            "headingKey": section["sourceKey"],
            "blockDigest": block_digest(section["blocks"]),
        }
        section["search"] = {
            "title": normalized_title,
            "heading": normalized_title,
            "parentHeading": normalize_search_text(parent["title"]) if parent else "",
            "body": normalized_body,
            "aliases": aliases,
        }
        section["searchText"] = clean_text(f"{section['title']} {body}").casefold()

    handbook["sourceStatus"] = {
        **verification,
        "warning": metadata["sourceWarnings"][campus],
    }
    handbook["stats"] = {
        "sections": len(sections),
        "tables": sum(
            block["type"] == "table" for section in sections for block in section["blocks"]
        ),
        "figures": sum(
            block["type"] == "image" for section in sections for block in section["blocks"]
        ),
    }
    return handbook


def metadata_for_campus(metadata: dict[str, Any], key: str, campus: str):
    return [
        item
        for item in metadata[key]
        if item.get("campus") in {campus, "*"}
        or campus in item.get("campuses", [])
    ]


def build_assets(payload: dict[str, Any], metadata: dict[str, Any]):
    validate_metadata(metadata, payload["handbooks"])
    handbooks = [normalize_handbook(handbook, metadata) for handbook in payload["handbooks"]]
    payload["schemaVersion"] = 2
    payload["handbooks"] = handbooks
    manifest = {"schemaVersion": 1, "campuses": {}, "redirects": []}
    assets: dict[str, Any] = {}

    for handbook in handbooks:
        campus = handbook["id"]
        sections = handbook["sections"]
        slug_to_section = {section["slug"]: section for section in sections}
        priorities = {
            item["slug"]: item["priority"]
            for item in metadata_for_campus(metadata, "rankingPriorities", campus)
        }
        navigation = {
            "schemaVersion": 1,
            "campus": campus,
            "name": handbook["name"],
            "shortName": handbook["shortName"],
            "sourceStatus": handbook["sourceStatus"],
            "shortcuts": [],
            "sections": [],
        }
        for shortcut in metadata_for_campus(metadata, "shortcuts", campus):
            target_slug = shortcut["targets"].get(campus)
            target = slug_to_section.get(target_slug)
            if not target:
                raise ValueError(f"Shortcut {shortcut['id']} targets missing {campus}/{target_slug}")
            navigation["shortcuts"].append(
                {
                    "id": shortcut["id"],
                    "label": shortcut["label"],
                    "hint": shortcut["hint"],
                    "targetId": target["id"],
                    "path": target["path"],
                }
            )
        for section in sections:
            navigation["sections"].append(
                {
                    key: section[key]
                    for key in (
                        "id",
                        "title",
                        "slug",
                        "path",
                        "level",
                        "parent",
                        "parentId",
                        "order",
                        "contentType",
                    )
                }
            )

        search_index = {
            "schemaVersion": 1,
            "campus": campus,
            "records": [
                {
                    "id": section["id"],
                    "campus": campus,
                    "title": section["title"],
                    "slug": section["slug"],
                    "path": section["path"],
                    "parentId": section["parentId"],
                    "parentSlug": section["parent"],
                    "contentType": section["contentType"],
                    "priority": priorities.get(section["slug"], 0),
                    **section["search"],
                }
                for section in sections
            ],
        }
        figure_index = {
            "schemaVersion": 1,
            "campus": campus,
            "figures": [
                {
                    "id": f"{section['id']}-figure-{block_index}",
                    "path": section["path"],
                    "sectionTitle": section["title"],
                    "src": block["src"],
                    "alt": block.get("alt", ""),
                    "sourceLabel": handbook["sourceLabel"],
                    "sourceLocation": section["source"]["headingKey"],
                }
                for section in sections
                for block_index, block in enumerate(section["blocks"])
                if block["type"] == "image"
            ],
        }
        content = {
            "schemaVersion": 1,
            "campus": campus,
            "source": {
                "label": handbook["sourceLabel"],
                "file": handbook["sourceFile"],
                **handbook["sourceStatus"],
            },
            "stats": handbook["stats"],
            "sections": sections,
        }

        content_name = f"{campus}.content.json"
        navigation_name = f"{campus}.navigation.json"
        search_name = f"{campus}.search-index.json"
        figures_name = f"{campus}.figures.json"
        assets[content_name] = content
        assets[navigation_name] = navigation
        assets[search_name] = search_index
        assets[figures_name] = figure_index
        manifest["campuses"][campus] = {
            "homePath": f"/{campus}",
            "contentAsset": content_name,
            "navigationAsset": navigation_name,
            "searchAsset": search_name,
            "figuresAsset": figures_name,
            "name": handbook["name"],
            "shortName": handbook["shortName"],
            "sourceLabel": handbook["sourceLabel"],
            "sourceFile": handbook["sourceFile"],
            "stats": handbook["stats"],
            "sourceStatus": handbook["sourceStatus"],
            "routes": [
                {
                    "id": section["id"],
                    "path": section["path"],
                    "slug": section["slug"],
                    "title": section["title"],
                    "contentType": section["contentType"],
                }
                for section in sections
            ],
        }

        for rename in metadata_for_campus(metadata, "renamedSections", campus):
            target = slug_to_section[rename["currentSlug"]]
            manifest["redirects"].append(
                {
                    "kind": "renamed-section",
                    "campus": campus,
                    "from": f"/{campus}/{rename['previousSlug']}",
                    "to": target["path"],
                    "stableId": target["id"],
                    "reviewedOn": rename["reviewedOn"],
                }
            )

        for redirect in metadata_for_campus(metadata, "redirects", campus):
            target = slug_to_section.get(redirect["to"])
            if not target:
                raise ValueError(f"Redirect targets missing {campus}/{redirect['to']}")
            manifest["redirects"].append(
                {
                    "kind": "convenience",
                    "campus": campus,
                    "from": f"/{campus}/{redirect['from']}",
                    "to": target["path"],
                    "stableId": target["id"],
                }
            )

    assets["route-manifest.json"] = manifest
    return payload, assets


def table_digest(block: dict[str, Any]) -> str:
    encoded = json.dumps(block["rows"], ensure_ascii=False, separators=(",", ":")).encode()
    return hashlib.sha256(encoded).hexdigest()[:16]


def build_inventory(payload: dict[str, Any]):
    campuses = {}
    for handbook in payload["handbooks"]:
        tables = [
            table_digest(block)
            for section in handbook["sections"]
            for block in section["blocks"]
            if block["type"] == "table"
        ]
        figures = [
            block["src"]
            for section in handbook["sections"]
            for block in section["blocks"]
            if block["type"] == "image"
        ]
        campuses[handbook["id"]] = {
            "counts": handbook["stats"],
            "sectionIds": sorted(section["id"] for section in handbook["sections"]),
            "tableDigests": sorted(tables),
            "figureSources": sorted(figures),
        }
    return {
        "schemaVersion": 1,
        "totals": {
            key: sum(handbook["stats"][key] for handbook in payload["handbooks"])
            for key in ("sections", "tables", "figures")
        },
        "campuses": campuses,
    }


def validate_inventory(payload: dict[str, Any], inventory: dict[str, Any]):
    current = build_inventory(payload)
    for key in ("totals", "campuses"):
        if current[key] != inventory.get(key):
            raise ValueError(
                f"Audited handbook inventory drift in {key}; source changes require reviewed baseline update"
            )


def validate_assets(
    payload: dict[str, Any],
    assets: dict[str, Any],
    metadata: dict[str, Any],
    public_dir: Path,
):
    handbooks = payload["handbooks"]
    if [handbook["id"] for handbook in handbooks] != list(CAMPUSES):
        raise ValueError("Payload must contain Main Campus followed by Akron")

    all_ids: set[str] = set()
    for handbook in handbooks:
        campus = handbook["id"]
        sections = handbook["sections"]
        slugs = {section["slug"] for section in sections}
        ids = {section["id"] for section in sections}
        if len(slugs) != len(sections):
            raise ValueError(f"Duplicate slug in {campus}")
        if len(ids) != len(sections) or all_ids.intersection(ids):
            raise ValueError(f"Duplicate stable ID in {campus}")
        all_ids.update(ids)

        child_counts = {section_id: 0 for section_id in ids}
        for section in sections:
            if section["parent"] is None:
                if section["parentId"] is not None:
                    raise ValueError(f"Root {section['id']} has parentId")
            else:
                if section["parent"] not in slugs or section["parentId"] not in ids:
                    raise ValueError(f"Invalid parent for {section['id']}")
                child_counts[section["parentId"]] += 1
            if not section["blocks"] and child_counts.get(section["id"], 0) == 0:
                # Rechecked after the parent scan below.
                continue
            if not section["source"]["blockDigest"]:
                raise ValueError(f"Missing source digest for {section['id']}")
            for block in section["blocks"]:
                if block["type"] == "table":
                    if not block["rows"] or not block["rows"][0]:
                        raise ValueError(f"Empty table in {section['id']}")
                    width = len(block["rows"][0])
                    if any(len(row) != width for row in block["rows"]):
                        raise ValueError(f"Ragged table in {section['id']}")
                if block["type"] == "image":
                    source = block["src"]
                    if not re.fullmatch(r"/handbook-media/[a-z0-9.-]+", source, re.I):
                        raise ValueError(f"Invalid figure path: {source}")
                    if not (public_dir / source.lstrip("/")).is_file():
                        raise ValueError(f"Missing figure: {source}")

        for section in sections:
            if not section["blocks"] and child_counts[section["id"]] == 0:
                raise ValueError(f"Unexpected empty leaf section: {section['id']}")

        for priority in metadata_for_campus(metadata, "rankingPriorities", campus):
            if priority["slug"] not in slugs:
                raise ValueError(f"Priority targets missing {campus}/{priority['slug']}")

        calculated_stats = {
            "sections": len(sections),
            "tables": sum(block["type"] == "table" for section in sections for block in section["blocks"]),
            "figures": sum(block["type"] == "image" for section in sections for block in section["blocks"]),
        }
        if handbook["stats"] != calculated_stats:
            raise ValueError(f"Invalid stats for {campus}")

    manifest = assets["route-manifest.json"]
    route_paths = {
        route["path"]
        for campus in manifest["campuses"].values()
        for route in campus["routes"]
    }
    redirect_sources: set[str] = set()
    for redirect in manifest["redirects"]:
        if redirect["from"] in redirect_sources or redirect["from"] in route_paths:
            raise ValueError(f"Duplicate/conflicting redirect source: {redirect['from']}")
        if redirect["to"] not in route_paths or redirect["stableId"] not in all_ids:
            raise ValueError(f"Invalid redirect target: {redirect['to']}")
        redirect_sources.add(redirect["from"])


def write_json(path: Path, value: Any):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n")


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--main-campus", type=Path)
    parser.add_argument("--akron", type=Path)
    parser.add_argument("--input-json", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--media-dir", type=Path)
    parser.add_argument("--metadata", type=Path)
    parser.add_argument("--inventory", type=Path)
    parser.add_argument("--generated-dir", type=Path)
    parser.add_argument("--public-dir", type=Path)
    args = parser.parse_args()

    source_mode = args.main_campus is not None or args.akron is not None
    if args.input_json and source_mode:
        parser.error("--input-json cannot be combined with handbook source arguments")
    if not args.input_json and not (args.main_campus and args.akron and args.media_dir):
        parser.error("provide --input-json or both handbook sources with --media-dir")
    return args


def main():
    args = parse_args()
    metadata_path = args.metadata or args.output.parent / "wiki-metadata.json"
    inventory_path = args.inventory or args.output.parent / "handbook-inventory.json"
    generated_dir = args.generated_dir or args.output.parent / "generated"
    public_dir = args.public_dir or args.output.parents[2] / "public"
    metadata = json.loads(metadata_path.read_text())

    if args.input_json:
        payload = json.loads(args.input_json.read_text())
    else:
        if args.media_dir.exists():
            shutil.rmtree(args.media_dir)
        args.media_dir.mkdir(parents=True, exist_ok=True)
        payload = {
            "generatedFrom": "2026 faculty orientation source documents",
            "handbooks": [
                extract_handbook(args.main_campus, "main-campus", args.media_dir),
                extract_handbook(args.akron, "akron", args.media_dir),
            ],
        }

    payload, assets = build_assets(payload, metadata)
    validate_assets(payload, assets, metadata, public_dir)
    inventory = json.loads(inventory_path.read_text())
    validate_inventory(payload, inventory)
    write_json(args.output, payload)
    if generated_dir.exists():
        shutil.rmtree(generated_dir)
    generated_dir.mkdir(parents=True)
    for name, asset in assets.items():
        write_json(generated_dir / name, asset)
    public_search_dir = public_dir / "search-index"
    public_search_dir.mkdir(parents=True, exist_ok=True)
    for campus in ("main-campus", "akron"):
        write_json(public_search_dir / f"{campus}.json", assets[f"{campus}.search-index.json"])


if __name__ == "__main__":
    main()
