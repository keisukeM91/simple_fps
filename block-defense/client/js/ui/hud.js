// ゲーム中の画面表示（四隅のパネル・中央の案内・お知らせ・撃破ログ・照準）

import { TEAM_NAME, TEAM_COLOR } from "../core/config.js";
import { $, mmss } from "../core/util.js";
import { game, P, input } from "../core/state.js";
import { SFX } from "../audio/sfx.js";
import { enemies } from "../game/soloEnemies.js";
import { net } from "../net/connection.js";
import { myKey } from "../net/sync.js";
import { renderLobby } from "./lobby.js";
import { renderOver } from "./results.js";

// ---- 下のほうに出る短いお知らせ ----
let toastTimer = 0;
export function toast(t, sec = 1.6) {
  const el = $("toast");
  el.textContent = t; el.style.opacity = 1;
  toastTimer = sec;
}

// ---- 中央の案内（ms を渡すとその時間で消える） ----
let bannerUntil = 0, bannerTemp = false;
export function setBanner(text, ms) {
  $("bannerT").textContent = text;
  bannerTemp = !!ms;
  bannerUntil = ms ? performance.now() + ms : 0;
}
function expireBanner(clearAll) {
  if (bannerTemp ? performance.now() > bannerUntil : clearAll) { $("bannerT").textContent = ""; bannerTemp = false; }
}

// ---- 被ダメージ・命中の合図 ----
export function flashHurt(d) {
  SFX.hurt();
  $("hurt").style.opacity = Math.min(1, .35 + d / 30);
  setTimeout(() => $("hurt").style.opacity = 0, 160);
}
export function hitMark(head) {
  const c = $("cross");
  c.classList.remove("hit", "head");
  void c.offsetWidth;            // アニメーションをやり直すため
  c.classList.add(head ? "head" : "hit");
  setTimeout(() => c.classList.remove("hit", "head"), 140);
}

// ---- 右上の撃破ログ ----
export function feed(html) {
  const box = $("feed"), d = document.createElement("div");
  d.className = "fl"; d.innerHTML = html;
  box.prepend(d);
  while (box.children.length > 4) box.lastChild.remove();
  setTimeout(() => d.remove(), 5000);
}

// 一人用で始めるときに、表示を最初の状態に戻す
export function resetHudLabels() {
  $("core2").hidden = true;
  $("coreBar").style.background = "";
  $("coreLbl").textContent = "拠点コア";
  $("scoreLbl").textContent = "スコア";
  $("hpLbl").textContent = "体力";
  $("waveLbl").textContent = "ウェーブ";
  document.body.classList.remove("pvp");
}

// ---- 毎フレーム呼ぶ（中身の書き換えは0.1秒ごと） ----
let hudT = 0;
export function updateHud(dt) {
  if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) $("toast").style.opacity = 0; }
  hudT -= dt;
  if (!game.running || hudT > 0) return;
  hudT = .1;
  $("blocks").textContent = game.blocks;
  $("hpBar").style.transform = `scaleX(${P.hp / 100})`;
  if (game.mode === "online") onlineHud(); else soloHud();
}

function soloHud() {
  $("wave").textContent = Math.max(1, game.wave);
  $("left").textContent = game.phase === "fight" ? `残り ${enemies.length + game.queue.length} 体` : "準備時間";
  $("score").textContent = game.score;
  $("coreBar").style.transform = `scaleX(${game.core / game.coreMax})`;
  $("coreTxt").textContent = `${Math.ceil(game.core)} / ${game.coreMax}`;
  $("warn").textContent = game.warnT > 0 ? "拠点が攻撃されている！" : "";
  if (game.phase === "fight") { $("bNext").hidden = true; expireBanner(false); }
}

function onlineHud() {
  const ph = game.phase, pvp = net.mode === "pvp";
  document.body.classList.toggle("pvp", pvp && ph !== "lobby");
  const inLobby = ph === "lobby" || (ph === "wait" && net.connected);
  $("lobby").hidden = !inLobby;
  $("hud").hidden = inLobby;
  $("touch").hidden = inLobby || !input.isTouch;
  if (inLobby) { $("over").hidden = true; renderLobby(); return; }
  if (!net.connected) $("left").textContent = net.status;

  // 左上：協力はウェーブ、対戦は残り時間とチームの撃破数
  if (pvp) {
    $("waveLbl").textContent = "残り時間";
    $("wave").textContent = mmss(net.timeLeft);
    $("left").innerHTML = `<span style="color:${TEAM_COLOR.red}">赤 ${net.teamKills.red}</span> ー <span style="color:${TEAM_COLOR.blue}">青 ${net.teamKills.blue}</span>`;
  } else {
    $("waveLbl").textContent = "ウェーブ";
    $("wave").textContent = Math.max(1, game.wave || 0);
    if (net.connected) $("left").textContent = (ph === "fight" ? `残り ${net.left} 体` : "準備時間") + ` ・ ${net.players}人`;
  }

  // 上：コア（対戦では自分たちと相手の2本）
  const own = net.cores[myKey()] || { hp: 0, max: 1 };
  $("coreLbl").textContent = pvp ? `自分たちのコア（${TEAM_NAME[net.team]}）` : "拠点コア";
  $("coreBar").style.transform = `scaleX(${own.hp / own.max})`;
  $("coreTxt").textContent = `${own.hp} / ${own.max}`;
  $("coreBar").style.background = pvp ? TEAM_COLOR[net.team] : "";
  $("core2").hidden = !pvp;
  if (pvp) {
    const ft = net.team === "red" ? "blue" : "red", foe = net.cores[ft] || { hp: 0, max: 1 };
    $("coreLbl2").textContent = `相手のコア（${TEAM_NAME[ft]}）`;
    $("coreBar2").style.transform = `scaleX(${foe.hp / foe.max})`;
    $("coreTxt2").textContent = `${foe.hp} / ${foe.max}`;
  }

  // 右上・左下
  $("scoreLbl").textContent = pvp ? "倒した数" : "スコア";
  $("score").textContent = pvp ? `${net.kills}` : game.score;
  $("hpLbl").textContent = pvp ? `体力（${TEAM_NAME[net.team]}チーム）` : "体力";
  $("warn").textContent = game.warnT > 0 ? (pvp ? "自分たちのコアが攻撃されている！" : "拠点が攻撃されている！") : "";

  // 中央の案内
  if (ph === "break") {
    setBanner(game.wave === 0 ? `ロボットが来るまで ${Math.ceil(game.breakT)} 秒` : `ウェーブ ${game.wave} 突破！ 次まで ${Math.ceil(game.breakT)} 秒`);
    $("bNext").hidden = false;
  } else if (ph === "prep") {
    setBanner(`準備時間 ${Math.ceil(net.prepT)} 秒（まだ撃てません）`);
    $("bNext").hidden = false;
  } else {
    $("bNext").hidden = true;
    expireBanner(true);
  }
  if (P.dead && ph !== "over") setBanner("少しすると拠点で復活します");

  // 結果
  const showOver = ph === "over" && !!net.over;
  $("over").hidden = !showOver;
  if (showOver) { $("pause").hidden = true; renderOver(net.over); }
}

