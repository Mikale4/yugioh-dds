"""Tiny no-cache static server for the game.  python serve.py [port]  -> http://localhost:8765"""
import http.server, os, sys, functools
port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Expires", "0")
        super().end_headers()
    def log_message(self, *a):
        pass

print("Serving", root, "at http://localhost:%d" % port)
http.server.ThreadingHTTPServer(("", port), functools.partial(H, directory=root)).serve_forever()
