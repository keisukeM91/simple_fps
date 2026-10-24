"""対戦プレイ：命中・ヘッドショット・仲間には当たらない・ラグ補償・壁とコア・勝敗"""
import math

from server import config as C
from conftest import add_player, fire, run


def face_off(g, red, blue):
    """マップの中央で、木や丘より高いところに向かい合わせる（地形は毎回ちがうため）"""
    y = C.H - 1
    red.x, red.y, red.z = 24.5, y, 20.5
    blue.x, blue.y, blue.z = 24.5, y, 26.5
    blue.history.clear()


def test_cannot_shoot_during_prep(lobby):
    g = lobby
    g.mode = "pvp"
    red, blue = add_player(g, 1, "red"), add_player(g, 2, "blue")
    g.on_start(red, {})
    face_off(g, red, blue)
    fire(g, red, (blue.x, blue.y + 1, blue.z))
    assert blue.hp == 100


def test_body_and_head_damage(pvp_game):
    g, red, blue = pvp_game
    face_off(g, red, blue)
    fire(g, red, (blue.x, blue.y + 1.0, blue.z))
    assert blue.hp == 100 - C.SHOT_DAMAGE
    fire(g, red, (blue.x, blue.y + 1.6, blue.z))
    assert blue.hp == 100 - C.SHOT_DAMAGE - C.SHOT_DAMAGE * C.HEADSHOT
    assert [f for f in g.fx if f["k"] == "phit"][-1]["head"] is True


def test_no_friendly_fire(pvp_game):
    g, red, blue = pvp_game
    face_off(g, red, blue)
    mate = add_player(g, 3, "red")
    mate.x, mate.y, mate.z = 24.5, red.y, 23.5
    fire(g, red, (mate.x, mate.y + 1, mate.z))
    assert mate.hp == 100


def test_kill_gives_team_blocks_and_respawns(pvp_game):
    g, red, blue = pvp_game
    face_off(g, red, blue)
    before = g.blocks["red"]
    for _ in range(6):
        fire(g, red, (blue.x, blue.y + 1, blue.z))
    assert blue.dead and red.kills == 1 and blue.deaths == 1
    assert g.blocks["red"] == before + C.KILL_BLOCKS
    run(g, C.PVP_RESPAWN + .2)
    assert not blue.dead and blue.hp == 100


def test_lag_compensation_uses_past_position(pvp_game):
    """相手が動いた直後でも、撃った人の画面に映っていた位置に撃てば当たる"""
    g, red, blue = pvp_game
    face_off(g, red, blue)
    n, y = g.now, blue.y
    blue.history.extend([(n - .30, 24.5, y, 26.5), (n - .15, 24.5, y, 26.5), (n - .05, 27.0, y, 26.5)])
    blue.x = 27.0                  # 今はもう横に動いている
    red.rtt = .05
    fire(g, red, (24.5, y + 1, 26.5))
    assert blue.hp < 100


def test_no_rewind_without_history_misses(pvp_game):
    g, red, blue = pvp_game
    face_off(g, red, blue)
    blue.x = 27.0
    fire(g, red, (24.5, blue.y + 1, 26.5))
    assert blue.hp == 100


def test_planks_rules(pvp_game):
    g, red, blue = pvp_game
    bx, bz = C.PVP_BASES["blue"]
    front = bz - 5                                            # 青の拠点の北側の壁
    x, y, z = next(k for k, v in g.world.plank_owner.items() if v == "blue" and k[2] == front and k[1] == C.G)
    red.x, red.y, red.z = x + .5, C.G, front - 1.5            # 壁の正面に立つ
    g.on_break(red, {"x": x, "y": y, "z": z})                 # 相手の板は F で回収できない
    assert g.world.get(x, y, z) == C.PLANK and g.fx[-1]["k"] == "deny"
    for _ in range(C.PLANK_MAX):                               # 撃てば壊せる
        red.last_shot = -99
        g.on_shoot(red, {"ox": red.x, "oy": red.y + .5, "oz": red.z, "dx": 0, "dy": 0, "dz": 1})
    assert g.world.get(x, y, z) == C.AIR


def test_destroying_enemy_core_wins(pvp_game):
    g, red, blue = pvp_game
    c = g.cores["blue"]
    red.x, red.y, red.z = c["x"] + .5, C.G, c["z"] - 3.5
    shots = 0
    while g.phase == "pvp" and shots < 200:
        fire(g, red, (c["x"] + .5, C.G + 1, c["z"] + .5))
        shots += 1
    assert g.phase == "over" and g.over_info["winner"] == "red"
    assert shots == math.ceil(C.PVP_CORE_MAX / C.CORE_SHOT_DAMAGE)


def test_own_core_cannot_be_damaged(pvp_game):
    g, red, blue = pvp_game
    c = g.cores["red"]
    red.x, red.y, red.z = c["x"] + .5, C.G, c["z"] + 3.5
    fire(g, red, (c["x"] + .5, C.G + 1, c["z"] + .5))
    assert c["hp"] == C.PVP_CORE_MAX


def test_time_up_compares_cores(pvp_game):
    g, red, blue = pvp_game
    g.cores["blue"]["hp"] -= 50
    run(g, C.PVP_TIME + .2)
    assert g.phase == "over" and g.over_info["winner"] == "red"


def test_time_up_draw(pvp_game):
    g, red, blue = pvp_game
    run(g, C.PVP_TIME + .2)
    assert g.over_info["winner"] is None
