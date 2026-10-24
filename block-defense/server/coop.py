"""協力プレイのルール：ウェーブ・敵ロボットの動き・敵の弾"""
import math
import random

from .config import (W, D, CX, CZ, PLANK, PLAYER_H, SHOT_DAMAGE, BREAK_NEXT, WAVE_BONUS_BLOCKS)
from .entities import Enemy
from .world import ray_vox, ray_box
from .util import r3


class CoopRules:
    """Game に混ぜて使う（self は Game）"""

    # ---------- 進行 ----------
    def tick_coop(self, dt):
        if self.phase == "break":
            self.break_t -= dt
            if self.break_t <= 0:
                self.start_wave()
        elif self.phase == "fight":
            self.spawn_t -= dt
            if self.queue and self.spawn_t <= 0:
                self.spawn_enemy(self.queue.pop())
                self.spawn_t = max(.35, 1.7 - self.wave * .09) / (1 + .3 * (len(self.players) - 1))
            if not self.queue and not self.enemies:
                self.phase, self.break_t = "break", BREAK_NEXT
                self.blocks["all"] += WAVE_BONUS_BLOCKS
                self.fx.append({"k": "clear", "b": WAVE_BONUS_BLOCKS})

        for e in list(self.enemies):
            if e in self.enemies:
                self.update_enemy(e, dt)
            if self.phase == "over":
                return
        self.update_shots(dt)

    def start_wave(self):
        self.wave += 1
        self.phase = "fight"
        n = self.wave
        mul = 1 + 0.5 * (max(1, len(self.players)) - 1)   # 人数が多いほど敵も増える
        q = ["walker"] * round((3 + n * 2) * mul)
        if n >= 2:
            q += ["shooter"] * round(n * 1.2 * mul)
        if n >= 3:
            q += ["brute"] * round((n - 1) // 2 * mul)
        random.shuffle(q)
        self.queue = q
        self.spawn_t = 1.0
        self.fx.append({"k": "wave", "n": n})

    def spawn_enemy(self, etype):
        side, r = random.randrange(4), 2 + random.randrange(W - 4)
        x, z = [(r, 1), (r, D - 2), (1, r), (W - 2, r)][side]
        e = Enemy(self.next_eid, etype, x + .5, self.world.surface(x, z), z + .5, 1 + (self.wave - 1) * .13)
        self.next_eid += 1
        self.enemies.append(e)

    def nearest_player(self, e):
        best, bd = None, 1e9
        for p in self.players.values():
            if p.dead:
                continue
            dd = math.hypot(p.x - e.x, p.z - e.z)
            if dd < bd:
                best, bd = p, dd
        return best, bd

    # ---------- 射撃（敵ロボットへの命中） ----------
    def coop_find_target(self, o, d, t_max):
        target = None
        for e in self.enemies:
            w = e.d["w"] / 2
            t = ray_box(o, d, (e.x - w, e.y, e.z - w), (e.x + w, e.y + e.d["h"], e.z + w))
            if 0 <= t < t_max:
                t_max, target = t, e
        return target, t_max

    def coop_hit_enemy(self, p, target, end):
        target.hp -= SHOT_DAMAGE
        if target.hp <= 0:
            self.enemies.remove(target)
            self.blocks["all"] += target.d["reward"]
            self.score += target.d["score"] * max(1, self.wave)
            p.kills += 1
            self.fx.append({"k": "kill", "pid": p.id, "id": target.id, "t": target.type,
                            "p": [r3(target.x), r3(target.y), r3(target.z)], "r": target.d["reward"]})
        else:
            self.fx.append({"k": "hit", "pid": p.id, "id": target.id, "p": end})

    # ---------- 敵ロボットの動き ----------
    def update_enemy(self, e, dt):
        d, w = e.d, self.world
        fx, fz = math.floor(e.x), math.floor(e.z)
        if not w.solid(fx, math.floor(e.y - .01), fz):           # 重力
            e.vy -= 20 * dt
            e.y += e.vy * dt
            if w.solid(fx, math.floor(e.y), fz):
                e.y, e.vy = math.floor(e.y) + 1, 0.0
        else:
            e.vy = 0.0
        if e.y < -5:
            self.enemies.remove(e)
            return

        # 目標を決める（近くのプレイヤー、それ以外は拠点コア）
        core_x, core_z = CX + .5, CZ + .5
        to_c = math.hypot(core_x - e.x, core_z - e.z)
        p, to_p = self.nearest_player(e)
        chasing = bool(p) and ((e.type == "shooter" and to_p < 20) or
                               (e.type != "shooter" and to_p < 4.5 and to_p < to_c))
        tx, tz = (p.x, p.z) if chasing else (core_x, core_z)
        dx, dz = tx - e.x, tz - e.z
        dist = math.hypot(dx, dz) or 1
        dx, dz = dx / dist, dz / dist
        e.yaw = math.atan2(dx, dz)
        e.atk_cd -= dt
        e.swing = max(0.0, e.swing - dt)

        mvx, mvz, moving = dx, dz, True
        if e.type == "shooter":
            if chasing:
                if dist < 6:
                    mvx, mvz = -dx, -dz
                elif dist < 10:
                    mvx, mvz = -dz * e.strafe, dx * e.strafe
                    if random.random() < dt * .4:
                        e.strafe *= -1
                e.shoot_t -= dt
                if e.shoot_t <= 0:
                    e.shoot_t = 2.2 - min(1, self.wave * .08)
                    self.enemy_fire(e, p)
            elif to_c < 3:
                moving = False
        else:
            if chasing and dist < 1.25:
                moving = False
                if e.atk_cd <= 0:
                    e.atk_cd, e.swing = .9, .3
                    self.hurt_player(p, d["melee"])
            if not chasing and to_c < 1.45:
                moving = False
                if e.atk_cd <= 0:
                    e.atk_cd, e.swing = .9, .3
                    self.hurt_core("all", d["melee"])
                    if self.phase == "over":
                        return
        if e.detour_t > 0:
            e.detour_t -= dt
            mvx = -dz * e.detour * .85 + dx * .3
            mvz = dx * e.detour * .85 + dz * .3

        if moving:
            self.move_enemy(e, mvx, mvz, dt, chasing)
        self.separate_enemy(e)

    def enemy_fire(self, e, p):
        """射撃ボットが、見通しがあるときだけ弾を撃つ"""
        frm = (e.x, e.y + e.d["h"] * .6, e.z)
        to = (p.x, p.y + 1.2, p.z)
        vec = [to[i] - frm[i] for i in range(3)]
        ln = math.sqrt(sum(v * v for v in vec)) or 1
        vec = [v / ln for v in vec]
        if not ray_vox(self.world, frm, vec, ln):
            self.shots.append({"id": self.next_sid, "x": frm[0], "y": frm[1], "z": frm[2],
                               "v": [v * 13 for v in vec], "life": 4.0})
            self.next_sid += 1
            self.fx.append({"k": "eshot", "p": [r3(v) for v in frm]})

    def move_enemy(self, e, mvx, mvz, dt, chasing):
        """進む。1段なら登る、木の板なら叩いて壊す、壊せない壁なら回り道"""
        d, w = e.d, self.world
        m = math.hypot(mvx, mvz) or 1
        mvx, mvz = mvx / m, mvz / m
        fx, fz, fy = math.floor(e.x), math.floor(e.z), math.floor(e.y + .001)
        cx = math.floor(e.x + mvx * (d["w"] * .5 + .15))
        cz = math.floor(e.z + mvz * (d["w"] * .5 + .15))
        if cx != fx or cz != fz:
            foot, head, above = w.solid(cx, fy, cz), w.solid(cx, fy + 1, cz), w.solid(cx, fy + 2, cz)
            if not foot and not head:
                pass
            elif foot and not head and not above and e.vy == 0:
                e.y = fy + 1
            else:
                wy = fy if w.get(cx, fy, cz) == PLANK else (fy + 1 if w.get(cx, fy + 1, cz) == PLANK else -1)
                if wy >= 0 and d["wood"] > 0 and not chasing:
                    if e.atk_cd <= 0:
                        e.atk_cd, e.swing = .85, .3
                        self.damage_plank(cx, wy, cz, d["wood"])
                elif e.detour_t <= 0:
                    e.detour = random.choice((1, -1))
                    e.detour_t = 1.2 + random.random()
                return
        e.x += mvx * d["spd"] * dt
        e.z += mvz * d["spd"] * dt

    def separate_enemy(self, e):
        """敵どうしが重ならないように押し合う"""
        w = self.world
        for o in self.enemies:
            if o is e:
                continue
            ox, oz = e.x - o.x, e.z - o.z
            dd, mn = math.hypot(ox, oz), (e.d["w"] + o.d["w"]) * .45
            if 0 < dd < mn:
                push = (mn - dd) * .5
                nx, nz = e.x + ox / dd * push, e.z + oz / dd * push
                if not w.solid(math.floor(nx), math.floor(e.y + .001), math.floor(nz)):
                    e.x, e.z = nx, nz

    def update_shots(self, dt):
        """射撃ボットの弾を進め、ブロックかプレイヤーに当たったら消す"""
        for s in list(self.shots):
            s["x"] += s["v"][0] * dt
            s["y"] += s["v"][1] * dt
            s["z"] += s["v"][2] * dt
            s["life"] -= dt
            dead = s["life"] <= 0 or self.world.solid(math.floor(s["x"]), math.floor(s["y"]), math.floor(s["z"]))
            if not dead:
                for p in self.players.values():
                    if not p.dead and abs(s["x"] - p.x) < .45 and abs(s["z"] - p.z) < .45 and p.y < s["y"] < p.y + PLAYER_H:
                        self.hurt_player(p, 9)
                        dead = True
                        break
            if dead:
                self.shots.remove(s)
