"""Embed an editable, self-contained handwriting font subset in README SVGs.

Requires fonttools and brotli. Pass Excalifont then Xiaolai font files;
see docs/assets/readme/fonts/README.md for their sources and hashes.
"""
from pathlib import Path
import base64
import hashlib
import io
import re
import sys
import xml.etree.ElementTree as ET
from html import escape

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "docs/assets/readme"
def embed(font_paths: list[Path]) -> None:
    for svg in sorted(ASSETS.glob("*.svg")):
        source = svg.read_text(encoding="utf-8")
        tree = ET.fromstring(source)
        texts = ["".join(node.itertext()) for node in tree.iter("{http://www.w3.org/2000/svg}text")]
        characters = set("".join(texts)) - set("\r\n\t")
        css_rules, notices, remaining = [], [], characters.copy()
        size = 0
        for font_path, family, suffix in zip(font_paths, ["Excalifont", "Xiaolai"], ["Latin", "CJK"]):
            font = TTFont(font_path, recalcTimestamp=False)
            selected = remaining & set(map(chr, font.getBestCmap()))
            remaining -= selected
            if not selected:
                continue
            options = subset.Options()
            options.drop_tables += ["FFTM"]
            options.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14, 16, 17]
            options.name_legacy = True
            options.name_languages = [0x409]
            subsetter = subset.Subsetter(options=options)
            subsetter.populate(text="".join(sorted(selected)))
            subsetter.subset(font)
            for record in font["name"].names:
                if record.nameID in (1, 3, 4, 6, 16):
                    value = f"GResumeSketch{suffix}-Regular" if record.nameID == 6 else f"GResume Sketch {suffix}"
                    record.string = value.encode(record.getEncoding())
            font.flavor = "woff2"
            output = io.BytesIO()
            font.save(output)
            size += len(output.getvalue())
            encoded = base64.b64encode(output.getvalue()).decode("ascii")
            css_family = f"{family}-{svg.stem}"
            css_rules.append(f"      @font-face {{ font-family: '{css_family}'; font-style: normal; font-weight: 400; "
                             f"src: url(data:font/woff2;base64,{encoded}) format('woff2'); }}")
            license_text = (ASSETS / f"fonts/OFL-{family}.txt").read_text(encoding="utf-8-sig")
            notices.append(f"Subset of {family}; internal name GResume Sketch {suffix}.\n{license_text}")
        if remaining:
            raise ValueError(f"{svg.name}: missing glyphs {''.join(sorted(remaining))!r}")
        css_rules.append(f"      .diagram-{svg.stem} text {{ font-family: 'Excalifont-{svg.stem}', 'Xiaolai-{svg.stem}'; font-weight: 400; }}")
        css = ('<!-- readme-font:start -->\n    <metadata id="readme-font-license">'
               + escape("\n\n".join(notices)) + '</metadata>\n    <style>\n'
               + '\n'.join(css_rules) + '\n    </style>\n    <!-- readme-font:end -->')
        source = re.sub(r"\s*<!-- readme-font:start -->.*?<!-- readme-font:end -->", "", source, flags=re.S)
        source = re.sub(r"font-family:[^;]+;", f"font-family: 'Excalifont-{svg.stem}', 'Xiaolai-{svg.stem}';", source)
        if f'class="diagram-{svg.stem}"' not in source:
            source = source.replace("<svg ", f'<svg class="diagram-{svg.stem}" ', 1)
        if "</defs>" not in source:
            source = source.replace("</desc>", "</desc>\n  <defs>\n  </defs>", 1)
        source = source.replace("</defs>", f"    {css}\n  </defs>")
        source = "\n".join(line.rstrip() for line in source.splitlines()) + "\n"
        svg.write_text(source, encoding="utf-8", newline="\n")
        print(f"{svg.name}: {len(characters)} characters, {size} font bytes")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("Usage: python scripts/embed-readme-fonts.py Excalifont-Regular.woff2 Xiaolai-Regular.ttf")
    font_paths = [Path(arg) for arg in sys.argv[1:]]
    for font_path in font_paths:
        print(f"{font_path.name} SHA-256: {hashlib.sha256(font_path.read_bytes()).hexdigest()}")
    embed(font_paths)
