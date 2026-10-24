"""調整用の値と、ゲーム全体で使う決まった値

ここの数値を変えると、難しさやルールを調整できます（変えたらサーバーを起動し直す）。
※ ワールドの大きさ・ブロックの番号・体の大きさは client/js/core/config.js と同じ値にすること
"""
from pathlib import Path

# ---- 起動 ----
PORT = 8000
SIM_HZ = 20                 # 1秒あたりの計算回数（＝配信回数）
MAX_PLAYERS = 8
CLIENT_DIR = Path(__file__).resolve().parent.parent / "client"   # 配信する画面ファイルの場所

# ---- ワールド ----
W, D, H = 48, 48, 16
CX, CZ, G = 24, 24, 4
AIR, GRASS, DIRT, STONE, PLANK, LOG, LEAF, CORE = 0, 1, 2, 3, 4, 5, 6, 9
PLANK_MAX = 4

# ---- 共通 ----
COLORS = ["#ff5a5a", "#5fe3ff", "#ffd25a", "#7cc04b", "#c58bff", "#ff9f43", "#ff7ae6", "#ffffff"]
PLAYER_W, PLAYER_H, EYE = 0.3, 1.7, 1.55
HEAD_FROM = 1.42            # 足元からこの高さより上に当たったら頭
SHOT_DAMAGE = 24
SHOT_INTERVAL = 0.1         # これより速い連射は無視（ズル防止）
SHOT_RANGE = 60
REACH = 7.5                 # ブロックを置ける・こわせる距離
OVER_WAIT = 12              # 結果を表示する秒数

# ---- 協力プレイ ----
COOP_CORE_MAX = 600
COOP_START_BLOCKS = 20
BREAK_FIRST, BREAK_NEXT = 20, 12
COOP_RESPAWN = 4
WAVE_BONUS_BLOCKS = 5

ENEMY_TYPES = {
    "walker":  dict(hp=60,  spd=1.7, w=0.8,  h=1.7, melee=12, wood=1, reward=2, score=10),
    "shooter": dict(hp=45,  spd=2.3, w=0.75, h=1.6, melee=0,  wood=0, reward=2, score=15),
    "brute":   dict(hp=230, spd=1.1, w=1.25, h=2.3, melee=26, wood=2, reward=5, score=40),
}

# ---- 対戦プレイ ----
TEAMS = {"red": {"name": "赤", "color": "#ff5a5a"}, "blue": {"name": "青", "color": "#5fa8ff"}}
PVP_BASES = {"red": (CX, 10), "blue": (CX, 37)}
PVP_CORE_MAX = 500
PVP_START_BLOCKS = 30
PVP_PREP = 20               # 準備時間（撃てない）
PVP_TIME = 480              # 試合時間（秒）
PVP_RESPAWN = 5
CORE_SHOT_DAMAGE = 10       # コアに1発当てたときのダメージ
HEADSHOT = 1.5              # 頭に当たったときの倍率
KILL_BLOCKS = 3             # 相手を倒したときにチームがもらえる板
MAX_REWIND = 0.3            # ラグ補償でさかのぼる最大秒数
INTERP_DELAY = 0.12         # 端末が他プレイヤーを遅らせて表示している秒数（client の INTERP_DELAY と合わせる）
