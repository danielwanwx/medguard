"""Same-origin HTTP entry point for the request-local MedGuard evidence workflow.

POST /api/medcheck {scan, profile:{meds:[],conditions:[]}, selected_id?}
"""
from __future__ import annotations

import json
import socket
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from agent import RequestValidationError, run_medguard, validate_medcheck_payload


MAX_BODY_BYTES = 16 * 1024


class H(BaseHTTPRequestHandler):
    server_version = "MedGuard/1"

    def setup(self) -> None:
        super().setup()
        self.connection.settimeout(60)

    def _send(self, code: int, obj: dict[str, Any]) -> None:
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _error(self, code: int, error_code: str, message: str) -> None:
        self._send(code, {"error": {"code": error_code, "message": message}})

    def _origin_allowed(self) -> bool:
        origin = self.headers.get("Origin")
        if origin is None:
            return True  # non-browser local checks; browser requests send Origin.
        host = self.headers.get("Host", "")
        allowed = {
            f"http://{host}",
            "http://127.0.0.1:5173",
            "http://localhost:5173",
            "http://127.0.0.1:5175",
            "http://localhost:5175",
        }
        return origin in allowed

    def do_OPTIONS(self) -> None:
        # The UI is served on the same origin; intentionally do not enable broad CORS.
        self._error(405, "method_not_allowed", "Use POST for /api/medcheck.")

    def do_GET(self) -> None:
        if self.path == "/":
            self._send(200, {"ok": True, "service": "medguard"})
        else:
            self._error(404, "not_found", "Not found.")

    def do_POST(self) -> None:
        if self.path != "/api/medcheck":
            self._error(404, "not_found", "Not found.")
            return
        if not self._origin_allowed():
            self._error(403, "forbidden_origin", "Cross-origin requests are not allowed.")
            return
        content_type = self.headers.get("Content-Type", "")
        media_type = content_type.split(";", 1)[0].strip().casefold()
        if media_type != "application/json":
            self._error(415, "unsupported_media_type", "Content-Type must be application/json.")
            return
        raw_length = self.headers.get("Content-Length")
        try:
            length = int(raw_length) if raw_length is not None else -1
        except ValueError:
            length = -1
        if length < 0:
            self._error(411, "length_required", "Content-Length is required.")
            return
        if length > MAX_BODY_BYTES:
            self._error(413, "request_too_large", "Request body is too large.")
            return
        try:
            raw = self.rfile.read(length)
            if len(raw) != length:
                self._error(400, "invalid_request", "Request body was incomplete.")
                return
            payload = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError, socket.timeout):
            self._error(400, "invalid_json", "Request body must be valid JSON.")
            return
        try:
            scan, profile, selected_id = validate_medcheck_payload(payload)
            result = run_medguard(scan, profile, selected_id)
        except RequestValidationError as error:
            self._error(400, error.code, error.message)
            return
        except Exception:
            # Do not reflect health content, credentials, provider errors, or tracebacks.
            self._error(503, "service_unavailable", "MedGuard could not start this evidence review. Retry shortly.")
            return

        agent_error = result.get("error") if isinstance(result, dict) else None
        if isinstance(agent_error, dict) and agent_error.get("code") == "authentication_required":
            self._send(503, result)
            return
        self._send(200, result)

    def log_message(self, _format: str, *_args: object) -> None:
        # Health content and request details must not be written to the HTTP access log.
        return


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8910
    print(f"MedGuard server on http://127.0.0.1:{port}")
    ThreadingHTTPServer(("127.0.0.1", port), H).serve_forever()
