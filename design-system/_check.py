#!/usr/bin/env python3
"""Sanity-check every preview page in this folder: tag balance and dead links."""
import pathlib
from html.parser import HTMLParser

VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link",
        "meta", "param", "source", "track", "wbr", "path", "circle", "rect",
        "polygon", "line", "ellipse", "use", "stop"}
ROOT = pathlib.Path(__file__).resolve().parent


class Check(HTMLParser):
    def __init__(self):
        super().__init__()
        self.stack = []
        self.errors = []
        self.links = []

    def handle_starttag(self, tag, attrs):
        d = dict(attrs)
        if tag == "link" and d.get("href", "").startswith((".", "/")):
            self.links.append(d["href"])
        if tag not in VOID:
            self.stack.append((tag, self.getpos()[0]))

    def handle_startendtag(self, tag, attrs):
        pass

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        if not self.stack:
            self.errors.append("line %d: stray </%s>" % (self.getpos()[0], tag))
        elif self.stack[-1][0] != tag:
            self.errors.append("line %d: </%s> closes <%s> opened at line %d"
                               % (self.getpos()[0], tag, self.stack[-1][0], self.stack[-1][1]))
            self.stack.pop()
        else:
            self.stack.pop()


bad = 0
for f in sorted(ROOT.rglob("*.html")):
    p = Check()
    p.feed(f.read_text(encoding="utf-8"))
    errs = list(p.errors)
    errs += ["unclosed <%s> from line %d" % (t, n) for t, n in p.stack]
    errs += ["missing %s" % h for h in p.links if not (f.parent / h).exists()]
    rel = f.relative_to(ROOT).as_posix()
    if errs:
        bad += 1
        print("FAIL %s" % rel)
        for e in errs[:6]:
            print("     " + e)
    else:
        print("ok   %s" % rel)
print("\n%d file(s) with problems" % bad)
