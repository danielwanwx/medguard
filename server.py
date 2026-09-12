"""Minimal HTTP server exposing the real MedGuard Strands agent to the UI.
POST /api/medcheck {scan, profile:{meds:[],conditions:[]}} -> {answer, tools, identity, recall, interactions, dosage, tool_trace}
Run: AWS_PROFILE=missing20-sandbox AWS_REGION=us-west-2 the-missing-20/.venv/bin/python medguard/server.py [port]
"""
from __future__ import annotations
import json, sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
sys.path.insert(0, __file__.rsplit("/", 1)[0])
from agent import run_medguard

class H(BaseHTTPRequestHandler):
    def _send(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
    def do_OPTIONS(self): self._send(204, {})
    def do_GET(self):
        if self.path == "/": self._send(200, {"ok": True, "service": "medguard"})
        else: self._send(404, {"error": "not found"})
    def do_POST(self):
        if self.path != "/api/medcheck":
            return self._send(404, {"error": "not found"})
        try:
            n = int(self.headers.get("Content-Length", 0))
            payload = json.loads(self.rfile.read(n) or b"{}")
            scan = str(payload.get("scan", "")).strip()
            profile = payload.get("profile") or {"meds": [], "conditions": []}
            if not scan:
                return self._send(400, {"error": "scan required"})
            result = run_medguard(scan, profile)
            self._send(200, result)
        except Exception as e:
            self._send(500, {"error": str(e)[:200]})
    def log_message(self, *a): pass

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8910
    print(f"MedGuard server on http://127.0.0.1:{port}")
    ThreadingHTTPServer(("127.0.0.1", port), H).serve_forever()
