// 結果画面（一人用のゲームオーバー／オンラインの試合結果）

import { TEAM_NAME, TEAM_COLOR } from "../core/config.js";
import { $, esc } from "../core/util.js";
import { net } from "../net/connection.js";

function setTitle(text, color) {
  const t = $("overTitle");
  t.textContent = text;
  t.style.color = color;
}

// 一人用
export function showSoloOver({ wave, kills, score, best }) {
  setTitle("コアが壊された！", "var(--danger)");
  $("overStats").innerHTML = `到達ウェーブ　${wave}<br>倒した数　${kills}<br>スコア　${score}<br><span style="color:var(--gold)">ベスト　${best}</span>`;
  $("over").hidden = false;
  $("touch").hidden = true;
}

// オンライン（サーバーから届いた結果 o を表示）
export function renderOver(o) {
  if (o.mode === "pvp") {
    if (!o.winner) setTitle("引き分け", "var(--paper)");
    else if (o.winner === net.team) setTitle("勝利！", "var(--gold)");
    else setTitle("敗北…", "var(--danger)");
  } else setTitle("コアが壊された！", "var(--danger)");

  const pvp = o.mode === "pvp";
  const rows = (o.players || []).map(k =>
    `<tr><td style="color:${k.color}">${esc(k.name)}</td><td>${k.k}</td>${pvp ? `<td>${k.d}</td>` : ""}</tr>`).join("");
  const head = pvp
    ? `<div>${o.winner ? `${TEAM_NAME[o.winner]}チームの勝ち` : "コアの残りが同じでした"}　<span style="color:${TEAM_COLOR.red}">赤 ${o.cores.red}</span> / <span style="color:${TEAM_COLOR.blue}">青 ${o.cores.blue}</span></div>`
    : `<div>到達ウェーブ ${o.wave}　チームのスコア ${o.score}</div>`;
  $("overStats").innerHTML = `${head}<table class="res"><tr><th>なまえ</th><th>倒した</th>${pvp ? "<th>やられた</th>" : ""}</tr>${rows}</table>`;
  $("overNote").textContent = `${Math.ceil(net.overT)} 秒後に待合室へ戻ります`;
}
