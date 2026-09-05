from __future__ import annotations
import json as _json
from urllib import error, parse, request

def http_client():
    return _UrllibClient()

class _CompatResponse:

    def __init__(self, status_code: int, body: bytes, headers):
        self.status_code = status_code
        self.content = body
        self.headers = headers
        self.text = body.decode('utf-8', 'replace')

    def json(self):
        return _json.loads(self.text)

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            raise RuntimeError(f'HTTP {self.status_code}: {self.text[:300]}')

class _CompatSession:

    def __init__(self):
        self.headers = {}

    def get(self, url: str, **kwargs):
        return _request('GET', url, default_headers=self.headers, **kwargs)

    def post(self, url: str, **kwargs):
        return _request('POST', url, default_headers=self.headers, **kwargs)

    def put(self, url: str, **kwargs):
        return _request('PUT', url, default_headers=self.headers, **kwargs)

class _UrllibClient:
    Session = _CompatSession

    @staticmethod
    def get(url: str, **kwargs):
        return _request('GET', url, **kwargs)

    @staticmethod
    def post(url: str, **kwargs):
        return _request('POST', url, **kwargs)

    @staticmethod
    def put(url: str, **kwargs):
        return _request('PUT', url, **kwargs)

def _request(method: str, url: str, *, default_headers: dict[str, str] | None, headers: dict[str, str] | None, data, json, params, timeout: float | None, **_kwargs):
    if params:
        query = parse.urlencode(params)
        separator = '&' if '?' in url else '?'
        url = f'{url}{separator}{query}'
    merged_headers = dict(default_headers or {})
    merged_headers.update(headers or {})
    body = None
    if json is not None:
        body = _json.dumps(json).encode('utf-8')
        merged_headers.setdefault('Content-Type', 'application/json')
    elif isinstance(data, dict):
        body = parse.urlencode(data).encode('utf-8')
        merged_headers.setdefault('Content-Type', 'application/x-www-form-urlencoded')
    elif isinstance(data, str):
        body = data.encode('utf-8')
    elif data is not None:
        body = data
    req = request.Request(url, data=body, headers=merged_headers, method=method)
    try:
        with request.urlopen(req, timeout=timeout) as resp:
            pass
    except error.HTTPError as exc:
        return _CompatResponse(exc.code, exc.read(), exc.headers)