"""ブロック防衛線のゲームサーバー

ファイルの役割
  config.py    調整用の値と決まった値
  util.py      小さな道具
  world.py     ブロックの世界（地形データ・地形づくり・視線の当たり判定）
  entities.py  プレイヤーと敵ロボット
  lobby.py     待合室のルール
  coop.py      協力プレイのルール（ウェーブ・敵の動き）
  pvp.py       対戦プレイのルール（ラグ補償つきの命中判定・コア攻撃）
  game.py      ゲーム本体（上の3つのルールを組み合わせ、共通処理を持つ）
  network.py   通信（画面の配信・WebSocket・計算と配信のくり返し）
  __main__.py  起動の入口（python -m server）
"""
