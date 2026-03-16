from PIL import Image
from pathlib import Path
import sys

SUPPORTED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff"}
MAX_IMAGES = 16


def pad_image_to_square(input_path: Path, output_path: Path) -> None:
    img = Image.open(input_path).convert("RGBA")

    width, height = img.size
    side = max(width, height)

    # Transparent square canvas
    square = Image.new("RGBA", (side, side), (0, 0, 0, 0))

    # Center original image
    x = (side - width) // 2
    y = (side - height) // 2
    square.paste(img, (x, y), img)

    # Always save as PNG to preserve transparency
    output_path = output_path.with_suffix(".png")
    square.save(output_path)


def process_folder(input_folder: str, output_folder: str) -> None:
    input_dir = Path(input_folder)
    output_dir = Path(output_folder)

    if not input_dir.exists() or not input_dir.is_dir():
        print(
            f"Error: input folder does not exist or is not a folder: {input_dir}")
        sys.exit(1)

    output_dir.mkdir(parents=True, exist_ok=True)

    images = [
        p for p in sorted(input_dir.iterdir())
        if p.is_file() and p.suffix.lower() in SUPPORTED_EXTENSIONS
    ]

    if not images:
        print("No supported images found in input folder.")
        return

    if len(images) > MAX_IMAGES:
        print(
            f"Error: found {len(images)} images. Guard-rail allows at most {MAX_IMAGES}.")
        sys.exit(1)

    for image_path in images:
        output_path = output_dir / image_path.name

        # Do not overwrite existing files
        output_path = output_path.with_suffix(".png")
        if output_path.exists():
            print(f"Skipping existing file: {output_path.name}")
            continue

        pad_image_to_square(image_path, output_path)
        print(f"Saved: {output_path.name}")

    print("Done.")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python pad_to_square_folder.py <input_folder> <output_folder>")
        sys.exit(1)

    input_folder = sys.argv[1]
    output_folder = sys.argv[2]

    process_folder(input_folder, output_folder)
