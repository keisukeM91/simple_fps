// サーバーとのつながり：接続・切断・送信・届いたメッセージの振り分け
//
// サーバーが「正解」を持つ方式です。
// - この画面が送るもの：自分の位置・向き、撃った、置きたい、こわしたい、待合室での選択
// - サーバーから届くもの：地形、全員の位置と体力、敵、敵の弾、コア、出来事（命中・撃破など）
// 通信の取り決めの一覧は README.md にあります。

import { game } from "../core/state.js";
import { toast } from "../ui/hud.js";
import { resetLobbyView } from "../ui/lobby.js";
import { applySnap, clearNet, loadWorld } from "./sync.js";
import { setCores } from "../render/cores.js";

// オンラインの状態（サーバーから届いた内容を入れておく）
export const net = {
  ws: null, id: null, connected: false, want: false, everOpen: false, name: "", status: "",
  sendT: 0, prevPhase: "",
  mode: "coop", team: "red",
  players: 0, plist: [], names: new Map(), kills: 0, deaths: 0, teamKills: { red: 0, blue: 0 },
  left: 0, cores: {}, prepT: 0, timeLeft: 0, overT: 0, over: null,
  canStart: false, why: "",
};

export function netSend(o) {
  if (net.ws && net.ws.readyState === 1 && net.connected) net.ws.send(JSON.stringify(o));
}

export function connect(name) {
  disconnect();
  net.want = true; net.name = name;
  if (!/^https?:$/.test(location.protocol)) {
    net.status = "サーバーのアドレス（http://…:8000）で開いてください";
    toast(net.status, 4);
    return;
  }
  let ws;
  try { ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`); }
  catch (e) { net.status = "サーバーに接続できません"; return; }
  net.ws = ws; net.status = "接続しています…";

  ws.onopen = () => { net.everOpen = true; ws.send(JSON.stringify({ t: "join", name })); };
  ws.onmessage = ev => {
    let m;
    try { m = JSON.parse(ev.data); } catch (e) { return; }
    onMessage(m);
  };
  ws.onerror = () => { };
  ws.onclose = () => {
    if (net.ws !== ws) return;
    net.connected = false;
    clearNet();
    if (!net.want) return;
    net.status = net.everOpen ? "切断されました。再接続します…" : "サーバーに接続できません。再試行します…";
    setTimeout(() => { if (net.want && net.ws === ws && game.mode === "online") connect(net.name); }, 3000);
  };
}

export function disconnect() {
  net.want = false; net.connected = false; net.id = null; net.prevPhase = "";
  resetLobbyView();
  if (net.ws) { const w = net.ws; net.ws = null; try { w.close(); } catch (e) { /* 無視 */ } }
  clearNet();
}

function onMessage(m) {
  switch (m.t) {
    case "welcome": net.id = m.id; net.connected = true; net.status = `接続しました（${m.name}）`; break;
    case "world": loadWorld(m.data); if (Array.isArray(m.cores)) setCores(m.cores); break;
    case "snap": applySnap(m); break;
    case "info": toast(m.msg, 2.2); break;
    case "ping": if (net.ws && net.ws.readyState === 1) net.ws.send(JSON.stringify({ t: "pong", s: m.s })); break;
    case "full": net.want = false; net.status = "満員のため参加できません"; toast(net.status, 4); break;
  }
}
