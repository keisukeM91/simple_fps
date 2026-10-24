// 待合室（モード選び・チーム分け・開始）

import { TEAM_NAME, TEAM_COLOR } from "../core/config.js";
import { $, esc } from "../core/util.js";
import { input } from "../core/state.js";
import { audioInit } from "../audio/sfx.js";
import { net, netSend } from "../net/connection.js";
import { requestLock } from "../input/controls.js";
import { backToTitle } from "../game/session.js";

let lastKey = "";   // 表示内容が変わったときだけ描き直す

export function renderLobby() {
  const key = JSON.stringify([net.mode, net.plist, net.canStart, net.why, net.id, net.connected, net.status]);
  if (key === lastKey) return;
  lastKey = key;

  const pvp = net.mode === "pvp";
  $("mCoop").classList.toggle("on", !pvp);
  $("mPvp").classList.toggle("on", pvp);
  $("mCoop").setAttribute("aria-pressed", String(!pvp));
  $("mPvp").setAttribute("aria-pressed", String(pvp));

  const li = p => `<li style="color:${p.color}">${esc(p.name)}${p.id === net.id ? "<small>（あなた）</small>" : ""}</li>`;
  if (!net.connected) {
    $("lobbyTeams").innerHTML = `<p class="note">${esc(net.status)}</p>`;
  } else if (pvp) {
    const col = t => `<div class="tcol" style="--tc:${TEAM_COLOR[t]}"><h4>${TEAM_NAME[t]}チーム</h4><ul>${net.plist.filter(p => p.team === t).map(li).join("") || "<li class='empty'>だれもいません</li>"}</ul></div>`;
    $("lobbyTeams").innerHTML = `<div class="tcols">${col("red")}${col("blue")}</div>`;
  } else {
    $("lobbyTeams").innerHTML = `<div class="tcol" style="--tc:var(--core)"><h4>参加している人（${net.plist.length}人）</h4><ul>${net.plist.map(li).join("")}</ul></div>`;
  }
  $("bTeam").hidden = !pvp;
  $("bGo").disabled = !net.canStart || !net.connected;
  $("lobbyNote").textContent = !net.connected ? "" : net.canStart ? "だれが押しても、全員そろってゲームが始まります" : net.why;
}

export function resetLobbyView() { lastKey = ""; }

export function initLobby() {
  $("mCoop").addEventListener("click", () => netSend({ t: "mode", mode: "coop" }));
  $("mPvp").addEventListener("click", () => netSend({ t: "mode", mode: "pvp" }));
  $("bTeam").addEventListener("click", () => netSend({ t: "team", team: net.team === "red" ? "blue" : "red" }));
  $("bGo").addEventListener("click", () => {
    audioInit();
    netSend({ t: "start" });
    if (!input.isTouch) requestLock();
  });
  $("bLeave").addEventListener("click", backToTitle);
}
