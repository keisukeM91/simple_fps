"""登場するもの：プレイヤーと敵ロボット"""
import random
from collections import deque

from .config import CX, CZ, G, ENEMY_TYPES


class Player:
    def __init__(self, pid, ws, name, color, team):
        self.id, self.ws, self.name, self.color, self.team = pid, ws, name, color, team
        self.x, self.y, self.z = CX + .5, G, CZ + 3.5
        self.yaw = self.pitch = 0.0
        self.hp = 100.0
        self.dead = False
        self.respawn_t = 0.0
        self.last_hurt = -99.0
        self.last_shot = -99.0
        self.ignore_state_until = 0.0
        self.kills = self.deaths = 0
        self.rtt = 0.05                      # 通信の往復時間（秒）
        self.history = deque(maxlen=40)      # ラグ補償用：(時刻, x, y, z) の記録（約2秒分）

    def pos_at(self, t):
        """時刻 t にこのプレイヤーがいた位置（記録の間をなめらかにつなぐ）"""
        h = self.history
        if not h or t >= h[-1][0]:
            return self.x, self.y, self.z
        if t <= h[0][0]:
            return h[0][1:]
        for i in range(len(h) - 1, 0, -1):
            a, b = h[i - 1], h[i]
            if a[0] <= t <= b[0]:
                k = (t - a[0]) / ((b[0] - a[0]) or 1)
                return tuple(a[j] + (b[j] - a[j]) * k for j in (1, 2, 3))
        return self.x, self.y, self.z


class Enemy:
    def __init__(self, eid, etype, x, y, z, hp_mul):
        self.id, self.type = eid, etype
        self.d = ENEMY_TYPES[etype]
        self.x, self.y, self.z = x, y, z
        self.vy = 0.0
        self.max = self.hp = self.d["hp"] * hp_mul
        self.yaw = 0.0
        self.atk_cd = 0.0          # 次に攻撃できるまでの時間
        self.swing = 0.0           # 攻撃の見た目（腕を振り上げている残り時間）
        self.shoot_t = 1.5 + random.random() * 1.5
        self.detour = 1            # 回り道の向き
        self.detour_t = 0.0
        self.strafe = random.choice((1, -1))
