"""Import public Bear Blog HTML without executing it.

Requires beautifulsoup4. Pass a snapshot directory outside the checkout.
Snapshots are retained there for independent source/rendered-body verification.
"""
import argparse
import hashlib
import json
import re
import shutil
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen
from bs4 import BeautifulSoup, Comment

ROOT = Path(__file__).resolve().parents[1]
ORIGIN = "https://blog.zrhe2016.cc"


def fetch(url):
    with urlopen(Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=60) as response:
        return response.read()


def normalized(node):
    return re.sub(r"\s+", " ", node.get_text(" ", strip=True)).strip()


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("snapshot", type=Path)
    args = parser.parse_args()
    args.snapshot.mkdir(parents=True, exist_ok=True)
    home = fetch(ORIGIN + "/")
    (args.snapshot / "index.html").write_bytes(home)
    soup = BeautifulSoup(home, "html.parser")
    entries = []
    for item in soup.select("ul.blog-posts li"):
        link, time = item.find("a"), item.find("time")
        entries.append({"path": link["href"], "title": link.get_text(strip=True), "date": time["datetime"]})
    assert len(entries) == 29 and len({e["path"] for e in entries}) == 29
    pages = entries + [{"path": "/about-me/", "title": "关于我"}]
    with ThreadPoolExecutor(max_workers=6) as pool:
        html_pages = list(pool.map(lambda e: fetch(ORIGIN + e["path"]), pages))
    mapping = {e["path"]: "/posts/" + e["path"].strip("/") + "/" for e in entries}
    mapping.update({"/blog/": "/posts/", "/about-me/": "/about/", "/feed/": "/rss.xml"})
    posts = ROOT / "src/content/posts"
    shutil.rmtree(posts)
    posts.mkdir()
    inventory, images, links = [], {}, set()
    for entry, raw in zip(pages, html_pages):
        slug = entry["path"].strip("/")
        (args.snapshot / (slug + ".html")).write_bytes(raw)
        page = BeautifulSoup(raw, "html.parser")
        body = page.find("main")
        tags = [a.get_text(strip=True).lstrip("#") for a in body.select('a[href*="?q="]')]
        for tag in body.select('p:has(a[href*="?q="])'):
            tag.decompose()
        if "date" in entry:
            assert body.find("h1").get_text(strip=True) == entry["title"]
            assert body.find("time")["datetime"] == entry["date"]
            body.find("h1").decompose()
            body.find("time").find_parent("p").decompose()
        for unwanted in body.select("script, style, form, iframe, object, embed, input, button"):
            unwanted.decompose()
        for comment in body.find_all(string=lambda s: isinstance(s, Comment)):
            comment.extract()
        source_text = normalized(body)
        source_code = [pre.get_text().replace("\r\n", "\n") for pre in body.find_all("pre")]
        # A standalone pre starts a CommonMark raw block that preserves blank lines.
        for highlight in body.select("div.highlight"):
            highlight.unwrap()
        for node in body.find_all(True):
            for attr in list(node.attrs):
                if attr.lower().startswith("on") or attr in ("style", "srcdoc"):
                    del node[attr]
            for attr in ("href", "src"):
                if not node.get(attr):
                    continue
                value = node[attr]
                if value.lower().strip().startswith(("javascript:", "data:text/html", "vbscript:")):
                    del node[attr]
                    continue
                absolute = urljoin(ORIGIN + entry["path"], value)
                parsed = urlparse(absolute)
                if attr == "href":
                    if parsed.netloc in ("blog.zrhe2016.cc", "zrhe2016.bearblog.dev"):
                        path = parsed.path.rstrip("/") + "/"
                        if path in mapping:
                            node[attr] = mapping[path] + ("#" + parsed.fragment if parsed.fragment else "")
                        elif path == "/":
                            node[attr] = "/" + ("#" + parsed.fragment if parsed.fragment else "")
                        else:
                            links.add(absolute)
                            node[attr] = absolute
                    elif not value.startswith(("mailto:", "tel:", "#")):
                        node[attr] = absolute
                elif node.name == "img":
                    if absolute not in images:
                        data = fetch(absolute)
                        suffix = Path(parsed.path).suffix.lower() or ".png"
                        name = hashlib.sha256(data).hexdigest()[:20] + suffix
                        target = ROOT / "public/images/bearblog" / name
                        target.parent.mkdir(parents=True, exist_ok=True)
                        target.write_bytes(data)
                        images[absolute] = "/images/bearblog/" + name
                    node[attr] = images[absolute]
                    node.attrs.pop("srcset", None)
        assert normalized(body) == source_text
        assert [pre.get_text().replace("\r\n", "\n") for pre in body.find_all("pre")] == source_code
        content = body.decode_contents().strip()
        content = re.sub(r"(<pre\b)", r"\n\n\1", content)
        content = content.replace("</pre>", "</pre>\n\n")
        metadata = {"title": entry["title"], "description": source_text[:160]}
        if "date" in entry:
            metadata.update(pubDatetime=entry["date"].replace("Z", ":00Z"), tags=tags, draft=False)
            target = posts / (slug + ".md")
            route = mapping[entry["path"]]
        else:
            target = ROOT / "src/content/pages/about.md"
            route = "/about/"
        frontmatter = "\n".join(k + ": " + (v if k == "pubDatetime" else json.dumps(v, ensure_ascii=False)) for k, v in metadata.items())
        target.write_text("---\n" + frontmatter + "\n---\n\n" + content + "\n", encoding="utf-8")
        inventory.append({**entry, "target": str(target.relative_to(ROOT)).replace("\\", "/"), "route": route, "tags": tags, "normalizedTextSha256": digest(source_text), "codeSha256": [digest(c) for c in source_code], "sourceHtmlSha256": hashlib.sha256(raw).hexdigest()})
    redirects = []
    for source, target in mapping.items():
        redirects.extend([f"{source} {target} 301", f"{source.rstrip('/')} {target} 301"])
    (ROOT / "public/_redirects").write_text("\n".join(redirects) + "\n", encoding="utf-8")
    evidence = {"source": ORIGIN, "postCount": len(entries), "pages": inventory, "images": images, "unmappedInternalLinks": sorted(links)}
    (ROOT / "docs/reference/migration-inventory.json").write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"posts": len(entries), "images": len(images), "unmappedInternalLinks": sorted(links)}))


if __name__ == "__main__":
    main()
