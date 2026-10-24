"""通信：画面ファイルの配信と、参加のやり取り"""
import base64

from fastapi.testclient import TestClient

from server import config as C
from server.network import app


def test_serves_page_and_modules():
    with TestClient(app) as client:
        r = client.get("/")
        assert r.status_code == 200 and "ブロック防衛線" in r.text
        r = client.get("/js/main.js")
        assert r.status_code == 200 and "javascript" in r.headers["content-type"]
        assert client.get("/css/style.css").status_code == 200


def test_join_gets_welcome_world_and_snapshot():
    with TestClient(app) as client:
        with client.websocket_connect("/ws") as ws:
            ws.send_json({"t": "join", "name": "テスト"})
            welcome = ws.receive_json()
            assert welcome["t"] == "welcome" and welcome["name"] == "テスト"
            world = ws.receive_json()
            assert world["t"] == "world" and len(base64.b64decode(world["data"])) == C.W * C.H * C.D
            for _ in range(10):                     # 参加のお知らせのあと、状態（snap）が届く
                m = ws.receive_json()
                if m["t"] == "snap":
                    assert m["game"]["phase"] == "lobby"
                    assert m["players"][0]["name"] == "テスト"
                    break
            else:
                raise AssertionError("snap が届かない")


def test_first_message_must_be_join():
    with TestClient(app) as client:
        with client.websocket_connect("/ws") as ws:
            ws.send_json({"t": "shoot"})
            try:
                ws.receive_json()
                assert False, "接続が閉じられるはず"
            except Exception:
                pass
