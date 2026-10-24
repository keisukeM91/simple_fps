"""対戦プレイのルール：準備時間・試合時間・プレイヤー同士の命中判定（ラグ補償）・コアと壁への攻撃"""
from .config import (TEAMS, PLAYER_W, PLAYER_H, HEAD_FROM, SHOT_DAMAGE, HEADSHOT, CORE,
                     PLANK, CORE_SHOT_DAMAGE, MAX_REWIND, INTERP_DELAY)
from .world import ray_box


class PvpRules:
    """Game に混ぜて使う（self は Game）"""

    # ---------- 進行 ----------
    def tick_pvp(self, dt):
        if self.phase == "prep":
            self.prep_t -= dt
            if self.prep_t <= 0:
                self.phase = "pvp"
                self.fx.append({"k": "fight"})
        elif self.phase == "pvp":
            self.time_left -= dt
            if self.time_left <= 0:
                self.time_left = 0
                self.game_over(winner=self.winner_by_cores())

    def winner_by_cores(self):
        """時間切れのとき：コアの残りの割合が多いチーム（同じなら None＝引き分け）"""
        r = {t: c["hp"] / c["max"] for t, c in self.cores.items()}
        if abs(r["red"] - r["blue"]) < 1e-6:
            return None
        return max(r, key=r.get)

    def other_team(self, team):
        return next(t for t in TEAMS if t != team)

    # ---------- 射撃 ----------
    def pvp_find_target(self, p, o, d, t_max):
        """相手チームのプレイヤーに当たるか。
        ラグ補償：撃った人の画面に見えていた「少し前の相手の位置」で判定する"""
        rewind_to = self.now - min(MAX_REWIND, p.rtt / 2 + INTERP_DELAY)
        target, head = None, False
        for q in self.players.values():
            if q is p or q.dead or q.team == p.team:
                continue
            qx, qy, qz = q.pos_at(rewind_to)
            t = ray_box(o, d, (qx - PLAYER_W, qy, qz - PLAYER_W), (qx + PLAYER_W, qy + PLAYER_H + .1, qz + PLAYER_W))
            if 0 <= t < t_max:
                t_max, target = t, q
                head = o[1] + d[1] * t > qy + HEAD_FROM
        return target, t_max, head

    def pvp_hit_player(self, p, target, head, end):
        self.fx.append({"k": "phit", "pid": p.id, "v": target.id, "head": head, "p": end})
        self.hurt_player(target, SHOT_DAMAGE * (HEADSHOT if head else 1), by=p, head=head)

    def pvp_hit_block(self, p, hit_block):
        """相手のコアに当たればダメージ、相手の板に当たれば耐久を1減らす"""
        _, (bx, by, bz), v = hit_block
        if v == CORE:
            for team, c in self.cores.items():
                if c["x"] == bx and c["z"] == bz and team != p.team:
                    self.fx.append({"k": "corehit", "pid": p.id})
                    self.hurt_core(team, CORE_SHOT_DAMAGE)
        elif v == PLANK and self.world.plank_owner.get((bx, by, bz)) not in (p.team, None):
            self.damage_plank(bx, by, bz, 1)
