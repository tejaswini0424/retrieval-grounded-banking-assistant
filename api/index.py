from functools import lru_cache
from urllib.parse import parse_qs, urlsplit

from app import DATABASE_URL, Handler, initialize


@lru_cache(maxsize=1)
def initialize_once():
    initialize()


class handler(Handler):
    def prepare_api(self):
        request = urlsplit(self.path)
        self.path = request.path
        if self.path == "/api/index":
            route = parse_qs(request.query).get("bank_route", [""])[-1]
            self.path = "/api/" + route
        if self.path == "/api/sources":
            return True
        if not DATABASE_URL:
            self.fail(503, "The deployment database has not been configured.")
            return False
        initialize_once()
        return True

    def do_GET(self):
        if self.prepare_api():
            super().do_GET()

    def do_POST(self):
        if self.prepare_api():
            super().do_POST()
