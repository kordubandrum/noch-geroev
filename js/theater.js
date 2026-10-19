// 3D-театр: сцена, актёры, предметы, эффекты и режиссёр, который разыгрывает
// сценарий из шагов («кто, что делает, куда/на кого»). Движок Three.js.
// Модели героев и скелетов: KayKit (CC0, Kay Lousberg), монстры: Quaternius (CC0).

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { CAST } from './cast.js';

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const gltfCache = new Map();
const loadGltf = (url) => {
  if (!gltfCache.has(url)) gltfCache.set(url, loader.loadAsync(url));
  return gltfCache.get(url);
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

// ---------- места на сцене ----------

export const SLOTS = {
  'left': [-3.2, 0, 0.6], 'center': [0, 0, 0.4], 'right': [3.2, 0, 0.6],
  'back-left': [-3.4, 0, -2.6], 'back': [0, 0, -2.8], 'back-right': [3.4, 0, -2.6],
  'front-left': [-2.4, 0, 2.6], 'front': [0, 0, 2.8], 'front-right': [2.4, 0, 2.6],
};

// Наборы мест: цвет земли, туман, свет и чем засыпать края
const SETS = {
  tavern: { ground: 0x8a5a36, fog: 0x3a2618, light: 0xffd8a8, amb: 0x8a6a50, wall: 0x6a4630, deco: ['table', 'barrel', 'chair', 'torch'], art: 'gorod', indoor: true },
  forest: { ground: 0x3d5a2a, fog: 0x1e2c22, light: 0xcfe8b0, amb: 0x405a40, deco: ['tree', 'tree', 'bush', 'rock'], art: 'les' },
  cave: { ground: 0x5a5560, fog: 0x1c1a26, light: 0xb8c8ff, amb: 0x504a66, wall: 0x3a3646, deco: ['rock', 'rock', 'crystal', 'torch'], art: 'peshera', indoor: true },
  ruins: { ground: 0x6d6a5a, fog: 0x2a2a30, light: 0xffd2a0, amb: 0x505060, deco: ['pillar', 'rock', 'pillar', 'bush'], art: 'ruiny' },
  crypt: { ground: 0x50505c, fog: 0x16161f, light: 0xc8b8ff, amb: 0x46465e, wall: 0x3a3a48, deco: ['coffin', 'pillar', 'torch', 'statue'], art: 'sklep', indoor: true },
  swamp: { ground: 0x3e4a2e, fog: 0x2a3424, light: 0xb8d090, amb: 0x3c4a34, deco: ['tree', 'bush', 'rock', 'bush'], art: 'boloto' },
  mountains: { ground: 0x8a8a90, fog: 0x8090a8, light: 0xffffff, amb: 0x607080, deco: ['rock', 'rock', 'tree', 'rock'], art: 'gory' },
  town: { ground: 0x7a7066, fog: 0x3a3440, light: 0xffe0b0, amb: 0x5a5060, deco: ['crate', 'barrel', 'cart', 'well'], art: 'gorod' },
  village: { ground: 0x5a6a38, fog: 0x3a3a2a, light: 0xffd8a0, amb: 0x5a5040, deco: ['well', 'crate', 'tree', 'cart'], art: 'derevnya' },
  road: { ground: 0x7a6a4a, fog: 0x4a4038, light: 0xffc890, amb: 0x5a4a40, deco: ['tree', 'rock', 'cart', 'bush'], art: 'doroga' },
  steppe: { ground: 0x9a9050, fog: 0x8a8060, light: 0xfff0c0, amb: 0x706a50, deco: ['rock', 'bush', 'statue', 'bush'], art: 'step' },
  arena: { ground: 0xb09a70, fog: 0x3a3028, light: 0xffe8c0, amb: 0x6a5a48, deco: ['pillar', 'torch', 'pillar', 'statue'], art: 'arena1' },
};

const KIND_TO_SET = {
  'лес': 'forest', 'пещера': 'cave', 'руины': 'ruins', 'склеп': 'crypt', 'болото': 'swamp', 'горы': 'mountains',
  'город': 'town', 'деревня': 'village', 'дорога': 'road', 'степь': 'steppe', 'арена': 'arena', 'таверна': 'tavern',
};
export const setForKind = (kind, text = '') => {
  if (/таверн|трактир|корчм|кабак|зал|дворец|замок/i.test(text)) return 'tavern';
  return KIND_TO_SET[kind] || 'road';
};

// ---------- предметы ----------
// Каждый предмет: группа + точки: top (куда запрыгнуть), front (куда подойти), hang (люстра)

const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.85, ...o });
const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
const cyl = (rt, rb, h, m, s = 8) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, s), m);
const cone = (r, h, m, s = 7) => new THREE.Mesh(new THREE.ConeGeometry(r, h, s), m);
const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };

const WOOD = mat(0x7a4e2c), DARKWOOD = mat(0x4e3220), STONE = mat(0x8a8a90), DARKSTONE = mat(0x55555e),
  LEAF = mat(0x3f7a35), LEAF2 = mat(0x2f6a3a), METAL = mat(0x9aa0a8, { metalness: 0.6, roughness: 0.4 }),
  GOLD = mat(0xd4ab52, { metalness: 0.7, roughness: 0.35 }), FLAME = new THREE.MeshBasicMaterial({ color: 0xffa040 }),
  CRYSTAL = mat(0x8fd0ff, { emissive: 0x2a5aa0, roughness: 0.2 });

export const PROPS = {
  table: () => { const g = new THREE.Group(); g.add(at(box(1.8, 0.12, 1, WOOD), 0, 0.85, 0)); for (const [x, z] of [[-0.8, -0.4], [0.8, -0.4], [-0.8, 0.4], [0.8, 0.4]]) g.add(at(box(0.1, 0.85, 0.1, DARKWOOD), x, 0.42, z)); return { g, top: 0.92 }; },
  chair: () => { const g = new THREE.Group(); g.add(at(box(0.5, 0.08, 0.5, WOOD), 0, 0.5, 0)); g.add(at(box(0.5, 0.6, 0.08, WOOD), 0, 0.8, -0.22)); for (const [x, z] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) g.add(at(box(0.06, 0.5, 0.06, DARKWOOD), x, 0.25, z)); return { g, top: 0.55 }; },
  barrel: () => { const g = new THREE.Group(); g.add(at(cyl(0.42, 0.42, 1, WOOD, 10), 0, 0.5, 0)); g.add(at(cyl(0.44, 0.44, 0.06, METAL, 10), 0, 0.25, 0)); g.add(at(cyl(0.44, 0.44, 0.06, METAL, 10), 0, 0.75, 0)); return { g, top: 1.0 }; },
  crate: () => { const g = new THREE.Group(); g.add(at(box(0.9, 0.9, 0.9, WOOD), 0, 0.45, 0)); return { g, top: 0.9 }; },
  chest: () => { const g = new THREE.Group(); g.add(at(box(1, 0.55, 0.6, DARKWOOD), 0, 0.28, 0)); g.add(at(box(1.02, 0.12, 0.62, GOLD), 0, 0.5, 0)); return { g, top: 0.6 }; },
  balcony: () => { const g = new THREE.Group(); g.add(at(box(3, 0.2, 1.4, WOOD), 0, 2.2, 0)); for (const x of [-1.4, 1.4]) g.add(at(box(0.18, 2.2, 0.18, DARKWOOD), x, 1.1, 0.6)); g.add(at(box(3, 0.5, 0.06, DARKWOOD), 0, 2.55, 0.68)); for (let i = 0; i < 6; i++) g.add(at(box(0.5, 0.18, 0.3, WOOD), -1.6 - i * 0.0, 0.18 + i * 0.36, 0.6 - i * 0.0).translateX(-0.3)); return { g, top: 2.3 }; },
  chandelier: () => { const g = new THREE.Group(); g.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.07, 6, 16), METAL), 0, 3.4, 0)); g.children[0].rotation.x = Math.PI / 2; g.add(at(cyl(0.02, 0.02, 2, METAL), 0, 4.4, 0)); for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; g.add(at(cone(0.06, 0.18, FLAME), Math.cos(a) * 0.8, 3.55, Math.sin(a) * 0.8)); } return { g, top: 3.45, hang: true }; },
  pillar: () => { const g = new THREE.Group(); g.add(at(cyl(0.35, 0.4, 3.2, STONE, 8), 0, 1.6, 0)); g.add(at(box(0.9, 0.2, 0.9, STONE), 0, 3.2, 0)); return { g, top: 3.3 }; },
  rock: () => { const g = new THREE.Group(); const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.7, 0), DARKSTONE); r.scale.set(1.2, 0.8, 1); g.add(at(r, 0, 0.45, 0)); return { g, top: 1.0 }; },
  tree: () => { const g = new THREE.Group(); g.add(at(cyl(0.18, 0.26, 1.6, DARKWOOD, 6), 0, 0.8, 0)); g.add(at(cone(1.2, 1.8, LEAF), 0, 2.2, 0)); g.add(at(cone(0.9, 1.4, LEAF2), 0, 3.0, 0)); return { g, top: 1.9, climb: true }; },
  bush: () => { const g = new THREE.Group(); g.add(at(new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 0), LEAF), 0, 0.4, 0)); return { g, top: 0.8 }; },
  torch: () => { const g = new THREE.Group(); g.add(at(cyl(0.05, 0.05, 1.8, DARKWOOD), 0, 0.9, 0)); g.add(at(cone(0.14, 0.35, FLAME), 0, 1.95, 0)); const l = new THREE.PointLight(0xffa040, 6, 6, 1.6); l.position.set(0, 2, 0); g.add(l); return { g, top: 1.8 }; },
  campfire: () => { const g = new THREE.Group(); for (let i = 0; i < 5; i++) { const s = at(box(0.7, 0.1, 0.1, DARKWOOD), 0, 0.08, 0); s.rotation.y = (i / 5) * Math.PI; g.add(s); } g.add(at(cone(0.3, 0.7, FLAME), 0, 0.4, 0)); const l = new THREE.PointLight(0xff9040, 10, 8, 1.5); l.position.set(0, 0.8, 0); g.add(l); return { g, top: 0.2 }; },
  well: () => { const g = new THREE.Group(); g.add(at(cyl(0.7, 0.75, 0.8, STONE, 10), 0, 0.4, 0)); for (const x of [-0.6, 0.6]) g.add(at(box(0.1, 1.4, 0.1, DARKWOOD), x, 1.1, 0)); g.add(at(cone(0.95, 0.5, WOOD, 4), 0, 2.05, 0)); return { g, top: 0.85 }; },
  cart: () => { const g = new THREE.Group(); g.add(at(box(1.8, 0.5, 1.1, WOOD), 0, 0.75, 0)); for (const [x, z] of [[-0.6, 0.6], [0.6, 0.6], [-0.6, -0.6], [0.6, -0.6]]) { const w = at(cyl(0.38, 0.38, 0.1, DARKWOOD, 10), x, 0.38, z); w.rotation.x = Math.PI / 2; g.add(w); } return { g, top: 1.0 }; },
  statue: () => { const g = new THREE.Group(); g.add(at(box(1, 0.6, 1, STONE), 0, 0.3, 0)); g.add(at(cyl(0.25, 0.35, 1.4, STONE), 0, 1.3, 0)); g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), STONE), 0, 2.2, 0)); return { g, top: 0.6 }; },
  altar: () => { const g = new THREE.Group(); g.add(at(box(1.6, 0.9, 0.8, DARKSTONE), 0, 0.45, 0)); g.add(at(cone(0.08, 0.25, FLAME), -0.6, 1.05, 0)); g.add(at(cone(0.08, 0.25, FLAME), 0.6, 1.05, 0)); return { g, top: 0.9 }; },
  coffin: () => { const g = new THREE.Group(); g.add(at(box(0.8, 0.5, 2, DARKWOOD), 0, 0.25, 0)); g.add(at(box(0.84, 0.08, 2.04, WOOD), 0, 0.52, 0)); return { g, top: 0.55 }; },
  throne: () => { const g = new THREE.Group(); g.add(at(box(1.1, 0.6, 1, GOLD), 0, 0.3, 0)); g.add(at(box(1.1, 1.8, 0.2, GOLD), 0, 1.2, -0.42)); return { g, top: 0.6 }; },
  door: () => { const g = new THREE.Group(); g.add(at(box(1.4, 2.4, 0.15, DARKWOOD), 0, 1.2, 0)); g.add(at(box(1.8, 0.3, 0.3, STONE), 0, 2.5, 0)); return { g, top: 0 }; },
  bridge: () => { const g = new THREE.Group(); g.add(at(box(4, 0.2, 1.4, WOOD), 0, 0.8, 0)); for (const x of [-1.8, 1.8]) g.add(at(box(0.2, 0.8, 1.4, DARKWOOD), x, 0.4, 0)); return { g, top: 0.9 }; },
  crystal: () => { const g = new THREE.Group(); for (let i = 0; i < 3; i++) { const c = at(cone(0.22, 1.2 - i * 0.3, CRYSTAL, 5), (i - 1) * 0.3, 0.5, (i % 2) * 0.2); c.rotation.z = (i - 1) * 0.3; g.add(c); } return { g, top: 1.0 }; },
  cage: () => { const g = new THREE.Group(); for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; g.add(at(cyl(0.03, 0.03, 2, METAL, 4), Math.cos(a) * 0.7, 1, Math.sin(a) * 0.7)); } g.add(at(cyl(0.75, 0.75, 0.1, METAL, 10), 0, 2, 0)); return { g, top: 2.05 }; },
  ladder: () => { const g = new THREE.Group(); for (const x of [-0.3, 0.3]) g.add(at(box(0.08, 3, 0.08, WOOD), x, 1.5, 0)); for (let i = 0; i < 8; i++) g.add(at(box(0.6, 0.05, 0.06, WOOD), 0, 0.3 + i * 0.36, 0)); return { g, top: 2.9 }; },
  tent: () => { const g = new THREE.Group(); g.add(at(cone(1.4, 2, mat(0xa08060), 4), 0, 1, 0)); return { g, top: 0 }; },
};

export const PROP_WORDS = [
  ['chandelier', ['люстр']], ['balcony', ['балкон', 'галере', 'антресол']], ['table', ['стол', 'прилав', 'стойк']],
  ['chair', ['стул', 'табурет', 'скамь', 'лавк']], ['barrel', ['бочк', 'бочон']], ['crate', ['ящик', 'короб']],
  ['chest', ['сундук', 'ларец']], ['pillar', ['колонн', 'столб']], ['rock', ['камен', 'камн', 'валун', 'скал']],
  ['tree', ['дерев', 'дуб', 'сосн', 'ель', 'ёлк', 'ветк']], ['bush', ['куст']], ['torch', ['факел']],
  ['campfire', ['костёр', 'костер', 'костр', 'огонь в очаге', 'очаг']], ['well', ['колодец', 'колодц']], ['cart', ['телег', 'повоз', 'карет']],
  ['statue', ['статуя', 'статую', 'стату', 'изваян']], ['altar', ['алтар', 'жертвен']], ['coffin', ['гроб', 'саркофаг']],
  ['throne', ['трон']], ['door', ['двер', 'ворот']], ['bridge', ['мост']], ['crystal', ['кристал']], ['cage', ['клетк']],
  ['ladder', ['лестниц']], ['tent', ['палатк', 'шатёр', 'шатер']],
];

export function propFromText(text) {
  const t = String(text || '').toLowerCase();
  const hit = PROP_WORDS.find(([, ws]) => ws.some((w) => t.includes(w)));
  return hit ? hit[0] : null;
}

// ---------- эффекты ----------

class Fx {
  constructor(scene) { this.scene = scene; this.items = []; }

  burst(pos, color = 0xffa040, n = 40, speed = 3, life = 0.8, up = 0) {
    const geo = new THREE.BufferGeometry();
    const p = new Float32Array(n * 3), v = [];
    for (let i = 0; i < n; i++) {
      p.set([pos.x, pos.y, pos.z], i * 3);
      const d = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.3 + up, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.4 + Math.random()));
      v.push(d);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const m = new THREE.PointsMaterial({ color, size: 0.18, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const pts = new THREE.Points(geo, m);
    this.scene.add(pts);
    this.items.push({ t: 0, life, upd: (dt, k) => {
      const a = geo.attributes.position;
      for (let i = 0; i < n; i++) { a.array[i * 3] += v[i].x * dt; a.array[i * 3 + 1] += v[i].y * dt; a.array[i * 3 + 2] += v[i].z * dt; v[i].y -= up ? 0 : 3 * dt; }
      a.needsUpdate = true; m.opacity = 1 - k;
    }, end: () => { this.scene.remove(pts); geo.dispose(); m.dispose(); } });
  }

  heal(pos) { this.burst(pos.clone().setY(pos.y + 0.5), 0x7fe3c9, 50, 1.6, 1.4, 2); }

  ring(pos, color = 0xd4ab52) {
    const m = new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
    const r = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.45, 32), m);
    r.rotation.x = -Math.PI / 2; r.position.copy(pos).setY(0.05);
    this.scene.add(r);
    this.items.push({ t: 0, life: 0.7, upd: (dt, k) => { r.scale.setScalar(1 + k * 4); m.opacity = 1 - k; }, end: () => { this.scene.remove(r); r.geometry.dispose(); m.dispose(); } });
  }

  // Летящий снаряд: магия, стрела, брошенный предмет. Возвращает обещание прилёта.
  projectile(from, to, kind = 'magic', color = 0xff8030) {
    return new Promise((resolve) => {
      let obj;
      if (kind === 'arrow') { obj = cyl(0.025, 0.025, 0.7, mat(0x6a4a2a), 4); obj.add(at(cone(0.06, 0.15, METAL, 4), 0, 0.4, 0)); }
      else if (kind === 'throw') obj = box(0.25, 0.25, 0.25, WOOD);
      else { obj = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), new THREE.MeshBasicMaterial({ color })); const l = new THREE.PointLight(color, 8, 5); obj.add(l); }
      obj.position.copy(from);
      this.scene.add(obj);
      const dist = from.distanceTo(to), dur = Math.max(0.25, dist / (kind === 'arrow' ? 18 : 10));
      const arc = kind === 'throw' ? 1.5 : kind === 'arrow' ? 0.4 : 0.2;
      this.items.push({ t: 0, life: dur, upd: (dt, k) => {
        obj.position.lerpVectors(from, to, k); obj.position.y += Math.sin(k * Math.PI) * arc;
        if (kind === 'arrow') { obj.lookAt(to); obj.rotateX(Math.PI / 2); }
        if (kind === 'throw') obj.rotation.x += dt * 12;
        if (kind === 'magic' && Math.random() < 0.6) this.burst(obj.position.clone(), color, 3, 0.6, 0.35);
      }, end: () => { this.scene.remove(obj); resolve(); } });
    });
  }

  lightning(from, to) {
    const pts = [];
    for (let i = 0; i <= 10; i++) { const p = from.clone().lerp(to, i / 10); if (i && i < 10) p.add(new THREE.Vector3((Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6)); pts.push(p); }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const m = new THREE.LineBasicMaterial({ color: 0xbfe0ff, transparent: true });
    const line = new THREE.Line(geo, m);
    const l = new THREE.PointLight(0x9fd0ff, 30, 12); l.position.copy(to);
    this.scene.add(line, l);
    this.items.push({ t: 0, life: 0.45, upd: (dt, k) => { m.opacity = Math.random() > 0.3 ? 1 - k : 0.1; l.intensity = 30 * (1 - k); }, end: () => { this.scene.remove(line, l); geo.dispose(); m.dispose(); } });
  }

  update(dt) {
    for (const it of [...this.items]) {
      it.t += dt;
      const k = Math.min(1, it.t / it.life);
      it.upd(dt, k);
      if (k >= 1) { it.end(); this.items.splice(this.items.indexOf(it), 1); }
    }
  }
}

// ---------- актёр ----------

let animClips = null;
async function kaykitClips() {
  if (!animClips) animClips = loadGltf('models/anims.glb').then((g) => g.animations);
  return animClips;
}

// Подбор клипа по смыслу: у KayKit и у разных монстров Quaternius названия свои
const CLIP_ALIASES = {
  idle: ['Idle', 'Idle_Combat', 'Flying_Idle', 'Flying', 'Unarmed_Idle', 'Idle_2'],
  walk: ['Walking_A', 'Walk', 'WalkSlow', 'Flying_Idle', 'Flying', 'Fast_Flying'],
  run: ['Running_A', 'Run', 'Running', 'Gallop', 'Fast_Flying', 'Flying', 'Walk'],
  jump: ['Jump_Full_Long', 'Jump', 'Gallop_Jump', 'Jump_Start', 'Jump_Loop', 'Jump_Idle', 'Fast_Flying', 'Flying'],
  jump_short: ['Jump_Full_Short', 'Jump', 'Jump_Start', 'Gallop_Jump', 'Fast_Flying', 'Flying'],
  attack: ['1H_Melee_Attack_Chop', 'Attack', 'Weapon', 'Punch', 'Bite_Front', 'Headbutt', 'Attack_Headbutt'],
  attack2h: ['2H_Melee_Attack_Chop', 'Attack', 'Weapon', 'Attack2', 'Punch', 'Headbutt'],
  attack_dual: ['Dualwield_Melee_Attack_Stab', 'Attack', 'Weapon', 'Punch'],
  attack_jump: ['1H_Melee_Attack_Jump_Chop', '2H_Melee_Attack_Chop', 'Attack2', 'Attack', 'Weapon', 'Punch'],
  spin: ['2H_Melee_Attack_Spin', 'Attack2', 'Attack', 'Weapon', 'Punch'],
  shoot: ['2H_Ranged_Shoot', '1H_Ranged_Shoot', 'Attack', 'Weapon', 'Punch'],
  cast: ['Spellcast_Shoot', 'Spellcast_Long', 'Attack', 'Weapon', 'Punch', 'Headbutt'],
  summon: ['Spellcast_Summon', 'Spellcast_Raise', 'Spellcast_Long', 'Wave', 'Yes', 'Spawn'],
  throw: ['Throw', 'Punch', 'Weapon', 'Attack'],
  punch: ['Unarmed_Melee_Attack_Punch_A', 'Punch', 'Weapon', 'Attack'],
  kick: ['Unarmed_Melee_Attack_Kick', 'Attack_Kick', 'Punch', 'Weapon', 'Attack'],
  block: ['Block', 'Blocking', 'Duck', 'No'],
  dodge: ['Dodge_Backward', 'Dodge_Left', 'Duck', 'Jump', 'Jump_Start'],
  dodge_fwd: ['Dodge_Forward', 'Roll', 'Jump'],
  hit: ['Hit_A', 'HitReact', 'HitRecieve', 'Hit', 'Idle_HitReact_Left', 'Hit_B', 'No'],
  die: ['Death_A', 'Death', 'Death_B'],
  cheer: ['Cheer', 'Dance', 'Yes', 'Wave', 'Jump'],
  taunt: ['Taunt', 'No', 'Wave', 'Yes', 'Attack2'],
  talk: ['Interact', 'Wave', 'Yes', 'Idle'],
  use: ['Use_Item', 'Interact', 'PickUp', 'Idle_Eating', 'Eating'],
  pickup: ['PickUp', 'Interact', 'Duck', 'Eating'],
  sit: ['Sit_Floor_Down', 'Sit_Chair_Idle', 'Duck'],
  lie: ['Lie_Down', 'Death_A', 'Death'],
  getup: ['Lie_StandUp', 'Idle'],
  rise: ['Skeletons_Awaken_Floor', 'Spawn', 'Lie_StandUp', 'Idle'],
  fly: ['Fast_Flying', 'Flying', 'Flying_Idle', 'Jump'],
};

const normClip = (n) => n.split('|').pop().replace(/^(Dragon|Bat|Rat|Spider|Snake|Slime|Skeleton)_/, '');

class Actor {
  constructor(theater, spec) {
    this.t = theater;
    this.id = spec.id;
    this.name = spec.name;
    this.spec = spec;
    this.root = new THREE.Group();
    this.scale = 1;
    this.height = 2.2;
    this.ready = this.load();
    this.flying = false;
  }

  async load() {
    const c = CAST.resolve(this.spec);
    this.cast = c;
    const g = await loadGltf(c.url);
    const model = SkeletonUtils.clone(g.scene);
    // оружие в руках: остальное прячем
    if (c.weaponNodes) model.traverse((o) => { if (c.weaponNodes.includes(o.name)) o.visible = (c.show || []).includes(o.name); });
    const skinCol = c.tint ? new THREE.Color(c.tint) : null;
    const bodyCol = c.bodyTint ? new THREE.Color(c.bodyTint) : null;
    model.traverse((o) => {
      if (!o.isMesh) return;
      o.frustumCulled = false;
      const isSkin = skinCol && c.tintParts && c.tintParts.some((p) => o.name.includes(p));
      const col = isSkin ? skinCol : (skinCol && !c.tintParts) ? skinCol : bodyCol;
      if (col) { o.material = o.material.clone(); o.material.color.multiply(col); }
    });
    // рост: меряем видимые части и приводим к росту из кастинга
    model.updateMatrixWorld(true);
    const box = new THREE.Box3(), tmp = new THREE.Box3();
    const shown = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
    model.traverse((o) => {
      if (!o.isMesh || !shown(o)) return;
      if (o.isSkinnedMesh) { o.skeleton.update(); o.computeBoundingBox(); tmp.copy(o.boundingBox); }
      else { o.geometry.computeBoundingBox(); tmp.copy(o.geometry.boundingBox); }
      box.union(tmp.applyMatrix4(o.matrixWorld));
    });
    const h0 = Math.max(0.05, box.max.y - box.min.y);
    const k = (c.h || 2.2) / h0;
    model.scale.set(k * (c.wide || 1), k, k * (c.wide || 1));
    model.position.y = -box.min.y * k;
    this.root.add(model);
    this.model = model;
    this.height = c.h || 2.2;
    this.scale = this.height / 2.2;
    this.flying = !!c.flying;
    if (c.ears || c.horns) this.addHeadgear(model, c);
    this.mixer = new THREE.AnimationMixer(model);
    const clips = c.kaykit ? await kaykitClips() : g.animations;
    this.clips = new Map();
    for (const cl of clips) { const n = normClip(cl.name); if (!this.clips.has(n)) this.clips.set(n, cl); }
    this.clipNames = [...this.clips.keys()];
    this.play('idle', { loop: true });
  }

  // Уши эльфа и гнома, рога тифлинга и драконорождённого: крепятся к кости головы
  addHeadgear(model, c) {
    const head = model.getObjectByName('head');
    if (!head) return;
    const wp = new THREE.Vector3(), ws = new THREE.Vector3();
    head.getWorldScale(ws);
    const u = 1 / (ws.y || 1); // единица длины в системе кости
    const add = (geo, color, x, y, z, rz) => {
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, flatShading: true }));
      m.position.set(x * u, y * u, z * u); m.rotation.z = rz; m.scale.setScalar(u);
      head.add(m);
    };
    void wp;
    if (c.ears) for (const s of [-1, 1]) add(new THREE.ConeGeometry(0.05, 0.28, 4), c.tint || 0xf0c8a0, s * 0.33, 0.42, 0.02, -s * 1.15);
    if (c.horns) for (const s of [-1, 1]) add(new THREE.ConeGeometry(0.06, 0.3, 5), c.horns, s * 0.18, 0.78, 0.04, -s * 0.45);
  }

  clip(kind) {
    const names = CLIP_ALIASES[kind] || [kind];
    for (const n of names) if (this.clips.has(n)) return this.clips.get(n);
    // запасной поиск по части имени (у монстров названия бывают разные)
    return this.clips.get('Idle') || this.clips.get(this.clipNames[0]);
  }

  // Проиграть анимацию. Возвращает обещание конца (для разовых) или сразу (для циклов)
  play(kind, { loop = false, fade = 0.18, speed = 1, hold = false } = {}) {
    if (!this.mixer) return Promise.resolve();
    const cl = this.clip(kind);
    if (!cl) return Promise.resolve();
    const a = this.mixer.clipAction(cl);
    a.reset();
    a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    a.clampWhenFinished = !loop;
    a.timeScale = speed * this.t.speed;
    if (this.cur && this.cur !== a) a.crossFadeFrom(this.cur, fade, false);
    a.play();
    this.cur = a;
    if (loop) return Promise.resolve();
    const dur = (cl.duration / (speed * this.t.speed)) * 1000;
    return sleep(Math.max(200, dur - fade * 1000)).then(() => {
      if (!hold && this.cur === a && !this.dead) this.play(this.restClip(), { loop: true });
    });
  }

  restClip() {
    return this.combat ? 'idle' : 'idle';
  }

  get pos() { return this.root.position; }

  head() { return this.root.position.clone().setY(this.root.position.y + this.height); }
  chest() { return this.root.position.clone().setY(this.root.position.y + this.height * 0.55); }

  face(target) {
    const p = target.isVector3 ? target : target.pos;
    const dx = p.x - this.pos.x, dz = p.z - this.pos.z;
    if (Math.abs(dx) + Math.abs(dz) < 0.01) return;
    this.root.rotation.y = Math.atan2(dx, dz);
  }

  async moveTo(p, { run = true, stopShort = 0, y = null } = {}) {
    const from = this.pos.clone();
    const to = p.clone();
    if (stopShort) {
      const dir = to.clone().sub(from).setY(0);
      const len = dir.length();
      if (len > stopShort) to.copy(from).add(dir.multiplyScalar((len - stopShort) / len));
      else to.copy(from);
    }
    if (y !== null) to.y = y; else to.y = from.y;
    const dist = from.distanceTo(to);
    if (dist < 0.05) return;
    this.face(to);
    const speed = (run ? 4.2 : 1.8) * this.t.speed;
    this.play(this.flying ? 'fly' : run ? 'run' : 'walk', { loop: true });
    await this.t.tween(dist / speed, (k) => this.pos.lerpVectors(from, to, k));
    this.play('idle', { loop: true });
  }

  async jumpTo(p, height = 1.2) {
    const from = this.pos.clone(), to = p.clone();
    this.face(to);
    const dist = from.distanceTo(to);
    const dur = Math.max(0.7, Math.min(1.4, dist / 4));
    this.play('jump', { speed: 1.25 / dur, hold: true });
    await sleep(120);
    const peak = Math.max(from.y, to.y) + height + dist * 0.15;
    await this.t.tween(dur, (k) => {
      this.pos.x = lerp(from.x, to.x, k); this.pos.z = lerp(from.z, to.z, k);
      const base = lerp(from.y, to.y, k);
      this.pos.y = base + Math.sin(k * Math.PI) * (peak - base) * (k < 0.5 ? 1 : (1 - (to.y - base) / Math.max(0.01, peak - base)));
    });
    this.pos.copy(to);
    this.t.fx.ring(to);
    this.play('idle', { loop: true });
  }

  async die() {
    this.dead = true;
    await this.play('die', { hold: true });
  }

  setHp(hp, max) {
    this.hp = hp; this.maxHp = max;
    this.t.updateLabel(this);
  }
}

// ---------- театр ----------

export class Theater {
  constructor(container, { onTapActor } = {}) {
    this.el = container;
    this.onTapActor = onTapActor;
    this.speed = 1;
    this.actors = new Map();
    this.props = new Map();
    this.labels = new Map();
    this.tweens = [];

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    container.append(this.renderer.domElement);
    this.overlay = document.createElement('div');
    this.overlay.className = 'stage-overlay';
    container.append(this.overlay);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
    this.camHome = { pos: new THREE.Vector3(0, 6, 13.5), look: new THREE.Vector3(0, 1.3, 0) };
    this.camera.position.copy(this.camHome.pos);
    this.camLook = this.camHome.look.clone();
    this.camera.lookAt(this.camLook);
    this.shake = 0;

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x404040, 2.4);
    this.fill = new THREE.DirectionalLight(0xffffff, 1.1);
    this.fill.position.set(-3, 4, 10);
    this.scene.add(this.fill);
    this.sun = new THREE.DirectionalLight(0xffffff, 2.6);
    this.sun.position.set(4, 10, 6);
    this.scene.add(this.hemi, this.sun);

    this.world = new THREE.Group();
    this.scene.add(this.world);
    this.fx = new Fx(this.scene);
    this.clock = new THREE.Clock();
    this.raycaster = new THREE.Raycaster();

    this.resize();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.renderer.domElement.addEventListener('pointerup', (e) => this.tap(e));
    this.running = true;
    this.loop();
  }

  resize() {
    const w = this.el.clientWidth || 360, h = this.el.clientHeight || 300;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.camera.aspect = w / h;
    // На узком экране отодвигаем камеру, чтобы сцена влезала
    this.camera.fov = w / h < 0.9 ? 52 : 42;
    this.camera.updateProjectionMatrix();
    if (this.actors && !this.camTarget) this.wide();
  }

  loop() {
    if (!this.running) return;
    requestAnimationFrame(() => this.loop());
    const dt = Math.min(0.05, this.clock.getDelta());
    for (const a of this.actors.values()) a.mixer?.update(dt);
    for (const tw of [...this.tweens]) {
      tw.t += dt;
      const k = Math.min(1, tw.t / tw.dur);
      tw.fn(tw.ease ? ease(k) : k);
      if (k >= 1) { this.tweens.splice(this.tweens.indexOf(tw), 1); tw.done(); }
    }
    this.fx.update(dt);
    // камера плавно смотрит туда, куда её направили
    this.camera.position.lerp(this.camTarget?.pos || this.camHome.pos, 1 - Math.pow(0.02, dt));
    this.camLook.lerp(this.camTarget?.look || this.camHome.look, 1 - Math.pow(0.02, dt));
    const cam = this.camera.position.clone();
    if (this.shake > 0) { this.shake = Math.max(0, this.shake - dt * 2); cam.x += (Math.random() - 0.5) * this.shake; cam.y += (Math.random() - 0.5) * this.shake; }
    const real = this.camera.position.clone();
    this.camera.position.copy(cam);
    this.camera.lookAt(this.camLook);
    this.renderer.render(this.scene, this.camera);
    this.camera.position.copy(real);
    this.placeLabels();
  }

  tween(sec, fn, easeIt = true) {
    return new Promise((done) => this.tweens.push({ t: 0, dur: Math.max(0.01, sec), fn, done, ease: easeIt }));
  }

  dispose() {
    this.running = false;
    this.ro.disconnect();
    this.renderer.dispose();
    this.renderer.forceContextLoss?.();
    this.el.innerHTML = '';
  }

  // ---------- место ----------

  setStage(setKey, { seed = 1, background = null } = {}) {
    const S = SETS[setKey] || SETS.road;
    this.setKey = setKey;
    this.world.clear();
    this.props.clear();
    this.scene.fog = new THREE.Fog(S.fog, 14, 34);
    this.hemi.color.set(S.light); this.hemi.groundColor.set(S.amb);
    this.sun.color.set(S.light);
    // земля
    const groundGeo = new THREE.CircleGeometry(16, 40);
    const colors = [];
    const base = new THREE.Color(S.ground);
    const pos = groundGeo.attributes.position;
    let rnd = seed;
    const rand = () => { rnd = (rnd * 16807) % 2147483647; return (rnd % 1000) / 1000; };
    for (let i = 0; i < pos.count; i++) { const c = base.clone().offsetHSL(0, 0, (rand() - 0.5) * 0.08); colors.push(c.r, c.g, c.b); }
    groundGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    this.world.add(ground);
    if (S.indoor) {
      // стены с балками и тёплым светом, чтобы помещение не тонуло в темноте
      const wm = mat(S.wall || 0x5a4030);
      this.world.add(at(box(30, 8, 0.4, wm), 0, 4, -7));
      for (const x of [-12, 12]) { const w = at(box(0.4, 8, 16, wm), x, 4, 0); this.world.add(w); }
      for (let x = -10; x <= 10; x += 4) this.world.add(at(box(0.35, 8, 0.5, DARKWOOD), x, 4, -6.7));
      for (const x of [-6, 0, 6]) { const l = new THREE.PointLight(0xffb070, 18, 14, 1.4); l.position.set(x, 4.5, -2); this.world.add(l); }
    }
    // фон: картина места из библиотеки
    const art = background || `art/places/${S.art}.webp`;
    new THREE.TextureLoader().load(art, (tx) => {
      tx.colorSpace = THREE.SRGBColorSpace;
      if (!S.indoor) this.scene.background = tx;
    }, undefined, () => {});
    this.scene.background = new THREE.Color(S.fog);
    // декорации по краям, центр свободен для действия
    for (let i = 0; i < 10; i++) {
      const kind = S.deco[i % S.deco.length];
      const a = (i / 10) * Math.PI * 2 + rand() * 0.4;
      const r = 7 + rand() * 4;
      const x = Math.cos(a) * r, z = Math.sin(a) * r * 0.7 - 2;
      if (z > 3) continue;
      const p = PROPS[kind]();
      p.g.position.set(x, 0, z);
      p.g.rotation.y = rand() * Math.PI;
      p.g.scale.setScalar(0.9 + rand() * 0.5);
      this.world.add(p.g);
    }
  }

  // Поставить предмет, с которым будут взаимодействовать. Возвращает его описание.
  addProp(id, type, slot) {
    if (this.props.has(id)) return this.props.get(id);
    const make = PROPS[type] || PROPS.crate;
    const p = make();
    const s = SLOTS[slot] || this.freeSlot();
    p.g.position.set(s[0], 0, s[1] === undefined ? 0 : s[2]);
    p.g.position.set(s[0], 0, s[2]);
    this.world.add(p.g);
    const info = { id, type, g: p.g, top: p.top, hang: p.hang, pos: p.g.position.clone() };
    this.props.set(id, info);
    this.fx.burst(info.pos.clone().setY(0.3), 0xd4ab52, 20, 1.5, 0.6, 1);
    return info;
  }

  freeSlot() {
    const used = [...this.props.values()].map((p) => p.pos);
    const order = ['back', 'back-left', 'back-right', 'center', 'left', 'right'];
    for (const k of order) {
      const s = SLOTS[k];
      if (!used.some((u) => Math.hypot(u.x - s[0], u.z - s[2]) < 1.5)) return s;
    }
    return SLOTS.back;
  }

  // ---------- актёры ----------

  async addActor(spec, slot) {
    if (this.actors.has(spec.id)) return this.actors.get(spec.id);
    const a = new Actor(this, spec);
    this.actors.set(spec.id, a);
    const s = Array.isArray(slot) ? slot : SLOTS[slot] || SLOTS.center;
    a.root.position.set(s[0], 0, s[2]);
    a.root.rotation.y = spec.side === 'B' ? -Math.PI / 2.4 : Math.PI / 2.4;
    this.world.add(a.root);
    this.makeLabel(a);
    try { await a.ready; } catch (e) { console.error('model', spec, e); }
    if (a.flying) a.root.position.y = 0.6;
    if (!this.camTarget) this.wide();
    return a;
  }

  removeActor(id) {
    const a = this.actors.get(id);
    if (!a) return;
    this.world.remove(a.root);
    this.labels.get(id)?.remove();
    this.labels.delete(id);
    this.actors.delete(id);
  }

  makeLabel(a) {
    const el = document.createElement('button');
    el.className = 'actor-label' + (a.spec.side === 'B' ? ' foe' : '');
    el.innerHTML = `<span class="n"></span><span class="hp"><i></i></span>`;
    el.querySelector('.n').textContent = a.name;
    el.addEventListener('click', (e) => { e.stopPropagation(); this.onTapActor?.(a.id); });
    this.overlay.append(el);
    this.labels.set(a.id, el);
  }

  updateLabel(a) {
    const el = this.labels.get(a.id);
    if (!el) return;
    const hpEl = el.querySelector('.hp');
    if (a.maxHp) {
      hpEl.style.display = '';
      hpEl.querySelector('i').style.width = Math.max(0, (a.hp / a.maxHp) * 100) + '%';
    } else hpEl.style.display = 'none';
    el.classList.toggle('down', !!a.dead);
  }

  setLabelState(id, cls, on) { this.labels.get(id)?.classList.toggle(cls, on); }

  screenPos(v) {
    const p = v.clone().project(this.camera);
    return { x: (p.x * 0.5 + 0.5) * this.el.clientWidth, y: (-p.y * 0.5 + 0.5) * this.el.clientHeight, behind: p.z > 1 };
  }

  placeLabels() {
    for (const [id, el] of this.labels) {
      const a = this.actors.get(id);
      if (!a) continue;
      const s = this.screenPos(a.head().add(new THREE.Vector3(0, 0.25, 0)));
      el.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -100%)`;
      el.style.opacity = s.behind ? 0 : 1;
    }
    for (const b of this.bubbles || []) {
      const s = this.screenPos(b.actor.head().add(new THREE.Vector3(0, 0.9, 0)));
      b.el.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -100%)`;
    }
  }

  floatText(actor, text, cls = 'dmg') {
    const s = this.screenPos(actor.chest());
    const f = document.createElement('div');
    f.className = 'float ' + cls;
    f.textContent = text;
    f.style.left = s.x + 'px'; f.style.top = s.y + 'px';
    this.overlay.append(f);
    setTimeout(() => f.remove(), 1200);
  }

  say(actor, text, ms = 2600) {
    if (!text) return;
    this.bubbles = this.bubbles || [];
    const el = document.createElement('div');
    el.className = 'bubble';
    el.textContent = text;
    this.overlay.append(el);
    const b = { el, actor };
    this.bubbles.push(b);
    setTimeout(() => { el.remove(); this.bubbles = this.bubbles.filter((x) => x !== b); }, ms / this.speed);
  }

  tap(e) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const m = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(m, this.camera);
    let best = null, bestD = Infinity;
    for (const a of this.actors.values()) {
      const hit = this.raycaster.ray.distanceToPoint(a.chest());
      if (hit < 0.9 * a.scale + 0.3 && hit < bestD) { best = a; bestD = hit; }
    }
    if (best) this.onTapActor?.(best.id);
  }

  // ---------- камера ----------

  focus(actor, target = null) {
    if (!actor) { this.camTarget = null; return; }
    const a = actor.pos.clone();
    const b = target ? target.pos.clone() : a.clone();
    const mid = a.clone().lerp(b, 0.5);
    const spread = Math.max(2.5, a.distanceTo(b));
    const look = mid.clone().setY(1.2 + Math.max(a.y, b.y) * 0.6);
    this.camTarget = { pos: new THREE.Vector3(mid.x * 0.7, 3.4 + look.y * 0.6 + spread * 0.3, mid.z + 7.5 + spread * 1.0), look };
  }

  // Общий план: камера отъезжает, чтобы в кадр влезли все
  wide() {
    this.camTarget = null;
    let span = 4;
    for (const a of this.actors.values()) if (a.root.visible) span = Math.max(span, Math.abs(a.pos.x) + 1.2, Math.abs(a.pos.z) * 0.8 + 1);
    const hfov = 2 * Math.atan(Math.tan((this.camera.fov * Math.PI) / 360) * this.camera.aspect);
    const dist = Math.max(11, Math.min(24, span / Math.tan(hfov / 2) + 2));
    this.camHome.pos.set(0, 4 + dist * 0.18, dist);
  }

  // ---------- режиссёр ----------
  // beat: {who, do, to, target, say, fx}
  // to: место (left, back-right…), id предмета, id актёра
  // do: walk run jump climb attack shoot cast throw kick punch block dodge hit die fall getup cheer taunt talk use pickup sit sneak appear vanish fly summon rise

  where(ref, from) {
    if (!ref) return null;
    if (this.props.has(ref)) {
      const p = this.props.get(ref);
      const front = p.pos.clone().add(new THREE.Vector3(0, 0, 1.1));
      return { kind: 'prop', prop: p, pos: front, top: p.pos.clone().setY(p.top || 0) };
    }
    if (this.actors.has(ref)) {
      const a = this.actors.get(ref);
      return { kind: 'actor', actor: a, pos: a.pos.clone() };
    }
    if (SLOTS[ref]) return { kind: 'slot', pos: new THREE.Vector3(...SLOTS[ref]) };
    const type = propFromText(ref) || (PROPS[ref] ? ref : null);
    if (type) {
      const p = this.addProp(ref, type);
      return this.where(ref, from);
    }
    return null;
  }

  weaponStyle(a) {
    return a.cast?.style || 'melee';
  }

  async beat(b) {
    const a = this.actors.get(b.who);
    if (!a || (a.dead && !['getup', 'rise', 'appear'].includes(b.do))) return;
    await a.ready;
    const target = b.target ? this.actors.get(b.target) : null;
    const dest = this.where(b.to, a);
    if (b.say) this.say(a, b.say);
    this.focus(a, target || (dest?.actor) || null);
    const style = this.weaponStyle(a);

    switch (b.do) {
      case 'walk': case 'run': case 'sneak': case 'fly':
        if (dest) await a.moveTo(dest.pos, { run: b.do === 'run' || b.do === 'fly', stopShort: dest.kind === 'actor' ? 1.3 : 0, y: a.flying ? 0.6 : (dest.kind === 'prop' ? 0 : null) });
        break;
      case 'jump': case 'climb': {
        if (dest?.kind === 'prop') {
          if (a.pos.distanceTo(dest.pos) > 4) await a.moveTo(dest.pos, { run: true, stopShort: 2.2, y: a.pos.y });
          const top = dest.top.clone();
          if (dest.prop.hang) top.y -= 0.2;
          await a.jumpTo(top.add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 0, 0.1)), 0.8);
        } else if (dest) {
          await a.jumpTo(dest.kind === 'actor' ? dest.pos.clone().add(new THREE.Vector3(-1.2 * Math.sign(dest.pos.x - a.pos.x || 1), 0, 0.3)).setY(0) : dest.pos.clone().setY(0), 1.4);
        } else {
          a.play('jump_short'); await this.tween(0.6, (k) => (a.pos.y = Math.sin(k * Math.PI) * 1.0), false);
        }
        break;
      }
      case 'attack': case 'jump_attack': case 'spin': {
        if (!target) { await a.play(style === 'heavy' ? 'attack2h' : 'attack'); break; }
        const elevated = a.pos.y > 0.4;
        if (elevated || b.do === 'jump_attack') {
          const land = target.pos.clone().add(target.pos.clone().sub(a.pos).setY(0).normalize().multiplyScalar(-1.1)).setY(0);
          a.face(target);
          const p = a.play('attack_jump', { speed: 1.1 });
          await a.jumpTo(land, 1.0);
          a.face(target);
          await p;
        } else if (a.pos.distanceTo(target.pos) > 1.8) {
          await a.moveTo(target.pos, { run: true, stopShort: 1.25 });
        }
        a.face(target); target.face(a);
        const kind = b.do === 'spin' ? 'spin' : style === 'heavy' ? 'attack2h' : style === 'dual' ? 'attack_dual' : 'attack';
        const anim = a.play(kind);
        await sleep(380 / this.speed);
        await this.impact(target, b);
        await anim;
        break;
      }
      case 'shoot': {
        if (target) { a.face(target); }
        const anim = a.play('shoot');
        await sleep(350 / this.speed);
        if (target) { await this.fx.projectile(a.chest(), target.chest(), 'arrow'); await this.impact(target, b); }
        await anim;
        break;
      }
      case 'cast': case 'summon': {
        if (target) a.face(target);
        const color = { fire: 0xff7a30, ice: 0x9fdcff, lightning: 0xbfe0ff, heal: 0x7fe3c9, light: 0xfff2a0, shadow: 0x9a6aff, poison: 0x8fe060 }[b.fx] || 0xb08aff;
        this.fx.burst(a.chest(), color, 25, 1.2, 0.7, 1);
        const anim = a.play(b.do === 'summon' ? 'summon' : 'cast');
        await sleep(420 / this.speed);
        if (target) {
          if (b.fx === 'heal') { this.fx.heal(target.pos); if (b.amount) this.floatText(target, '+' + b.amount, 'heal'); }
          else if (b.fx === 'lightning') { this.fx.lightning(a.chest(), target.chest()); await sleep(150); await this.impact(target, b); }
          else { await this.fx.projectile(a.chest(), target.chest(), 'magic', color); await this.impact(target, b); }
        } else if (b.fx === 'heal') this.fx.heal(a.pos);
        else this.fx.burst(a.chest().add(new THREE.Vector3(0, 0.6, 0)), color, 60, 3, 1);
        await anim;
        break;
      }
      case 'aoe': {
        const color = b.fx === 'fire' ? 0xff7a30 : 0xb08aff;
        const anim = a.play('cast');
        await sleep(400 / this.speed);
        const victims = (b.targets || []).map((id) => this.actors.get(id)).filter(Boolean);
        this.fx.ring(a.pos, color);
        for (const v of victims) this.fx.burst(v.chest(), color, 40, 2.5, 0.8);
        this.shake = 0.35;
        await sleep(200);
        await anim;
        break;
      }
      case 'throw': {
        if (target) a.face(target);
        const anim = a.play('throw');
        await sleep(350 / this.speed);
        if (target) { await this.fx.projectile(a.chest(), target.chest(), 'throw'); await this.impact(target, b); }
        await anim;
        break;
      }
      case 'kick': case 'punch': {
        if (target && a.pos.distanceTo(target.pos) > 1.6) await a.moveTo(target.pos, { run: true, stopShort: 1.1 });
        if (target) a.face(target);
        const anim = a.play(b.do);
        await sleep(330 / this.speed);
        if (target) await this.impact(target, b);
        await anim;
        break;
      }
      case 'block': await a.play('block'); break;
      case 'dodge': {
        const back = a.pos.clone().add(new THREE.Vector3(-Math.sin(a.root.rotation.y), 0, -Math.cos(a.root.rotation.y)).multiplyScalar(1));
        const anim = a.play('dodge');
        await this.tween(0.45, (k) => a.pos.lerp(back, k * 0.2));
        await anim;
        break;
      }
      case 'hit': await this.impact(a, b, true); break;
      case 'die': await a.die(); this.updateLabel(a); break;
      case 'fall': await a.play('lie', { hold: true }); break;
      case 'getup': case 'rise': a.dead = false; await a.play(b.do === 'rise' ? 'rise' : 'getup'); this.updateLabel(a); break;
      case 'cheer': await a.play('cheer'); break;
      case 'taunt': await a.play('taunt'); break;
      case 'talk': a.face(target || this.camera.position.clone().setY(0)); await a.play('talk'); break;
      case 'use': case 'pickup': case 'open':
        if (dest && dest.kind === 'prop') await a.moveTo(dest.pos, { run: false });
        await a.play(b.do === 'pickup' ? 'pickup' : 'use');
        if (dest?.prop?.type === 'chest') this.fx.burst(dest.prop.pos.clone().setY(0.8), 0xffd36a, 50, 2, 1, 1);
        break;
      case 'sit': await a.play('sit', { hold: true }); break;
      case 'appear': a.root.visible = true; this.fx.burst(a.chest(), 0x9a6aff, 50, 2, 0.8); await a.play('taunt'); break;
      case 'vanish': this.fx.burst(a.chest(), 0x9a6aff, 50, 2, 0.8); a.root.visible = false; break;
      default: await a.play('talk');
    }
    if (b.wait) await sleep(b.wait / this.speed);
  }

  // Попадание: тряска, всплывающее число, анимация удара или смерти
  async impact(target, b, self = false) {
    if (b.miss) {
      this.floatText(target, 'мимо', 'miss');
      await target.play('dodge');
      return;
    }
    if (b.crit) this.shake = 0.5; else this.shake = Math.max(this.shake, 0.18);
    if (b.amount) this.floatText(target, '−' + b.amount, b.crit ? 'crit' : 'dmg');
    this.fx.burst(target.chest(), b.fx === 'fire' ? 0xff7a30 : b.fx === 'ice' ? 0x9fdcff : 0xff4a3a, 22, 2.2, 0.5);
    if (b.kills) { await target.die(); this.updateLabel(target); return; }
    await target.play('hit');
  }

  async run(beats) {
    for (const b of beats || []) {
      try { await this.beat(b); } catch (e) { console.error('beat', b, e); }
    }
    this.wide();
  }
}
