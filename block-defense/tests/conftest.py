"""テスト共通の準備"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))   # server パッケージを読めるようにする

from server import config as C          # noqa: E402
from server.entities import Player      # noqa: E402
from server.game import Game            # noqa: E402


class FakeSocket:
    """テストでは通信しないので、中身のない代わり"""


def add_player(game, pid, team="red", name=None):
    p = Player(pid, FakeSocket(), name or f"P{pid}", C.COLORS[pid % len(C.COLORS)], team)
    game.players[pid] = p
    return p


def run(game, seconds, step=0.05):
    for _ in range(int(seconds / step)):
        game.tick(step)


def aim(src, tgt_xyz):
    """src の目から、tgt_xyz へ向けて撃つメッセージを作る"""
    o = (src.x, src.y + C.EYE, src.z)
    d = [tgt_xyz[i] - o[i] for i in range(3)]
    n = max(abs(v) for v in d) or 1
    return {"ox": o[0], "oy": o[1], "oz": o[2], "dx": d[0] / n, "dy": d[1] / n, "dz": d[2] / n}


def fire(game, src, tgt_xyz):
    src.last_shot = -99          # 連射制限を気にせず撃つ
    game.on_shoot(src, aim(src, tgt_xyz))


@pytest.fixture
def lobby():
    g = Game()
    g.lobby_world()
    g.phase = "lobby"
    return g


@pytest.fixture
def pvp_game(lobby):
    """赤1人・青1人で対戦を始め、準備時間を終わらせた状態"""
    g = lobby
    g.mode = "pvp"
    red, blue = add_player(g, 1, "red", "赤さん"), add_player(g, 2, "blue", "青さん")
    g.on_start(red, {})
    run(g, C.PVP_PREP + 0.2)
    g.fx.clear()
    return g, red, blue


@pytest.fixture
def coop_game(lobby):
    g = lobby
    p = add_player(g, 1)
    g.on_start(p, {})
    g.fx.clear()
    return g, p
