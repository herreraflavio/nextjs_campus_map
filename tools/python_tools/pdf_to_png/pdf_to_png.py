#!/usr/bin/env python3
"""
Convert PDF pages to highest-quality PNGs.

Features:
- Choose resolution by DPI (e.g., 600/1200) or by long-edge pixel size.
- Preserves transparency where present (use --opaque to force white background).
- RGB output (lossless PNG).
- Page range selection and output naming.

Usage examples:
  python pdf_to_png.py input.pdf
  python pdf_to_png.py input.pdf --dpi 600
  python pdf_to_png.py input.pdf --long-edge 8000
  python pdf_to_png.py input.pdf --from 2 --to 10 --outdir ./out --dpi 900
  python pdf_to_png.py input.pdf --opaque --dpi 600
"""

import argparse
import os
import sys
import math
from pathlib import Path

try:
    import fitz  # PyMuPDF
except ImportError as e:
    print("Missing dependency: PyMuPDF. Install with: pip install pymupdf", file=sys.stderr)
    raise

# Optional: Pillow only used for alpha/white flattening path if desired
try:
    from PIL import Image
    PIL_AVAILABLE = True
except Exception:
    PIL_AVAILABLE = False


def compute_scale_from_dpi(dpi: float) -> float:
    # PDF user space = 72 points per inch; scale factor is dpi/72
    return dpi / 72.0


def compute_scale_from_long_edge(page_rect, long_edge_px: int) -> float:
    # page_rect (fitz.Rect) is in points. We want max(width,height) * scale ≈ long_edge_px
    long_edge_pts = max(page_rect.width, page_rect.height)
    if long_edge_pts <= 0:
        return 1.0
    return long_edge_px / float(long_edge_pts)


def render_page_to_png(
    doc_path: Path,
    page_index: int,
    outdir: Path,
    scale: float,
    opaque_white: bool,
    colorspace_rgb=True,
) -> Path:
    """
    Render one page to PNG.
    - page_index is 0-based.
    - scale is a zoom factor (1.0 = 72 DPI; 600 DPI => 600/72).
    """
    # Open doc per call to keep it simple & safe in all environments
    with fitz.open(doc_path) as doc:
        page = doc.load_page(page_index)
        # Select colorspace
        cs = fitz.csRGB if colorspace_rgb else None

        # alpha=True preserves transparency; False flattens (opaque)
        # We'll preserve alpha and optionally flatten with Pillow if requested.
        pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale),
                              colorspace=cs,
                              alpha=True)

    outpath = outdir / f"{doc_path.stem}_p{page_index+1:04d}.png"

    if opaque_white:
        # Flatten over white background if transparency exists
        if not PIL_AVAILABLE:
            # Fallback: Save directly; users can flatten later if needed
            pix.save(outpath.as_posix())
            return outpath

        # Convert PyMuPDF pixmap to Pillow Image, then flatten
        mode = "RGBA" if pix.alpha else "RGB"
        img = Image.frombytes(mode, (pix.width, pix.height), pix.samples)
        if img.mode == "RGBA":
            bg = Image.new("RGBA", img.size, (255, 255, 255, 255))
            bg.paste(img, mask=img.split()[-1])
            img = bg.convert("RGB")
        else:
            img = img.convert("RGB")
        # PNG is lossless; optimize reduces file size (not quality)
        img.save(outpath, format="PNG", optimize=True)
    else:
        # Keep alpha channel if present
        pix.save(outpath.as_posix())

    return outpath


def main():
    ap = argparse.ArgumentParser(
        description="Convert PDF pages to high-quality PNGs.")
    ap.add_argument("pdf", type=Path, help="Input PDF file")
    ap.add_argument("--outdir", type=Path, default=None,
                    help="Output directory (default: ./<pdfname>_pngs)")
    group = ap.add_mutually_exclusive_group()
    group.add_argument("--dpi", type=float, default=600.0,
                       help="Render DPI (default: 600). Common choices: 600, 900, 1200.")
    group.add_argument("--long-edge", type=int, default=None,
                       help="Target long-edge pixel dimension (overrides --dpi), e.g., 8000.")
    ap.add_argument("--from", dest="page_from", type=int, default=1,
                    help="Start page (1-based, inclusive). Default: 1")
    ap.add_argument("--to", dest="page_to", type=int, default=None,
                    help="End page (1-based, inclusive). Default: last page")
    ap.add_argument("--opaque", action="store_true",
                    help="Flatten transparency onto white background.")
    ap.add_argument("--no-rgb", action="store_true",
                    help="Do not force RGB colorspace (rarely needed).")
    args = ap.parse_args()

    if not args.pdf.exists():
        ap.error(f"PDF file not found: {args.pdf}")

    outdir = args.outdir or Path(f"./{args.pdf.stem}_pngs")
    outdir.mkdir(parents=True, exist_ok=True)

    with fitz.open(args.pdf) as doc:
        n_pages = doc.page_count
        p_from = max(1, args.page_from)
        p_to = n_pages if args.page_to is None else min(args.page_to, n_pages)
        if p_from > p_to:
            ap.error(f"Invalid page range: from {p_from} to {p_to}")

        # Compute scale
        if args.long_edge:
            # Use first page to compute scale for the whole doc (consistent sizing)
            first_rect = doc.load_page(0).rect
            scale = compute_scale_from_long_edge(first_rect, args.long_edge)
            # If pages vary a lot in size, you can move this inside the loop per page.
        else:
            scale = compute_scale_from_dpi(args.dpi)

    # Render pages
    print(f"Input:     {args.pdf}")
    print(f"Pages:     {p_from}..{p_to} (of {n_pages})")
    if args.long_edge:
        print(f"Mode:      long-edge {args.long_edge}px (scale={scale:.4f})")
    else:
        print(f"Mode:      {args.dpi:.0f} DPI (scale={scale:.4f})")
    print(
        f"Opaque:    {'yes' if args.opaque else 'no (preserve alpha if present)'}")
    print(f"Out dir:   {outdir.resolve()}")
    print("Rendering...")

    total = 0
    for one_based in range(p_from, p_to + 1):
        idx = one_based - 1
        try:
            out = render_page_to_png(
                doc_path=args.pdf,
                page_index=idx,
                outdir=outdir,
                scale=scale,
                opaque_white=args.opaque,
                colorspace_rgb=not args.no_rgb,
            )
            total += 1
            print(f"  ✓ Page {one_based} -> {out.name}")
        except Exception as e:
            print(f"  ✗ Page {one_based} failed: {e}", file=sys.stderr)

    print(
        f"Done. Successfully wrote {total} PNG file(s) to: {outdir.resolve()}")


if __name__ == "__main__":
    main()
