"""待合室：チーム分け・開始の条件・結果のあと待合室へ戻る"""
from server import config as C
from conftest import add_player, run


def test_teams_are_balanced(lobby):
    a = add_player(lobby, 1, lobby.smaller_team())
    b = add_player(lobby, 2, lobby.smaller_team())
    assert {a.team, b.team} == {"red", "blue"}


def test_pvp_needs_both_teams(lobby):
    a = add_player(lobby, 1, "red")
    add_player(lobby, 2, "red")
    lobby.on_mode(a, {"mode": "pvp"})
    ok, why = lobby.can_start()
    assert not ok and "赤と青" in why
    lobby.on_start(a, {})
    assert lobby.phase == "lobby"
    assert lobby.fx[-1]["k"] == "deny"


def test_start_coop_and_pvp(lobby):
    a = add_player(lobby, 1, "red")
    b = add_player(lobby, 2, "blue")
    lobby.on_start(a, {})
    assert lobby.phase == "break" and list(lobby.cores) == ["all"]
    lobby.game_over()
    run(lobby, C.OVER_WAIT + .2)
    assert lobby.phase == "lobby"
    lobby.on_mode(b, {"mode": "pvp"})
    lobby.on_start(b, {})
    assert lobby.phase == "prep" and set(lobby.cores) == {"red", "blue"}
    assert lobby.blocks == {"red": C.PVP_START_BLOCKS, "blue": C.PVP_START_BLOCKS}


def test_mode_and_team_cannot_change_during_game(lobby):
    a = add_player(lobby, 1, "red")
    lobby.on_start(a, {})
    lobby.on_mode(a, {"mode": "pvp"})
    lobby.on_team(a, {"team": "blue"})
    assert lobby.mode == "coop" and a.team == "red"


def test_garbage_messages_are_ignored(lobby):
    a = add_player(lobby, 1)
    lobby.on_mode(a, {"mode": "<script>"})
    lobby.on_team(a, {"team": None})
    lobby.on_start(a, {})
    lobby.on_state(a, {"x": "abc", "y": None, "z": float("nan")})
    lobby.on_place(a, {"x": 1e99, "y": "?", "z": -5})
    lobby.on_shoot(a, {"dx": 0, "dy": 0, "dz": 0})
    assert lobby.mode == "coop"
