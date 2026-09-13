#!/usr/bin/env python3
"""Plot selected saved colonies at a shared physical scale, without running the GPU.

Requires Pillow. Example:
  python3 research/structure-audit-render.py --out /tmp/colonies.png \
    'Baseline 42 · 4 min=/tmp/baseline/42-colonies-240.json' \
    'Candidate 42 · 4 min=/tmp/candidate/42-colonies-240.json'

Inputs may also be historical observation-*.json.gz files. These contain selected
bodies, not a whole-world census or a reproducible running-world checkpoint.
"""
import argparse
from collections import deque
import colorsys
import gzip
import hashlib
import json
import math
from pathlib import Path
import textwrap

from PIL import Image, ImageDraw, ImageFont


def load_snapshot(spec):
    label, sep, filename = spec.partition("=")
    if not sep:
        filename, label = spec, Path(spec).name
    path = Path(filename).resolve()
    raw = path.read_bytes()
    data = json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)
    world = data["world"]
    if not isinstance(world, (int, float)) or not math.isfinite(world) or world <= 0:
        raise ValueError(f"Invalid world width in {path}")
    return label, path, hashlib.sha256(raw).hexdigest(), world, data["colonies"]


def geometry(body, world):
    """Unwrap along real reciprocal links; refuse inconsistent toroidal winding."""
    result = {"selection": body["selection"], "size": body["size"], "speed": body["speed"]}
    if body.get("omitted"):
        return {**result, "omitted": body["omitted"]}
    cells = body.get("cells", [])
    if len(cells) != body["size"] or not cells:
        raise ValueError("Captured body size does not match its cells")
    by_slot = {c["slot"]: c for c in cells}
    if len(by_slot) != len(cells):
        raise ValueError("Duplicate cell slots in captured body")
    for c in cells:
        for k in ["x", "y", "vx", "vy", "hue"]:
            if not math.isfinite(c[k]):
                raise ValueError(f"Nonfinite cell {k}")
        if len(set(c["links"])) != len(c["links"]):
            raise ValueError("Duplicate links")
        for neighbor in c["links"]:
            if neighbor not in by_slot or c["slot"] not in by_slot[neighbor]["links"]:
                raise ValueError("Captured links must be complete and reciprocal")
    wrap = lambda d: d - math.floor(d / world + 0.5) * world
    root = cells[0]["slot"]
    xy = {root: (0.0, 0.0)}
    queue = deque([root])
    winding = False
    while queue:
        slot = queue.popleft()
        cell = by_slot[slot]
        for neighbor in cell["links"]:
            other = by_slot[neighbor]
            pos = (xy[slot][0] + wrap(other["x"] - cell["x"]),
                   xy[slot][1] + wrap(other["y"] - cell["y"]))
            if neighbor in xy:
                winding |= math.dist(pos, xy[neighbor]) > 0.01
            else:
                xy[neighbor] = pos
                queue.append(neighbor)
    if len(xy) != len(cells):
        raise ValueError("Captured body is disconnected")
    if winding:
        return {**result, "omitted": "Body winds around the torus; no faithful flat view"}
    xmid = (min(x for x, y in xy.values()) + max(x for x, y in xy.values())) / 2
    ymid = (min(y for x, y in xy.values()) + max(y for x, y in xy.values())) / 2
    xy = {slot: (x - xmid, y - ymid) for slot, (x, y) in xy.items()}
    degrees = [len(c["links"]) for c in cells]
    denominator = sum(math.hypot(c["vx"], c["vy"]) for c in cells)
    coherence = math.hypot(sum(c["vx"] for c in cells), sum(c["vy"] for c in cells)) / denominator if denominator else 0.0
    return {**result, "cells": cells, "xy": xy,
            "extent": max(max(abs(x), abs(y)) for x, y in xy.values()) * 2 + 8,
            "branches": sum(d >= 3 for d in degrees), "leaves": degrees.count(1),
            "edges": sum(degrees) // 2, "velocityCoherence": coherence,
            "genomeSlots": len({c["genomeSlot"] for c in cells})}


def font(size):
    for path in ["/System/Library/Fonts/Supplemental/Arial.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default(size=size)


def render(inputs, output, title="Selected colony snapshots", span=None):
    sources, rows = [], []
    for spec in inputs:
        label, path, digest, world, bodies = load_snapshot(spec)
        source = {"label": label, "path": str(path), "sha256": digest, "world": world, "bodies": []}
        panels = {}
        for body in bodies:
            b = geometry(body, world)
            source["bodies"].append({k: v for k, v in b.items() if k not in ["cells", "xy"]})
            if b["selection"] in panels:
                raise ValueError("Duplicate body selection")
            panels[b["selection"]] = b
        rows.append((label, panels))
        sources.append(source)
    required = max([120] + [b["extent"] * 1.08 for _, panels in rows for b in panels.values() if "extent" in b])
    if span is None:
        span = math.ceil(required / 20) * 20
    if not math.isfinite(span) or span < required:
        raise ValueError(f"Shared span must be at least {required:.1f} to include every captured cell")
    aa, width, row_height, header, footer = 2, 1280, 630, 128, 82
    image = Image.new("RGB", (width * aa, (header + row_height * len(rows) + footer) * aa), "#f7f8f6")
    draw = ImageDraw.Draw(image)
    def text(x, y, value, size=17, fill="#263634"):
        draw.text((int(x * aa), int(y * aa)), value, font=font(size * aa), fill=fill)
    text(28, 20, title, 27)
    text(28, 61, "Saved selected bodies only — not a whole-world comparison. Identical scale in every panel.", 17)
    text(28, 87, f"Panel width {span:g} world units · circles have 4-unit radius · colors are saved biological hue.", 16)
    panel_size, lefts = 480, [54, 694]
    scale = panel_size / span
    for row, (label, panels) in enumerate(rows):
        top = header + row * row_height
        text(28, top, textwrap.shorten(label, width=105, placeholder="…"), 22)
        for column, (selection, heading) in enumerate([("largest", "Largest captured body"), ("largest-moving", "Largest-moving captured body")]):
            left = lefts[column]
            text(left, top + 35, heading, 19)
            box_top = top + 103
            draw.rectangle((left * aa, box_top * aa, (left + panel_size) * aa, (box_top + panel_size) * aa), fill="white", outline="#d3dbd7", width=aa)
            body = panels.get(selection)
            if body is None:
                message = "No separate body captured for this selection."
            elif "omitted" in body:
                message = f"{body['size']:,} cells: {body['omitted']}"
            else:
                message = None
                text(left, top + 63, f"{body['size']:,} cells · {body['branches']} branch nodes · {body['leaves']} leaves", 16)
                text(left, top + 84, f"Speed {body['speed']:.2f} · velocity coherence {body['velocityCoherence']:.2f} · {body['genomeSlots']} genome slot(s)", 15)
                def project(slot):
                    x, y = body["xy"][slot]
                    return ((left + panel_size / 2 + x * scale) * aa,
                            (box_top + panel_size / 2 - y * scale) * aa)
                for c in body["cells"]:
                    for other in c["links"]:
                        if c["slot"] < other:
                            draw.line((*project(c["slot"]), *project(other)), fill="#718c83", width=aa)
                radius = 4 * scale * aa
                for c in body["cells"]:
                    x, y = project(c["slot"])
                    color = tuple(round(v * 255) for v in colorsys.hls_to_rgb((c["hue"] % 360) / 360, 0.47, 0.7))
                    draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=color)
            if message:
                for n, line in enumerate(textwrap.wrap(message, width=40)):
                    text(left + 20, box_top + 200 + n * 24, line, 18, "#66716c")
            bar = 10 ** math.floor(math.log10(span / 5))
            if 5 * bar <= span / 4:
                bar *= 5
            elif 2 * bar <= span / 4:
                bar *= 2
            x0, y0 = left + 16, box_top + panel_size + 19
            draw.line((x0 * aa, y0 * aa, (x0 + bar * scale) * aa, y0 * aa), fill="#263634", width=2 * aa)
            text(x0 + bar * scale + 8, y0 - 13, f"{bar:g} units", 13)
    y = header + row_height * len(rows) + 7
    text(28, y, "Body positions are unwrapped through reciprocal links. Missing and oversized captures are explicit; no cells are invented.", 16)
    text(28, y + 25, "Motion, branching and hue do not establish coordination, adaptive behavior or complexity. Source hashes are in the sidecar JSON.", 15)
    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    image.resize((width, image.height // aa), Image.Resampling.LANCZOS).save(output)
    metadata = {"title": title, "span": span, "cellRadius": 4, "sources": sources,
                "scope": "Selected saved colonies; not whole-world coverage. Shared scale; no image-specific zoom or synthesized cells."}
    output.with_suffix(output.suffix + ".json").write_text(json.dumps(metadata, indent=2) + "\n")
    return metadata


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("inputs", nargs="+", help="snapshot path or label=path (.json or .json.gz)")
    parser.add_argument("--out", required=True, help="output PNG path; also writes a provenance JSON sidecar")
    parser.add_argument("--title", default="Selected colony snapshots")
    parser.add_argument("--span", type=float, help="shared panel width in world units; must fit all bodies")
    args = parser.parse_args()
    if len(args.inputs) > 12:
        parser.error("Use at most 12 snapshots per sheet")
    info = render(args.inputs, args.out, args.title, args.span)
    print(json.dumps({"path": str(Path(args.out).resolve()), "span": info["span"], "snapshots": len(info["sources"])}))


if __name__ == "__main__":
    main()
