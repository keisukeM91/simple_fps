// サーバーから届いた「出来事」（命中・撃破・地形の変化など）を、音と演出にする

import { AIR, CX, CZ, G, ET } from "../core/config.js";
import { V3, esc } from "../core/util.js";
import { game, P, input } from "../core/state.js";
import { set } from "../world/voxels.js";
import { burst, tracer } from "../render/effects.js";
import { coreList, flashCore } from "../render/cores.js";
import { SFX } from "../audio/sfx.js";
import { toast, hitMark, feed, flashHurt, setBanner } from "../ui/hud.js";
import { net } from "./connection.js";
import { netEnemies, removeNetEnemy, myKey, requestRebuild } from "./sync.js";

const at = a => new V3(a[0], a[1], a[2]);
const nameHtml = id => {
  const n = net.names.get(id);
  return n ? `<span style="color:${n.color}">${esc(n.name)}</span>` : "だれか";
};

export function applyFx(f) {
  const mine = f.pid === net.id;
  switch (f.k) {
    // ---- 射撃 ----
    case "shot":       // 自分の光線は撃った瞬間に表示済み
      if (!mine) { tracer(at(f.a), at(f.b), new THREE.Color(f.c).getHex()); SFX.otherShot(); }
      break;
    case "hit": {      // 敵ロボットに命中
      const e = netEnemies.get(f.id);
      if (e) e.flash = .1;
      burst(at(f.p), 0xffffff, 3, 2);
      if (mine) { SFX.hit(); hitMark(); }
      break;
    }
    case "kill": {     // 敵ロボットを倒した
      const def = ET[f.t] || ET.walker, p = at(f.p).add(new V3(0, def.h * .6, 0));
      burst(p, def.body, 14, 5); burst(p, def.eye, 4, 3);
      removeNetEnemy(f.id);
      if (mine) { SFX.kill(); hitMark(); toast(`+${f.r} 板（みんなで共有）`, 1); } else SFX.otherKill();
      break;
    }
    case "phit":       // 対戦：プレイヤーに命中
      burst(at(f.p), 0xffffff, 4, 2.5);
      if (mine) { SFX.hit(); hitMark(f.head); if (f.head) toast("ヘッドショット！", .8); }
      break;
    case "pkill": {    // 対戦：プレイヤーを倒した
      const by = f.by ? nameHtml(f.by) : "", v = nameHtml(f.v);
      feed(by ? `${by} <b>▶</b> ${v}${f.head ? " ◎" : ""}` : `${v} がやられた`);
      if (f.v === net.id) { const k = net.names.get(f.by); toast(k ? `${k.name} さんに倒された…` : "やられた！", 2.5); }
      if (f.by === net.id) { SFX.kill(); toast("倒した！ チームに +3 板", 1.4); }
      break;
    }
    case "corehit": if (mine) { hitMark(); SFX.coreHitMine(); } break;
    case "deny": if (mine) toast(f.msg, 2.2); break;

    // ---- 地形 ----
    case "block":
      set(f.x, f.y, f.z, f.v);
      requestRebuild();
      if (f.v === AIR) { burst(new V3(f.x + .5, f.y + .5, f.z + .5), 0xc99a5b, 8, 3); if (mine) SFX.brk(); }
      else { burst(new V3(f.x + .5, f.y + .5, f.z + .5), 0xc99a5b, 5, 2); if (mine) SFX.place(); }
      break;
    case "plank": burst(new V3(f.p[0] + .5, f.p[1] + .5, f.p[2] + .5), 0xc99a5b, 3, 2); break;

    // ---- コア・体力 ----
    case "core": {
      const t = f.team || "all";
      flashCore(t);
      const c = coreList.find(c => c.team === t);
      burst(c ? c.g.position.clone().add(new V3(0, 1.2, 0)) : new V3(CX + .5, G + 1.2, CZ + .5), c ? c.color : 0x5fe3ff, 4, 2);
      if (t === myKey()) { game.warnT = 1.5; if (Math.random() < .3) SFX.core(); }
      break;
    }
    case "hurt": if (mine) flashHurt(f.d); break;
    case "eshot": SFX.enemyShot(); break;
    case "respawn":
      if (mine) {
        P.pos.set(f.x, f.y, f.z); P.vel.set(0, 0, 0);
        P.dead = false; P.hp = 100; net.sendT = 0;
        if (typeof f.yaw === "number") { P.yaw = f.yaw; P.pitch = -.05; }
      }
      break;

    // ---- 進行 ----
    case "wave": SFX.wave(); setBanner(`ウェーブ ${f.n} 開始！`, 1800); break;
    case "fight": SFX.wave(); setBanner("試合開始！ 相手のコアをねらえ", 2200); break;
    case "start": toast(`${f.by} さんが${f.mode === "pvp" ? "対戦" : "協力プレイ"}を始めました`, 2.5); break;
    case "clear": toast(`ウェーブ突破！ ボーナス +${f.b} 板`, 2); break;
    case "over": input.firing = false; break;
  }
}

