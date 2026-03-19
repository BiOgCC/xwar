"""
generate_reinforced.py
Generates "reinforced" item variants with procedural lightning / thunder
effects rendered behind each item sprite.

Usage:
    python scripts/generate_reinforced.py

Output files land in public/assets/items/reinforced_<original>.png
"""

import os
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

# ---------------------------------------------------------------------------
# CONFIG
# ---------------------------------------------------------------------------
ITEMS_DIR = Path(__file__).resolve().parent.parent / "public" / "assets" / "items"

# Only process t3-t6 gear + ammo
PREFIXES = ("t3_", "t4_", "t5_", "t6_", "ammo_")

# Lightning visual parameters
BOLT_COUNT_RANGE = (5, 8)        # number of main bolts per image
BRANCH_PROBABILITY = 0.35        # chance a segment spawns a branch
BRANCH_DEPTH_MAX = 3             # max recursion depth for branches
SEGMENT_LENGTH_RANGE = (12, 30)  # pixels per segment
JITTER_RANGE = (-14, 14)         # lateral jitter per segment
BOLT_SEGMENTS_RANGE = (8, 18)    # segments per main bolt

# Colors
CORE_COLOR = (180, 230, 255, 255)     # bright white-blue core
GLOW_COLOR_INNER = (0, 180, 255, 160) # cyan inner glow
GLOW_COLOR_OUTER = (0, 120, 255, 80)  # blue outer glow
AURA_COLOR = (0, 160, 255, 55)        # soft radial aura

# Line widths
CORE_WIDTH = 2
INNER_GLOW_WIDTH = 5
OUTER_GLOW_WIDTH = 9


# ---------------------------------------------------------------------------
# LIGHTNING GENERATION
# ---------------------------------------------------------------------------
def generate_bolt_points(start, angle_deg, segments, seg_len_range, jitter_range):
    """Return a list of (x, y) points forming one jagged lightning bolt."""
    points = [start]
    angle_rad = math.radians(angle_deg)
    dx = math.cos(angle_rad)
    dy = math.sin(angle_rad)

    for _ in range(segments):
        seg_len = random.uniform(*seg_len_range)
        jitter = random.uniform(*jitter_range)
        # perpendicular direction for jitter
        px, py = -dy, dx
        nx = points[-1][0] + dx * seg_len + px * jitter
        ny = points[-1][1] + dy * seg_len + py * jitter
        points.append((nx, ny))
    return points


def draw_bolt(draw, points, core_color, glow_inner, glow_outer,
              core_w, inner_w, outer_w):
    """Draw a single bolt as three layered passes (outer glow → inner → core)."""
    for width, color in [
        (outer_w, glow_outer),
        (inner_w, glow_inner),
        (core_w, core_color),
    ]:
        for i in range(len(points) - 1):
            draw.line([points[i], points[i + 1]], fill=color, width=width)


def generate_branches(draw, points, angle_deg, depth, seg_len_range, jitter_range):
    """Recursively generate and draw branches off a bolt."""
    if depth >= BRANCH_DEPTH_MAX:
        return

    for i in range(2, len(points) - 1):
        if random.random() < BRANCH_PROBABILITY:
            # Branch off at an angle
            branch_angle = angle_deg + random.choice([-1, 1]) * random.uniform(20, 50)
            branch_segs = random.randint(3, max(4, len(points) // 2))
            branch_seg_range = (seg_len_range[0] * 0.7, seg_len_range[1] * 0.7)
            branch_jitter = (jitter_range[0] * 0.6, jitter_range[1] * 0.6)

            branch_pts = generate_bolt_points(
                points[i], branch_angle, branch_segs,
                branch_seg_range, branch_jitter
            )

            # Draw branch slightly thinner / more transparent
            branch_core = (*core_color[:3], max(80, core_color[3] - 60))
            branch_inner = (*glow_inner[:3], max(40, glow_inner[3] - 60))
            branch_outer = (*glow_outer[:3], max(20, glow_outer[3] - 40))
            draw_bolt(draw, branch_pts,
                      branch_core, branch_inner, branch_outer,
                      max(1, CORE_WIDTH - 1),
                      max(2, INNER_GLOW_WIDTH - 2),
                      max(3, OUTER_GLOW_WIDTH - 3))

            generate_branches(draw, branch_pts, branch_angle, depth + 1,
                              branch_seg_range, branch_jitter)


# Use module-level constants for branch colors
core_color = CORE_COLOR
glow_inner = GLOW_COLOR_INNER
glow_outer = GLOW_COLOR_OUTER


def create_lightning_layer(width, height, center):
    """Create a transparent RGBA layer with procedural lightning bolts."""
    layer = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)

    bolt_count = random.randint(*BOLT_COUNT_RANGE)

    for b in range(bolt_count):
        # Distribute bolts evenly around 360°, with some random offset
        base_angle = (360 / bolt_count) * b
        angle = base_angle + random.uniform(-25, 25)
        segments = random.randint(*BOLT_SEGMENTS_RANGE)

        points = generate_bolt_points(
            center, angle, segments,
            SEGMENT_LENGTH_RANGE, JITTER_RANGE
        )

        draw_bolt(draw, points,
                  CORE_COLOR, GLOW_COLOR_INNER, GLOW_COLOR_OUTER,
                  CORE_WIDTH, INNER_GLOW_WIDTH, OUTER_GLOW_WIDTH)

        generate_branches(draw, points, angle, 0,
                          SEGMENT_LENGTH_RANGE, JITTER_RANGE)

    return layer


def create_aura_layer(width, height, center, item_mask):
    """Create a soft radial glow layer that sits behind the item."""
    aura = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(aura)

    # Determine the item's bounding box from its alpha mask
    bbox = item_mask.getbbox()
    if bbox is None:
        return aura

    item_w = bbox[2] - bbox[0]
    item_h = bbox[3] - bbox[1]
    radius = int(max(item_w, item_h) * 0.55)

    # Draw concentric circles with decreasing alpha for a soft glow
    steps = 30
    for i in range(steps):
        r = int(radius * (1 - i / steps) + radius * 0.4)
        alpha = int(AURA_COLOR[3] * (1 - i / steps))
        color = (*AURA_COLOR[:3], alpha)
        x0 = center[0] - r
        y0 = center[1] - r
        x1 = center[0] + r
        y1 = center[1] + r
        draw.ellipse([x0, y0, x1, y1], fill=color)

    # Blur for softness
    aura = aura.filter(ImageFilter.GaussianBlur(radius=12))
    return aura


def process_item(filepath):
    """Generate a reinforced version of a single item image."""
    item = Image.open(filepath).convert("RGBA")
    width, height = item.size

    # Find the item center based on its visible (non-transparent) pixels
    alpha = item.split()[3]
    bbox = alpha.getbbox()
    if bbox:
        cx = (bbox[0] + bbox[2]) // 2
        cy = (bbox[1] + bbox[3]) // 2
    else:
        cx, cy = width // 2, height // 2

    center = (cx, cy)

    # Build layers
    canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))

    # 1) Aura glow behind item
    aura = create_aura_layer(width, height, center, alpha)
    canvas = Image.alpha_composite(canvas, aura)

    # 2) Lightning bolts
    lightning = create_lightning_layer(width, height, center)
    # Blur slightly for a more natural electric glow
    lightning_blurred = lightning.filter(ImageFilter.GaussianBlur(radius=2))
    canvas = Image.alpha_composite(canvas, lightning_blurred)
    # Add the sharp lightning on top too for crispness
    canvas = Image.alpha_composite(canvas, lightning)

    # 3) Original item on top
    canvas = Image.alpha_composite(canvas, item)

    # 4) Optional: add a subtle bright edge outline for extra pop
    # Create edge highlight from the item alpha
    edge_layer = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    # Dilate the alpha slightly and subtract original to get edge
    dilated = alpha.filter(ImageFilter.MaxFilter(3))
    edge = Image.eval(dilated, lambda x: x)
    # XOR-style: edge where dilated has pixels but original doesn't
    edge_pixels = []
    alpha_data = list(alpha.getdata())
    dilated_data = list(edge.getdata())
    for a, d in zip(alpha_data, dilated_data):
        if d > 20 and a < 20:
            edge_pixels.append(80)
        else:
            edge_pixels.append(0)
    edge_mask = Image.new("L", (width, height))
    edge_mask.putdata(edge_pixels)
    edge_mask = edge_mask.filter(ImageFilter.GaussianBlur(radius=1))

    # Apply edge glow in cyan
    edge_color = Image.new("RGBA", (width, height), (100, 200, 255, 0))
    edge_draw = ImageDraw.Draw(edge_color)
    # Use the edge mask as alpha
    r, g, b, _ = edge_color.split()
    edge_color = Image.merge("RGBA", (r, g, b, edge_mask))
    canvas = Image.alpha_composite(canvas, edge_color)

    return canvas


# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------
def main():
    if not ITEMS_DIR.exists():
        print(f"ERROR: Items directory not found: {ITEMS_DIR}")
        return

    # Gather files to process
    files = sorted([
        f for f in ITEMS_DIR.iterdir()
        if f.suffix.lower() == ".png"
        and any(f.name.startswith(p) for p in PREFIXES)
    ])

    if not files:
        print("No matching item files found.")
        return

    print(f"Found {len(files)} items to process:")
    for f in files:
        print(f"  - {f.name}")

    print()
    processed = 0
    for f in files:
        out_name = f"reinforced_{f.name}"
        out_path = ITEMS_DIR / out_name

        print(f"Processing {f.name} -> {out_name} ...", end=" ")
        try:
            result = process_item(f)
            result.save(out_path, "PNG")
            print("OK")
            processed += 1
        except Exception as e:
            print(f"FAILED: {e}")

    print(f"\nDone! {processed}/{len(files)} reinforced items generated in:")
    print(f"  {ITEMS_DIR}")


if __name__ == "__main__":
    main()
