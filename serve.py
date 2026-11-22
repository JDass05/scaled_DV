import http.server
import socketserver
import urllib.request
import urllib.error
import os
import sys

PORT = 8080
DIRECTORY = os.path.join(os.path.dirname(os.path.abspath(__file__)), "website")
TARGET_RENDER = "https://scaled-dv.onrender.com"

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()

    def do_GET(self):
        if self.path.startswith('/api/'):
            # Proxy to Render
            render_path = self.path[4:]  # Remove '/api' prefix
            target_url = TARGET_RENDER + render_path
            try:
                req = urllib.request.Request(
                    target_url,
                    headers={'User-Agent': 'Aahar-Local-Proxy/1.0'}
                )
                with urllib.request.urlopen(req, timeout=45) as resp:
                    content = resp.read()
                    status = resp.status
                    content_type = resp.headers.get('Content-Type', 'application/json')

                self.send_response(status)
                self.send_header('Content-Type', content_type)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Length', str(len(content)))
                self.end_headers()
                self.wfile.write(content)
            except urllib.error.HTTPError as e:
                err_content = e.read()
                self.send_response(e.code)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Length', str(len(err_content)))
                self.end_headers()
                self.wfile.write(err_content)
            except Exception as e:
                msg = f'{{"error": "{str(e)}"}}'.encode('utf-8')
                self.send_response(502)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Length', str(len(msg)))
                self.end_headers()
                self.wfile.write(msg)
            return

        # Redirect root / to login.html
        if self.path == '/' or self.path == '':
            self.send_response(302)
            self.send_header('Location', '/login.html')
            self.end_headers()
            return

        return super().do_GET()

if __name__ == '__main__':
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), CustomHandler) as httpd:
        print(f"Aahar Web Server running at http://localhost:{PORT}")
        print(f"Static directory: {DIRECTORY}")
        print(f"Proxying /api/* -> {TARGET_RENDER}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
