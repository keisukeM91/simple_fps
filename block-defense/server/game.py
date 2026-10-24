"""ゲーム本体：状態の管理と、どのモードにも共通する処理

流れ:  待合室（lobby） → 協力プレイ（break / fight） または 対戦（prep / pvp） → 結果（over） → 待合室

モードごとのルールは別ファイルに分け、ここで組み合わせています。
  lobby.py … 待合室   coop.py … 協力プレイ   pvp.py … 対戦プレイ
"""
import math
import random

from .config import (W, D, H, CX, CZ, G, AIR, PLANK, PLANK_MAX, TEAMS, PVP_BASES, EYE, PLAYER_W, PLAYER_H,
                     SHOT_INTERVAL, SHOT_RANGE, REACH, OVER_WAIT, COOP_CORE_MAX, COOP_START_BLOCKS, BREAK_FIRST,
                     COOP_RESPAWN, PVP_CORE_MAX, PVP_START_BLOCKS, PVP_PREP, PVP_TIME, PVP_RESPAWN, KILL_BLOCKS)
from .coop import CoopRules
from .entities import Player, Enemy
from .lobby import LobbyRules
from .pvp import PvpRules
from .util import num, r3
from .world import World, ray_vox

COOP_PHASES = ("break", "fight")
PVP_PHASES = ("prep", "pvp")


class Game(LobbyRules, CoopRules, PvpRules):
    def __init__(self):
        self.world = World()
        self.players: dict[int, Player] = {}
        self.enemies: list[Enemy] = []
        self.shots: list[dict] = []
        self.fx: list[dict] = []           # この1回の計算で起きた出来事（全員に配る）
        self.phase = "idle"                # idle / lobby / break / fight / prep / pvp / over
        self.mode = "coop"                 # 待合室で選ばれているモード
        self.next_pid = self.next_eid = self.next_sid = 1
        self.now = 0.0
        self.cores: dict[str, dict] = {}
        self.blocks: dict[str, int] = {}
        self.world_changed = False         # True のとき、地形を全員に送り直す
        self.reset_values()

    def reset_values(self):
        self.wave = 0
        self.score = 0
        self.break_t = BREAK_FIRST
        self.queue: list[str] = []
        self.spawn_t = 0.0
        self.over_t = 0.0
        self.over_info = None
        self.prep_t = PVP_PREP
        self.time_left = PVP_TIME

    # ---------- 共通の小さな判定 ----------
    def bteam(self, p):
        """板やコアを共有する単位。協力は全員で "all"、対戦はチームごと"""
        return p.team if self.mode == "pvp" else "all"

    def color_of(self, p):
        return TEAMS[p.team]["color"] if self.mode == "pvp" else p.color

    def in_game(self):
        return self.phase in COOP_PHASES + PVP_PHASES

    # ---------- 進行 ----------
    def lobby_world(self):
        """待合室の背景用の地形"""
        self.world.generate(random.randrange(1 << 30), [(CX, CZ, "all")], 6)
        self.cores = {"all": {"x": CX, "z": CZ, "hp": COOP_CORE_MAX, "max": COOP_CORE_MAX}}
        self.blocks = {"all": COOP_START_BLOCKS}
        self.world_changed = True

    def to_lobby(self):
        self.phase = "lobby"
        self.enemies.clear()
        self.shots.clear()
        for p in self.players.values():
            p.dead = False
            p.hp = 100.0

    def start_game(self):
        """待合室から試合を始める（地形を作り直して全員に送る）"""
        self.enemies.clear()
        self.shots.clear()
        self.reset_values()
        seed = random.randrange(1 << 30)
        if self.mode == "pvp":
            bases = [(bx, bz, t) for t, (bx, bz) in PVP_BASES.items()]
            self.world.generate(seed, bases, 5)
            self.cores = {t: {"x": bx, "z": bz, "hp": PVP_CORE_MAX, "max": PVP_CORE_MAX} for bx, bz, t in bases}
            self.blocks = {t: PVP_START_BLOCKS for t in TEAMS}
            self.phase = "prep"
        else:
            self.world.generate(seed, [(CX, CZ, "all")], 6)
            self.cores = {"all": {"x": CX, "z": CZ, "hp": COOP_CORE_MAX, "max": COOP_CORE_MAX}}
            self.blocks = {"all": COOP_START_BLOCKS}
            self.phase = "break"
        self.world_changed = True
        for p in self.players.values():
            p.kills = p.deaths = 0
            p.history.clear()
            self.respawn(p)

    def stats(self):
        return [{"name": p.name, "color": self.color_of(p), "team": p.team, "k": p.kills, "d": p.deaths}
                for p in sorted(self.players.values(), key=lambda p: (-p.kills, p.deaths))]

    def game_over(self, winner=None):
        self.phase = "over"
        self.over_t = OVER_WAIT
        self.enemies.clear()
        self.shots.clear()
        if self.mode == "pvp":
            self.over_info = {"mode": "pvp", "winner": winner,
                              "cores": {t: round(c["hp"]) for t, c in self.cores.items()}, "players": self.stats()}
        else:
            self.over_info = {"mode": "coop", "wave": self.wave, "score": self.score, "players": self.stats()}
        self.fx.append({"k": "over"})

    # ---------- プレイヤー ----------
    def spawn_point(self, p):
        c = self.cores.get(self.bteam(p)) or {"x": CX, "z": CZ}
        r = 3.2 if self.mode == "pvp" else 4
        for _ in range(30):
            x = c["x"] + .5 + random.uniform(-r, r)
            z = c["z"] + .5 + random.uniform(-r, r)
            if math.hypot(x - c["x"] - .5, z - c["z"] - .5) > 1.6 and not self.player_collides(x, G, z):
                return x, z
        return c["x"] + .5, c["z"] + 2.5

    def player_collides(self, px, py, pz):
        for y in range(math.floor(py), math.floor(py + PLAYER_H - 1e-4) + 1):
            for z in range(math.floor(pz - PLAYER_W), math.floor(pz + PLAYER_W - 1e-4) + 1):
                for x in range(math.floor(px - PLAYER_W), math.floor(px + PLAYER_W - 1e-4) + 1):
                    if self.world.solid(x, y, z):
                        return True
        return False

    def respawn(self, p):
        p.x, p.z = self.spawn_point(p)
        p.y = G
        p.hp, p.dead = 100.0, False
        p.history.clear()
        p.ignore_state_until = self.now + 0.4      # 古い位置が届いても上書きしない
        yaw = math.atan2(-(CX + .5 - p.x), -(CZ + .5 - p.z))   # マップの中央を向く
        self.fx.append({"k": "respawn", "pid": p.id, "x": r3(p.x), "y": r3(p.y), "z": r3(p.z), "yaw": r3(yaw)})

    def hurt_player(self, p, dmg, by=None, head=False):
        if p.dead or not self.in_game():
            return
        p.hp -= dmg
        p.last_hurt = self.now
        self.fx.append({"k": "hurt", "pid": p.id, "d": round(dmg)})
        if p.hp <= 0:
            p.hp, p.dead = 0.0, True
            p.respawn_t = PVP_RESPAWN if self.mode == "pvp" else COOP_RESPAWN
            p.deaths += 1
            if by:
                by.kills += 1
                self.blocks[self.bteam(by)] = self.blocks.get(self.bteam(by), 0) + KILL_BLOCKS
            self.fx.append({"k": "pkill", "by": by.id if by else None, "v": p.id, "head": head})

    def hurt_core(self, team, dmg):
        c = self.cores.get(team)
        if not c or c["hp"] <= 0:
            return
        c["hp"] = max(0, c["hp"] - dmg)
        self.fx.append({"k": "core", "team": team})
        if c["hp"] <= 0:
            self.game_over(winner=self.other_team(team) if self.mode == "pvp" else None)

    # ---------- ブロック ----------
    def damage_plank(self, x, y, z, d):
        hp = self.world.plank_hp.get((x, y, z), PLANK_MAX) - d
        self.fx.append({"k": "plank", "p": [x, y, z]})
        if hp <= 0:
            self.world.remove_plank(x, y, z)
            self.fx.append({"k": "block", "x": x, "y": y, "z": z, "v": AIR})
        else:
            self.world.plank_hp[(x, y, z)] = hp

    def in_reach(self, p, x, y, z):
        return math.dist((p.x, p.y + EYE, p.z), (x + .5, y + .5, z + .5)) <= REACH

    @staticmethod
    def read_cell(msg):
        return int(num(msg.get("x"), -1, W)), int(num(msg.get("y"), -1, H)), int(num(msg.get("z"), -1, D))

    def cell_is_free(self, x, y, z):
        """そのマスにプレイヤーや敵が立っていないか"""
        def overlap(a0, a1, b0, b1):
            return a0 < b1 and b0 < a1
        for q in self.players.values():
            if not q.dead and overlap(q.x - PLAYER_W, q.x + PLAYER_W, x, x + 1) and \
                    overlap(q.y, q.y + PLAYER_H, y, y + 1) and overlap(q.z - PLAYER_W, q.z + PLAYER_W, z, z + 1):
                return False
        for e in self.enemies:
            w = e.d["w"] / 2
            if overlap(e.x - w, e.x + w, x, x + 1) and overlap(e.y, e.y + e.d["h"], y, y + 1) and \
                    overlap(e.z - w, e.z + w, z, z + 1):
                return False
        return True

    # ---------- 端末からのお願い ----------
    def on_place(self, p, msg):
        if p.dead or not self.in_game():
            return
        x, y, z = self.read_cell(msg)
        if not (0 <= x < W and 0 <= z < D and 0 <= y < H) or self.world.get(x, y, z) != AIR:
            return
        team = self.bteam(p)
        if self.blocks.get(team, 0) <= 0 or not self.in_reach(p, x, y, z) or not self.cell_is_free(x, y, z):
            return
        self.world.add_plank(x, y, z, team)
        self.blocks[team] -= 1
        self.fx.append({"k": "block", "x": x, "y": y, "z": z, "v": PLANK, "pid": p.id})

    def on_break(self, p, msg):
        if p.dead or not self.in_game():
            return
        x, y, z = self.read_cell(msg)
        if self.world.get(x, y, z) != PLANK or not self.in_reach(p, x, y, z):
            return
        team = self.bteam(p)
        if self.mode == "pvp" and self.world.plank_owner.get((x, y, z)) != team:
            self.fx.append({"k": "deny", "pid": p.id, "msg": "相手チームの板は撃って壊そう"})
            return
        self.world.remove_plank(x, y, z)
        self.blocks[team] = self.blocks.get(team, 0) + 1
        self.fx.append({"k": "block", "x": x, "y": y, "z": z, "v": AIR, "pid": p.id})

    def on_shoot(self, p, msg):
        """命中判定はここだけで行う（端末の判断は使わない）"""
        if p.dead or not self.in_game() or self.phase == "prep":
            return
        if self.now - p.last_shot < SHOT_INTERVAL:
            return
        p.last_shot = self.now
        eye = (p.x, p.y + EYE, p.z)
        o = (num(msg.get("ox"), -10, 60), num(msg.get("oy"), -10, 40), num(msg.get("oz"), -10, 60))
        if math.dist(o, eye) > 2.5:          # 体から離れすぎた位置からの射撃は認めない
            o = eye
        d = (num(msg.get("dx"), -1, 1), num(msg.get("dy"), -1, 1), num(msg.get("dz"), -1, 1))
        ln = math.sqrt(d[0] ** 2 + d[1] ** 2 + d[2] ** 2)
        if ln < 1e-6:
            return
        d = (d[0] / ln, d[1] / ln, d[2] / ln)

        hit_block = ray_vox(self.world, o, d, SHOT_RANGE)
        t_max = hit_block[0] if hit_block else SHOT_RANGE
        head = False
        if self.mode == "pvp":
            target, t_max, head = self.pvp_find_target(p, o, d, t_max)
        else:
            target, t_max = self.coop_find_target(o, d, t_max)

        end = [r3(o[i] + d[i] * t_max) for i in range(3)]
        self.fx.append({"k": "shot", "pid": p.id, "c": self.color_of(p), "a": [r3(v) for v in o], "b": end})
        if target and self.mode == "pvp":
            self.pvp_hit_player(p, target, head, end)
        elif target:
            self.coop_hit_enemy(p, target, end)
        elif hit_block and self.mode == "pvp":
            self.pvp_hit_block(p, hit_block)

    def on_state(self, p, msg):
        if p.dead or self.now < p.ignore_state_until or not self.in_game():
            return
        p.x = num(msg.get("x"), -2, W + 2, p.x)
        p.y = num(msg.get("y"), -10, H + 10, p.y)
        p.z = num(msg.get("z"), -2, D + 2, p.z)
        p.yaw = num(msg.get("yaw"), -1e6, 1e6, p.yaw)
        p.pitch = num(msg.get("pitch"), -1.6, 1.6, p.pitch)
        p.history.append((self.now, p.x, p.y, p.z))
        if p.y < -6:
            self.hurt_player(p, 999)

    def on_skip(self, p, msg):
        if self.phase == "break":
            self.break_t = 0
        elif self.phase == "prep":
            self.prep_t = min(self.prep_t, 3)

    def on_pong(self, p, msg):
        s = num(msg.get("s"), 0, 1e12, -1)
        if 0 <= s <= self.now:
            p.rtt = p.rtt * .7 + min(1.0, self.now - s) * .3

    # ---------- 1回分の計算 ----------
    def tick(self, dt):
        self.now += dt
        if self.phase in ("idle", "lobby"):
            return
        if self.phase == "over":
            self.over_t -= dt
            if self.over_t <= 0:
                self.to_lobby()
            return

        for p in self.players.values():
            if p.dead:
                p.respawn_t -= dt
                if p.respawn_t <= 0:
                    self.respawn(p)
            elif self.now - p.last_hurt > 4 and p.hp < 100:
                p.hp = min(100.0, p.hp + 6 * dt)

        if self.phase in COOP_PHASES:
            self.tick_coop(dt)
        elif self.phase in PVP_PHASES:
            self.tick_pvp(dt)

    # ---------- 端末へ送る内容 ----------
    def snapshot(self):
        g = {"phase": self.phase, "mode": self.mode, "wave": self.wave, "breakT": r3(self.break_t),
             "left": len(self.enemies) + len(self.queue), "score": self.score, "blocks": self.blocks,
             "cores": {t: {"hp": round(c["hp"]), "max": c["max"]} for t, c in self.cores.items()},
             "prepT": r3(self.prep_t), "timeLeft": r3(self.time_left), "overT": r3(self.over_t)}
        if self.phase == "lobby":
            g["canStart"], g["why"] = self.can_start()
        if self.phase == "over":
            g["over"] = self.over_info
        return {
            "t": "snap", "game": g,
            "players": [{"id": p.id, "name": p.name, "color": self.color_of(p), "team": p.team,
                         "x": r3(p.x), "y": r3(p.y), "z": r3(p.z), "yaw": r3(p.yaw), "pitch": r3(p.pitch),
                         "hp": round(p.hp), "dead": p.dead, "k": p.kills, "d": p.deaths}
                        for p in self.players.values()],
            "enemies": [{"id": e.id, "t": e.type, "x": r3(e.x), "y": r3(e.y), "z": r3(e.z), "r": r3(e.yaw),
                         "hp": round(e.hp), "mx": round(e.max), "a": 1 if e.swing > 0 else 0}
                        for e in self.enemies],
            "shots": [{"id": s["id"], "x": r3(s["x"]), "y": r3(s["y"]), "z": r3(s["z"])} for s in self.shots],
            "e": self.fx,
        }

    def world_msg(self):
        return {"t": "world", "data": self.world.encode(),
                "cores": [{"team": t, "x": c["x"], "z": c["z"],
                           "color": TEAMS[t]["color"] if t in TEAMS else "#5fe3ff"} for t, c in self.cores.items()]}
