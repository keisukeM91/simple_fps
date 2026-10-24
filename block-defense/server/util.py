"""小さな道具"""
import math


def num(v, lo, hi, default=0.0):
    """受け取った値を数値にして範囲内に収める（壊れたデータ・極端な値の対策）"""
    try:
        f = float(v)
    except (TypeError, ValueError):
        return default
    if not math.isfinite(f):
        return default
    return max(lo, min(hi, f))


def r3(v):
    """送るデータを小さくするため、小数3けたに丸める"""
    return round(v, 3)
