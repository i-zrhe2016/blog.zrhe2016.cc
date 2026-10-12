"""Check built bodies against the public-source inventory (beautifulsoup4)."""
import hashlib
import json
import re
from pathlib import Path
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
inventory = json.loads((ROOT / "docs/reference/migration-inventory.json").read_text(encoding="utf-8"))
assert len(list((ROOT / "src/content/posts").glob("*.md"))) == inventory["postCount"] == 29
count = 0
for page in inventory["pages"]:
    built = ROOT / "dist" / page["route"].strip("/") / "index.html"
    soup = BeautifulSoup(built.read_text(encoding="utf-8"), "html.parser")
    if page["route"] == "/about/":
        body = soup.select_one("main.app-prose")
        body.find("h1").decompose()
    else:
        body = soup.select_one("#article")
        assert soup.find("h1").get_text(strip=True) == page["title"]
        assert soup.find("time")["datetime"] == page["date"].replace("Z", ":00.000Z")
    text = re.sub(r"\s+", " ", body.get_text(" ", strip=True)).strip()
    assert hashlib.sha256(text.encode()).hexdigest() == page["normalizedTextSha256"], page["path"] + " text"
    code = [hashlib.sha256(pre.get_text().replace("\r\n", "\n").encode()).hexdigest() for pre in body.find_all("pre")]
    assert code == page["codeSha256"], page["path"] + " code"
    count += len(code)
    assert not body.select("script, form, iframe, object, embed")
    for node in body.find_all(True):
        assert not any(a.lower().startswith("on") for a in node.attrs)
    for image in body.find_all("img"):
        assert image["src"].startswith("/images/bearblog/")
        assert (ROOT / "dist" / image["src"].lstrip("/")).is_file()
    for link in body.select("a[href]"):
        if link["href"].startswith("/"):
            path = link["href"].split("#")[0].split("?")[0]
            assert (ROOT / "dist" / path.lstrip("/")).is_file() or (ROOT / "dist" / path.lstrip("/") / "index.html").is_file(), path
redirects = (ROOT / "dist/_redirects").read_text(encoding="utf-8")
for page in inventory["pages"]:
    assert f'{page["path"]} {page["route"]} 301' in redirects
for old, new in (("/blog/", "/posts/"), ("/feed/", "/rss.xml")):
    assert f"{old} {new} 301" in redirects
assert not inventory["unmappedInternalLinks"]
assert (ROOT / "dist/pagefind/pagefind.js").is_file()
assert soup.html["lang"] == "zh-CN"
print(f"PASS: 29 posts + About, {count} code blocks, {len(inventory['images'])} images; text/code/date/title, links, redirects, safe body and search assets")
