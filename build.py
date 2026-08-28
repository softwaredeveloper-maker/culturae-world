#!/usr/bin/env python3
"""Assemble the deliverables from src/:
  - theme.xml  : Blogger theme (src/theme-template.xml with CSS+JS inlined)
  - site/style.css, site/app.js : copies of the shared assets for the Vercel site
Run:  python3 build.py
"""
import pathlib
import shutil
import sys

ROOT = pathlib.Path(__file__).parent
SRC = ROOT / "src"

css = (SRC / "style.css").read_text(encoding="utf-8")
js = (SRC / "app.js").read_text(encoding="utf-8")
template = (SRC / "theme-template.xml").read_text(encoding="utf-8")

for name, blob in (("style.css", css), ("app.js", js)):
    if "]]>" in blob:
        sys.exit(f"ERROR: {name} contains ']]>' which would break the XML CDATA block")
    if "</script" in blob.lower():
        sys.exit(f"ERROR: {name} contains a literal </script> tag")

theme = template.replace("@@CSS@@", css).replace("@@JS@@", js)
(ROOT / "theme.xml").write_text(theme, encoding="utf-8")

shutil.copy(SRC / "style.css", ROOT / "site" / "style.css")
shutil.copy(SRC / "app.js", ROOT / "site" / "app.js")

print(f"theme.xml            {len(theme):,} bytes")
print("site/style.css       copied")
print("site/app.js          copied")
