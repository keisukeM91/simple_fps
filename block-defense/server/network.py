"""通信：画面ファイルの配信・WebSocket の受付・1秒に20回の計算と配信"""
import asyncio
import json
import mimetypes
import socket
import time
import traceback
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles

from .config import PORT, SIM_HZ, MAX_PLAYERS, COLORS, CLIENT_DIR
from .entities import Player
from .game import Game
from .util import r3

# Windows では .js が「ただの文字」と判定され、ブラウザが読み込みを拒むことがあるので明示する
mimetypes.add_type("text/javascript", ".js")
mimetypes.add_type("text/css", ".css")

game = Game()

# 端末から届くメッセージの種類と、それを受け持つ処理
HANDLERS = {"state": Game.on_state, "shoot": Game.on_shoot, "place": Game.on_place, "break": Game.on_break,
            "skip": Game.on_skip, "pong": Game.on_pong, "mode": Game.on_mode, "team": Game.on_team,
            "start": Game.on_start}


async def send(ws: WebSocket, data: str):
    try:
        await asyncio.wait_for(ws.send_text(data), timeout=1.0)
    except Exception:
        pass  # 送れなかった相手は、受信側のループで切断処理される


async def broadcast(obj: dict):
    if not game.players:
        return
    data = json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
    await asyncio.gather(*(send(p.ws, data) for p in list(game.players.values())))


async def sim_loop():
    """1秒に SIM_HZ 回、ゲームを進めて全員に配る"""
    dt = 1 / SIM_HZ
    last = time.perf_counter()
    n = 0
    while True:
        await asyncio.sleep(dt)
        now = time.perf_counter()
        step = min(0.1, now - last)
        last = now
        n += 1
        try:
            game.tick(step)
            if game.world_changed:
                game.world_changed = False
                await broadcast(game.world_msg())
            if game.players:
                snap = game.snapshot()
                game.fx = []
                await broadcast(snap)
                if n % (SIM_HZ * 2) == 0:                 # 2秒ごとに通信の往復時間を測る
                    await broadcast({"t": "ping", "s": r3(game.now)})
            else:
                game.fx = []
        except Exception:
            traceback.print_exc()   # 1回の失敗でサーバー全体を止めない


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(sim_loop())
    yield
    task.cancel()


app = FastAPI(lifespan=lifespan)


@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await ws.accept()
    if len(game.players) >= MAX_PLAYERS:
        await ws.send_json({"t": "full"})
        await ws.close()
        return

    pid = game.next_pid
    game.next_pid += 1
    p = None
    try:
        first = await asyncio.wait_for(ws.receive_json(), timeout=10)
        if not isinstance(first, dict) or first.get("t") != "join":
            await ws.close()
            return
        name = str(first.get("name") or "").strip()[:12] or f"プレイヤー{pid}"
        used = {q.color for q in game.players.values()}
        color = next((c for c in COLORS if c not in used), COLORS[pid % len(COLORS)])

        if game.phase == "idle":          # 最初の1人が来たら待合室を開く
            game.lobby_world()
            game.world_changed = False
            game.phase = "lobby"
        p = Player(pid, ws, name, color, game.smaller_team())
        game.players[pid] = p
        if game.in_game():                # 試合の途中なら、すぐに参加
            game.respawn(p)
        await ws.send_json({"t": "welcome", "id": pid, "color": color, "name": name})
        await ws.send_json(game.world_msg())
        await broadcast({"t": "info", "msg": f"{name} さんが参加しました"})
        print(f"[参加] {name} (id={pid})  現在 {len(game.players)} 人")

        while True:
            msg = await ws.receive_json()
            if isinstance(msg, dict):
                handler = HANDLERS.get(msg.get("t"))
                if handler:
                    handler(game, p, msg)
    except (WebSocketDisconnect, asyncio.TimeoutError):
        pass
    except Exception as e:  # 壊れたJSONなど
        print(f"[通信エラー] id={pid}: {e}")
    finally:
        if p and game.players.pop(pid, None):
            print(f"[退出] {p.name} (id={pid})  現在 {len(game.players)} 人")
            if not game.players:          # 誰もいなくなったら休止
                game.phase = "idle"
                game.enemies.clear()
                game.shots.clear()
            else:
                await broadcast({"t": "info", "msg": f"{p.name} さんが抜けました"})


# 画面ファイル（client フォルダ）を配信する。WebSocket の登録より後に置くこと
app.mount("/", StaticFiles(directory=CLIENT_DIR, html=True), name="client")


def lan_ip() -> str:
    """同じWi-Fiの端末からつなぐためのIPアドレスを調べる（実際には通信しない）"""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()


def run(port: int = PORT):
    ip = lan_ip()
    print("=" * 52)
    print(" ブロック防衛線 サーバーを起動します（協力・対戦）")
    print(f"  このPCから      : http://localhost:{port}")
    print(f"  同じWi-Fiの端末 : http://{ip}:{port}")
    print("  止めるときは Ctrl + C")
    print("=" * 52)
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="warning")
