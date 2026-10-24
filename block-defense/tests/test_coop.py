"""協力プレイ：ウェーブ・敵の撃破・ブロックの置き壊し・コアが壊れたら終わる"""
from server import config as C
from conftest import fire, run


def test_wave_starts_after_break(coop_game):
    g, p = coop_game
    run(g, C.BREAK_FIRST + .2)
    assert g.phase == "fight" and g.wave == 1 and g.queue


def test_skip_ends_break(coop_game):
    g, p = coop_game
    g.on_skip(p, {})
    run(g, .1)
    assert g.phase == "fight"


def test_shooting_kills_enemy_and_shares_reward(coop_game):
    g, p = coop_game
    g.on_skip(p, {})
    run(g, .1)
    g.enemies.clear()
    g.spawn_enemy("walker")
    e = g.enemies[-1]
    e.x, e.y, e.z = C.CX + 3.5, C.G, C.CZ + .5            # 拠点の中（平らで見通しがよい）に置く
    p.x, p.y, p.z = C.CX + 3.5, C.G, C.CZ + 4.5
    before = g.blocks["all"]
    for _ in range(10):
        if e not in g.enemies:
            break
        fire(g, p, (e.x, e.y + 1, e.z))
    assert e not in g.enemies
    assert g.blocks["all"] == before + C.ENEMY_TYPES["walker"]["reward"]
    assert p.kills == 1 and g.score > 0


def test_fire_rate_is_limited(coop_game):
    g, p = coop_game
    msg = {"ox": p.x, "oy": p.y + C.EYE, "oz": p.z, "dx": 0, "dy": 0, "dz": 1}
    g.on_shoot(p, msg)
    g.on_shoot(p, msg)          # 同じ瞬間の2発目は無視される
    assert sum(1 for f in g.fx if f["k"] == "shot") == 1


def test_place_and_break_plank(coop_game):
    g, p = coop_game
    p.x, p.y, p.z = C.CX + .5, C.G, C.CZ + 3.5
    cell = (C.CX, C.G, C.CZ + 5)
    before = g.blocks["all"]
    g.on_place(p, dict(zip("xyz", cell)))
    assert g.world.get(*cell) == C.PLANK and g.blocks["all"] == before - 1
    g.on_break(p, dict(zip("xyz", cell)))
    assert g.world.get(*cell) == C.AIR and g.blocks["all"] == before


def test_cannot_place_on_self_or_far_away(coop_game):
    g, p = coop_game
    p.x, p.y, p.z = C.CX + .5, C.G, C.CZ + 3.5
    g.on_place(p, {"x": C.CX, "y": C.G, "z": C.CZ + 3})
    assert g.world.get(C.CX, C.G, C.CZ + 3) == C.AIR
    g.on_place(p, {"x": 2, "y": C.H - 1, "z": 2})       # 遠すぎる
    assert g.world.get(2, C.H - 1, 2) == C.AIR


def test_core_destroyed_ends_game(coop_game):
    g, p = coop_game
    g.hurt_core("all", C.COOP_CORE_MAX)
    assert g.phase == "over" and g.over_info["mode"] == "coop"
    run(g, C.OVER_WAIT + .2)
    assert g.phase == "lobby"


def test_enemies_break_walls_when_undefended(coop_game):
    """だれも守らないと、ロボットが壁を壊してコアを攻撃する"""
    g, p = coop_game
    p.dead, p.respawn_t = True, 1e9        # プレイヤーは不在あつかい
    planks = len(g.world.plank_hp)
    g.on_skip(p, {})
    run(g, 90)
    assert len(g.world.plank_hp) < planks or g.cores["all"]["hp"] < C.COOP_CORE_MAX
