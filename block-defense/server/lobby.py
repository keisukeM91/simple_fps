"""待合室のルール：モード選び・チーム分け・開始の条件"""
from .config import TEAMS


class LobbyRules:
    """Game に混ぜて使う（self は Game）"""

    def smaller_team(self):
        cnt = {t: 0 for t in TEAMS}
        for p in self.players.values():
            if p.team in cnt:
                cnt[p.team] += 1
        return min(cnt, key=lambda t: (cnt[t], t != "red"))

    def can_start(self):
        if not self.players:
            return False, "参加者がいません"
        if self.mode == "pvp" and len({p.team for p in self.players.values()}) < 2:
            return False, "対戦は、赤と青に1人以上ずつ必要です"
        return True, ""

    # ---- 端末からのお願い ----
    def on_mode(self, p, msg):
        if self.phase == "lobby" and msg.get("mode") in ("coop", "pvp"):
            self.mode = msg["mode"]

    def on_team(self, p, msg):
        if self.phase == "lobby" and msg.get("team") in TEAMS:
            p.team = msg["team"]

    def on_start(self, p, msg):
        if self.phase != "lobby":
            return
        ok, why = self.can_start()
        if ok:
            self.start_game()
            self.fx.append({"k": "start", "mode": self.mode, "by": p.name})
        else:
            self.fx.append({"k": "deny", "pid": p.id, "msg": why})
