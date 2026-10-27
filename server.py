#!/usr/bin/env python3
"""Local server for the phone collection landing page.

Why this exists: `python -m http.server` returns a 404 page when the server is
started from the wrong folder or when the browser opens a path such as
`/index` or `/iphone test/`. This server always serves the folder that contains
this file and redirects unknown HTML page routes back to `index.html`, while
real missing assets (images, CSS, JS) still return 404 so mistakes stay visible.

Usage:
    python server.py              # http://127.0.0.1:8000/
    python server.py 9000         # custom starting port
    python server.py --no-browser # do not open the browser
"""

import argparse
import http.server
import os
import sys
import threading
import webbrowser
from urllib.parse import urlsplit

ROOT = os.path.dirname(os.path.abspath(__file__))
INDEX_FILES = ("index.html", "index.htm")


class ProjectHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def _page_route_is_missing(self):
        path = self.translate_path(urlsplit(self.path).path)
        if os.path.isdir(path):
            return not any(
                os.path.exists(os.path.join(path, name)) for name in INDEX_FILES
            )
        return not os.path.exists(path)

    def send_head(self):
        # Browsers send Accept: text/html for page navigations only. A wrong
        # page URL gets redirected to the app; a missing image stays a 404.
        wants_html = "text/html" in self.headers.get("Accept", "")
        if wants_html and self._page_route_is_missing():
            self.send_response(302)
            self.send_header("Location", "/index.html")
            self.send_header("Content-Length", "0")
            self.end_headers()
            return None
        return super().send_head()

    def log_message(self, fmt, *args):
        sys.stdout.write("[%s] %s\n" % (self.log_date_time_string(), fmt % args))
        sys.stdout.flush()


def make_server(host, start_port):
    for port in range(start_port, start_port + 11):
        try:
            return http.server.ThreadingHTTPServer((host, port), ProjectHandler), port
        except OSError:
            continue
    return http.server.ThreadingHTTPServer((host, 0), ProjectHandler), 0


def main():
    parser = argparse.ArgumentParser(description="Serve the landing page locally.")
    parser.add_argument("port", nargs="?", type=int, default=8000, help="starting port")
    parser.add_argument("--host", default="127.0.0.1", help="bind address")
    parser.add_argument("--no-browser", action="store_true", help="do not open a browser")
    args = parser.parse_args()

    server, port = make_server(args.host, args.port)
    url = "http://%s:%d/" % (args.host, port)

    print("Serving folder: %s" % ROOT)
    print("Open: %s" % url)
    print("Press Ctrl+C to stop.")

    if not args.no_browser:
        threading.Timer(0.7, lambda: webbrowser.open(url)).start()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
