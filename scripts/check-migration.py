"""Check built bodies against the public-source inventory (beautifulsoup4)."""
import hashlib
import json
import re
from pathlib import Path
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
inventory = json.loads((ROOT / "docs/reference/migration-inventory.json").read_text(encoding="utf-8"))
published_posts = [
    post for post in (ROOT / "src/content/posts").glob("*.md")
    if re.search(r"^draft:\s*false\s*$", post.read_text(encoding="utf-8").split("---", 2)[1], re.M)
]
assert len(published_posts) == inventory["postCount"] == 29
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
    # Shiki spans are presentation only; do not insert spaces between tokens.
    for pre in body.find_all("pre"):
        original_code = pre.get_text()
        pre.clear()
        pre.append(original_code)
    text = re.sub(r"\s+", " ", body.get_text(" ", strip=True)).strip()
    assert hashlib.sha256(text.encode()).hexdigest() == page["normalizedTextSha256"], page["path"] + " text"
    code = [hashlib.sha256(pre.get_text().replace("\r\n", "\n").encode()).hexdigest() for pre in body.find_all("pre")]
    assert code == page["codeSha256"], page["path"] + " code"
    count += len(code)
    assert not body.select("script, form, iframe, object, embed")
    for node in body.find_all(True):
        assert not any(a.lower().startswith("on") for a in node.attrs)
    for image in body.find_all("img"):
        assert image["src"].startswith(("/images/bearblog/", "/diagrams/plantuml/"))
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
configured_lang = re.search(r'lang:\s*"([^"]+)"', (ROOT / "astro-paper.config.ts").read_text(encoding="utf-8")).group(1)
assert soup.html["lang"] == configured_lang
print(f"PASS: 29 posts + About, {count} code blocks, {len(inventory['images'])} images; text/code/date/title, links, redirects, safe body and search assets")
