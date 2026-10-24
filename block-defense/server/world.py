"""ブロックの世界：地形データ・地形づくり・視線の当たり判定"""
import base64
import math
import random

from .config import W, D, H, G, AIR, GRASS, DIRT, STONE, PLANK, LOG, LEAF, CORE, PLANK_MAX


class World:
    def __init__(self):
        self.vox = bytearray(W * H * D)
        self.plank_hp: dict[tuple, int] = {}       # 木の板ごとの残り耐久
        self.plank_owner: dict[tuple, str] = {}    # 木の板の持ち主（対戦のチーム名、協力は "all"）

    @staticmethod
    def idx(x, y, z):
        return x + W * (z + D * y)

    def get(self, x, y, z):
        if not (0 <= x < W and 0 <= z < D) or y < 0:
            return STONE          # 世界の外は壁あつかい
        if y >= H:
            return AIR
        return self.vox[self.idx(x, y, z)]

    def set(self, x, y, z, v):
        if 0 <= x < W and 0 <= z < D and 0 <= y < H:
            self.vox[self.idx(x, y, z)] = v

    def solid(self, x, y, z):
        return self.get(x, y, z) != AIR

    def surface(self, x, z):
        """その列のいちばん上の地面の高さ"""
        for y in range(H - 1, -1, -1):
            if self.get(x, y, z) != AIR:
                return y + 1
        return 0

    def add_plank(self, x, y, z, owner):
        self.set(x, y, z, PLANK)
        self.plank_hp[(x, y, z)] = PLANK_MAX
        self.plank_owner[(x, y, z)] = owner

    def remove_plank(self, x, y, z):
        self.set(x, y, z, AIR)
        self.plank_hp.pop((x, y, z), None)
        self.plank_owner.pop((x, y, z), None)

    def generate(self, seed, bases, wall_r):
        """地形を作る。bases: [(x, z, チーム名)]。拠点のまわりを平らにして、木の壁とコアを置く"""
        rnd = random.Random(seed)
        self.vox = bytearray(W * H * D)
        self.plank_hp.clear()
        self.plank_owner.clear()
        ph, pz = rnd.random() * 6, rnd.random() * 6      # 毎ゲーム少し違う地形にする
        flat, blend = wall_r + 1, wall_r + 5

        def dist_to_base(x, z):
            return min(max(abs(x - bx), abs(z - bz)) for bx, bz, _ in bases)

        # 起伏のある地面
        h = [0] * (W * D)
        for z in range(D):
            for x in range(W):
                c = dist_to_base(x, z)
                n = (G + math.sin(x * .23 + ph) * 1.3 + math.cos(z * .19 + pz) * 1.3
                     + math.sin((x + z) * .11 + 1) * 1.6 + math.cos((x - z) * .07) * 1.2)
                if c <= flat + 1:
                    n = G
                elif c < blend:
                    n = G + (n - G) * (c - flat - 1) / (blend - flat - 1)
                h[x + z * W] = math.floor(max(2, min(9, n)) + 0.5)
        # となり同士の段差を1以内にする（歩いて登れるように）
        for _ in range(12):
            for z in range(D):
                for x in range(W):
                    vals = [h[xx + zz * W] for xx, zz in ((x + 1, z), (x - 1, z), (x, z + 1), (x, z - 1))
                            if 0 <= xx < W and 0 <= zz < D]
                    h[x + z * W] = max(max(vals) - 1, min(min(vals) + 1, h[x + z * W]))
        for z in range(D):
            for x in range(W):
                if dist_to_base(x, z) <= flat:
                    h[x + z * W] = G
                hh = h[x + z * W]
                for y in range(hh):
                    self.set(x, y, z, STONE if y < hh - 3 else DIRT if y < hh - 1 else GRASS)

        # 拠点のまわりの木の壁（四方に門）
        for bx, bz, team in bases:
            for z in range(bz - wall_r, bz + wall_r + 1):
                for x in range(bx - wall_r, bx + wall_r + 1):
                    dx, dz = x - bx, z - bz
                    if max(abs(dx), abs(dz)) != wall_r or abs(dx) <= 1 or abs(dz) <= 1:
                        continue
                    for y in (G, G + 1):
                        self.add_plank(x, y, z, team)

        # 木
        made = guard = 0
        while made < 14 and guard < 600:
            guard += 1
            x, z = 3 + rnd.randrange(W - 6), 3 + rnd.randrange(D - 6)
            if dist_to_base(x, z) < blend + 2:
                continue
            g = self.surface(x, z)
            for y in range(g, g + 4):
                self.set(x, y, z, LOG)
            for y in range(g + 2, g + 5):
                lim = 1 if y == g + 4 else 3
                for dz in range(-2, 3):
                    for dx in range(-2, 3):
                        if abs(dx) + abs(dz) <= lim and self.get(x + dx, y, z + dz) == AIR:
                            self.set(x + dx, y, z + dz, LEAF)
            made += 1

        # 拠点コア（2マス分のブロック）
        for bx, bz, _ in bases:
            self.set(bx, G, bz, CORE)
            self.set(bx, G + 1, bz, CORE)

    def encode(self):
        """端末へ送るための文字列（base64）"""
        return base64.b64encode(bytes(self.vox)).decode("ascii")


def ray_vox(world, o, d, max_t):
    """視線がどのブロックに当たるかを1マスずつ調べる（DDA法）。当たれば (距離, 座標, 種類)"""
    x, y, z = math.floor(o[0]), math.floor(o[1]), math.floor(o[2])
    sx, sy, sz = (1 if d[0] > 0 else -1), (1 if d[1] > 0 else -1), (1 if d[2] > 0 else -1)
    ax, ay, az = abs(d[0]) or 1e-9, abs(d[1]) or 1e-9, abs(d[2]) or 1e-9
    tdx, tdy, tdz = 1 / ax, 1 / ay, 1 / az
    tmx = ((x + 1 - o[0]) if sx > 0 else (o[0] - x)) / ax
    tmy = ((y + 1 - o[1]) if sy > 0 else (o[1] - y)) / ay
    tmz = ((z + 1 - o[2]) if sz > 0 else (o[2] - z)) / az
    t = 0.0
    for _ in range(300):
        v = world.get(x, y, z)
        if v != AIR:
            return t, (x, y, z), v
        if tmx < tmy and tmx < tmz:
            x += sx; t = tmx; tmx += tdx
        elif tmy < tmz:
            y += sy; t = tmy; tmy += tdy
        else:
            z += sz; t = tmz; tmz += tdz
        if t > max_t or y >= H + 4:
            return None
    return None


def ray_box(o, d, mn, mx):
    """視線が箱に当たるか。当たれば距離、外れれば -1"""
    t0, t1 = 0.0, 1e9
    for a in range(3):
        dv = d[a] or 1e-9
        ta, tb = (mn[a] - o[a]) / dv, (mx[a] - o[a]) / dv
        if ta > tb:
            ta, tb = tb, ta
        t0, t1 = max(t0, ta), min(t1, tb)
        if t1 < t0:
            return -1
    return t0
