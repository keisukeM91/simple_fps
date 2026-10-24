"""起動の入口：プロジェクトのフォルダで  python -m server  と打つと起動する

ポート番号を変えたいときは  python -m server 8080  のように後ろに付ける
"""
import sys

from .config import PORT
from .network import run

if __name__ == "__main__":
    run(int(sys.argv[1]) if len(sys.argv) > 1 else PORT)
