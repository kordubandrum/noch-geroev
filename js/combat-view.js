// Бой в 3D-театре: бойцы на сцене, порядок ходов, выбор действия и цели.
// Правила считает combat.js, здесь только показ: каждое событие превращается в сцену.

import { Combat, heroCombatant, enemyCombatant } from './combat.js';
import { CLASSES, RACES, fmtMod } from './rules.js';
import { flavor } from './gen.js';
import { h, sleep, d20Svg, speak, sheet } from './ui.js';
import { Theater, setForKind } from './theater.js';
import { settings } from './ai.js';

// Где стоят бойцы: команда A слева, B справа, в два ряда
function formation(side, i, n) {
  const cols = Math.ceil(n / 2);
  const col = Math.floor(i / 2), row = i % 2;
  const sx = side === 'A' ? -1 : 1;
  const x = sx * (2.4 + row * 1.5 + (cols > 2 ? col * 0.2 : 0));
  const z = n === 1 ? 0.4 : -2 + (i / Math.max(1, n - 1)) * 4;
  return [x, 0, z];
}

// opts: { party, enemies, sides (heroId->'A'|'B'), place, arena, stageSet, onEnd(result) }
export function runCombat(root, opts) {
  const fighters = [];
  for (const hero of opts.party) {
    if (hero.hp <= 0 && !opts.arena) continue;
    fighters.push(heroCombatant(hero, opts.sides?.[hero.id] || 'A'));
  }
  for (const e of opts.enemies || []) fighters.push(enemyCombatant(e, 'B'));

  const cb = new Combat(fighters);
  const byId = (id) => fighters.find((f) => f.id === id);
  let busy = false;
  let pending = null;

  root.innerHTML = '';
  const stageEl = h('div', { class: 'stage battle-stage' });
  const ini = h('div', { class: 'initiative hud-top' });
  const line = h('div', { class: 'callout-line' });
  const mini = h('div', { class: 'mini-die' });
  const hud = h('div', { class: 'hud-bottom' }, line, mini);
  const actions = h('div', { class: 'actions' });
  const battle = h('section', { class: 'battle3d' }, h('div', { class: 'stage-wrap' }, stageEl, ini, hud), actions);
  root.append(battle);

  const th = new Theater(stageEl, { onTapActor: (id) => onTap(id) });
  th.speed = settings.get('speed', 1);
  th.setStage(opts.stageSet || setForKind(opts.place?.kind || (opts.arena ? 'арена' : ''), `${opts.place?.name || ''}`), { seed: 5 });
  const home = new Map();

  const teamA = fighters.filter((f) => f.side === 'A'), teamB = fighters.filter((f) => f.side !== 'A');
  const ready = Promise.all(fighters.map((f) => {
    const team = f.side === 'A' ? teamA : teamB;
    const slot = formation(f.side, team.indexOf(f), team.length);
    home.set(f.id, slot);
    const spec = f.isHero
      ? { id: f.id, kind: 'hero', race: f.race, cls: f.cls, name: f.name.split(' ')[0], side: f.side }
      : { id: f.id, kind: 'monster', key: f.src.key, creature: f.src.creature, name: f.name, desc: f.desc, side: 'B' };
    return th.addActor(spec, slot).then((a) => {
      a.root.rotation.y = f.side === 'A' ? Math.PI / 2 : -Math.PI / 2;
      a.setHp(f.hp, f.maxHp);
    });
  }));

  const actor = (f) => th.actors.get(f.id);

  function paint() {
    const cur = cb.current();
    for (const f of fighters) {
      const a = actor(f);
      if (a) { a.hp = Math.max(0, f.hp); a.maxHp = f.maxHp; a.dead = f.down; th.updateLabel(a); }
      th.setLabelState(f.id, 'now', f === cur);
    }
    ini.innerHTML = '';
    ini.append(h('span', { class: 'round' }, `Раунд ${cb.round}`));
    cb.order.forEach((f, i) => {
      ini.append(h('span', { class: 'ini' + (f.isHero ? '' : ' foe') + (i === cb.turn ? ' now' : '') + (f.down ? ' out' : ''), title: f.name }, f.name[0]));
    });
  }

  function say(text) {
    line.textContent = text;
  }

  // Как боец бьёт оружием: лучник стреляет, остальные рубят
  const weaponDo = (f) => (f.isHero && f.cls === 'ranger' ? 'shoot' : 'attack');

  async function backHome(f) {
    const a = actor(f);
    if (!a || f.down) return;
    const p = home.get(f.id);
    if (Math.hypot(a.pos.x - p[0], a.pos.z - p[2]) > 0.6 || a.pos.y > 0.1) {
      await a.moveTo(new a.pos.constructor(p[0], 0, p[2]), { run: true, y: 0 });
    }
    const foes = cb.enemiesOf(f);
    if (foes.length) a.face(actor(foes[0]) || a.pos);
  }

  // События движка -> сцены в театре
  async function play(ev, ab) {
    const type = ab ? ab.type : null;
    let who = null;
    for (let i = 0; i < ev.length; i++) {
      const e = ev[i];
      switch (e.kind) {
        case 'start': {
          who = byId(e.who);
          if (e.label && e.label !== 'Атака') say(`${who.name}: ${e.label}`);
          if (type === 'aoe_save') {
            const targets = cb.all.filter((x) => x.side !== who.side && (!x.down || ev.some((y) => y.kind === 'save' && y.target === x.id))).map((x) => x.id);
            await th.beat({ who: who.id, do: 'aoe', fx: ab.element || 'fire', targets });
          }
          break;
        }
        case 'roll': {
          const att = byId(e.who), tgt = byId(e.target);
          const advTxt = e.adv > 0 ? ', с преимуществом' : e.adv < 0 ? ', с помехой' : '';
          mini.innerHTML = d20Svg(30) + ` <span>${e.natural} ${fmtMod(e.bonus)} = <b>${e.total}</b> против ⛨${e.vs}${advTxt}${e.lucky ? ', везение!' : ''}</span>`;
          // что последовало за броском: урон, падение, фраза
          let dmg = null, kills = false, j = i + 1;
          const after = [];
          for (; j < ev.length && !['roll', 'save', 'end', 'start'].includes(ev[j].kind); j++) {
            const x = ev[j];
            if (x.kind === 'damage' && x.target === e.target && !dmg) dmg = x;
            else if (x.kind === 'down' && x.target === e.target) kills = true;
            else after.push(x);
          }
          for (const x of after) if (x.kind === 'flavor') { const t = flavor(x.type, x.a, x.t); say(t); speak(t); }
          let beat;
          if (type === 'spell_attack') beat = { do: 'cast', fx: ab.element || 'fire' };
          else beat = { do: weaponDo(att) };
          await th.beat({ who: att.id, target: tgt.id, ...beat, amount: dmg?.amount, crit: e.crit, miss: !e.hit, kills });
          for (const x of after) if (x.kind === 'text') say(x.text);
          paint();
          i = j - 1;
          break;
        }
        case 'save': {
          const tgt = byId(e.target);
          mini.innerHTML = `<span>${e.label}: ${e.total} против ${e.dc}, ${e.saved ? 'увернулся' : 'не успел'}</span>`;
          let dmg = null, kills = false, j = i + 1;
          for (; j < ev.length && !['roll', 'save', 'end', 'start'].includes(ev[j].kind); j++) {
            const x = ev[j];
            if (x.kind === 'damage' && x.target === e.target) dmg = x;
            if (x.kind === 'down' && x.target === e.target) kills = true;
            if (x.kind === 'text') say(x.text);
          }
          if (type === 'save_attack') {
            await th.beat({ who: who.id, do: 'cast', fx: 'light', target: tgt.id, amount: dmg?.amount, miss: !dmg, kills });
          } else {
            const a = actor(tgt);
            if (a) await th.impact(a, { amount: dmg?.amount, miss: !dmg, kills, fx: ab?.element });
          }
          paint();
          i = j - 1;
          break;
        }
        case 'damage': {
          // урон без броска: волшебная стрела
          const tgt = byId(e.target);
          const kills = ev.slice(i + 1).some((x) => x.kind === 'down' && x.target === e.target && !ev.slice(i + 1, ev.indexOf(x)).some((y) => y.kind === 'damage'));
          await th.beat({ who: who.id, do: 'cast', fx: 'magic', target: tgt.id, amount: e.amount, kills });
          paint();
          break;
        }
        case 'heal': {
          const tgt = byId(e.target);
          if (tgt.id === who?.id && type !== 'heal_ally') { th.fx.heal(actor(tgt).pos); th.floatText(actor(tgt), '+' + e.amount, 'heal'); await actor(tgt).play('use'); }
          else await th.beat({ who: who.id, do: 'cast', fx: 'heal', target: tgt.id, amount: e.amount });
          const a = actor(tgt);
          if (a && a.dead && !tgt.down) { a.dead = false; await a.play('getup'); }
          paint();
          break;
        }
        case 'down': {
          const a = actor(byId(e.target));
          say(e.text); speak(e.text);
          if (a && !a.dead) await a.die();
          paint();
          break;
        }
        case 'buff': {
          say(e.text);
          const tgt = byId(e.target);
          const a = actor(tgt);
          if (!a) break;
          if (ab?.type === 'buff_rage') { th.fx.burst(a.chest(), 0xff4030, 40, 2, 0.8, 1); await a.play('taunt'); }
          else if (ab?.type === 'buff_hide') { await a.play('dodge'); a.model.traverse((o) => { if (o.isMesh) { o.material.transparent = true; o.material.opacity = 0.45; } }); }
          else if (ab?.type === 'mark') { th.fx.ring(a.pos, 0x9fe060); }
          else await a.play('block');
          break;
        }
        case 'text': say(e.text); await sleep(400); break;
        case 'flavor': { const t = flavor(e.type, e.a, e.t); say(t); break; }
        case 'end': {
          if (who) {
            // кто ушёл из тени после атаки, снова виден целиком
            if (!who.fx.hide) actor(who)?.model?.traverse((o) => { if (o.isMesh && o.material.transparent) o.material.opacity = 1; });
            await backHome(who);
          }
          break;
        }
        default: break;
      }
    }
    th.wide();
  }

  // ---------- управление ----------

  function onTap(id) {
    const f = byId(id);
    if (!f) return;
    if (!pending) { if (!busy) showInfo(f); return; }
    const cur = cb.current();
    const ok = pending.targetKind === 'enemy' ? (f.side !== cur.side && !f.down) : pending.targetKind === 'ally' ? f.side === cur.side : false;
    if (!ok) return;
    const action = pending.action;
    clearPick();
    doAction(cur, action, f.id);
  }

  function showInfo(f) {
    const c = f.isHero ? CLASSES[f.cls] : null;
    sheet((close) => h('div', { class: 'stack' },
      h('h2', {}, f.name),
      f.isHero ? h('p', { class: 'muted' }, `${RACES[f.race].name}, ${c.name.toLowerCase()}, ${f.level} уровень`) : h('p', { class: 'muted' }, f.desc || 'Противник'),
      h('div', { class: 'badges' },
        h('span', { class: 'badge hp' }, `Здоровье ${Math.max(0, f.hp)}/${f.maxHp}`),
        h('span', { class: 'badge ac' }, `Доспех ${f.ac}`),
        f.isHero ? h('span', { class: 'badge' }, `Атака ${fmtMod(cb.attackBonus(f))}, ${f.weapon.name} ${f.weapon.dice}`) : h('span', { class: 'badge' }, `Атака ${fmtMod(f.atk)}, ${f.weaponName} ${f.dmg}`)),
      f.isHero && f.slots ? h('p', { class: 'small muted' }, `Ячеек магии осталось: ${f.slots}`) : null,
      h('button', { class: 'btn ghost block', onclick: close }, 'Закрыть')));
  }

  function clearPick() {
    pending = null;
    for (const f of fighters) th.setLabelState(f.id, 'pickable', false);
  }

  function renderActions() {
    actions.innerHTML = '';
    const cur = cb.current();
    if (!cur) return;
    if (!cur.isHero && !opts.arena) {
      actions.append(h('div', { class: 'who' }, `Ходит ${cur.name}`), h('div', { class: 'act-hint' }, 'Враг выбирает цель…'));
      return;
    }
    const sideName = opts.arena ? (cur.side === 'A' ? ', синие' : ', красные') : '';
    const c = CLASSES[cur.cls];
    actions.append(h('div', { class: 'who' }, cur.name, ' ', h('small', {}, `${c.name}${cur.src.playerName ? ', игрок ' + cur.src.playerName : ''}${sideName}`)));
    const grid = h('div', { class: 'act-grid' });
    const hint = h('div', { class: 'act-hint' }, 'Выбери действие');
    for (const o of cb.options(cur)) {
      const meta = o.left !== null && o.left !== undefined ? (o.slot ? `ячеек: ${o.left}` : `осталось: ${o.left}`) : '';
      const b = h('button', { class: 'act' + (o.id === 'attack' ? ' main' : ''), disabled: o.disabled || null }, h('b', {}, o.name), meta ? h('small', {}, meta) : null);
      b.onclick = () => choose(cur, o, hint);
      grid.append(b);
    }
    actions.append(grid, hint);
  }

  function choose(cur, o, hint) {
    if (busy) return;
    clearPick();
    hint.textContent = o.text;
    if (o.target === 'none') return doAction(cur, o.id, null);
    const cands = fighters.filter((f) => (o.target === 'enemy' ? f.side !== cur.side && !f.down : f.side === cur.side));
    if (o.target === 'enemy' && cands.length === 1) return doAction(cur, o.id, cands[0].id);
    pending = { action: o.id, targetKind: o.target };
    cands.forEach((f) => th.setLabelState(f.id, 'pickable', true));
    hint.textContent = (o.target === 'enemy' ? 'Нажми на врага (на имя над головой): ' : 'Нажми на союзника: ') + o.text;
  }

  async function doAction(f, action, targetId) {
    busy = true;
    actions.querySelectorAll('button').forEach((b) => (b.disabled = true));
    const ab = f.isHero ? f.abilities.find((a) => a.id === action) : null;
    const ev = cb.act(f, action, targetId);
    await play(ev, ab || (action === 'dodge' ? { type: 'dodge' } : action === 'potion' ? { type: 'potion' } : null));
    await endTurn();
  }

  async function endTurn() {
    const out = cb.outcome();
    if (out) return finish(out);
    const ev = cb.next();
    paint();
    if (ev.length) await play(ev, null);
    busy = false;
    mini.innerHTML = '';
    renderActions();
    const cur = cb.current();
    if (cur && !cur.isHero && !opts.arena) {
      busy = true;
      await sleep(500 / th.speed);
      const ch = cb.enemyChoice(cur);
      if (!ch) return finish(cb.outcome() || 'A');
      await play(cb.act(cur, ch.action, ch.target), null);
      await endTurn();
    }
  }

  async function finish(winner) {
    busy = true;
    for (const f of fighters.filter((x) => x.isHero)) {
      f.src.hp = Math.max(0, f.hp);
      f.src.potions = f.potions;
      f.src.slots = f.slots;
    }
    const xp = cb.xpReward();
    actions.innerHTML = '';
    let title, text, cls;
    if (opts.arena) {
      const names = fighters.filter((f) => f.side === winner).map((f) => f.name).join(', ');
      title = winner === 'draw' ? 'Ничья' : 'Победа';
      text = winner === 'draw' ? 'Все бойцы повержены.' : `Победили: ${names}.`;
      cls = 'win';
    } else if (winner === 'A') {
      title = 'Победа'; text = `Враги повержены. Опыт: ${xp}.`; cls = 'win';
    } else {
      title = 'Поражение'; text = 'Герои пали. Но история на этом не кончается…'; cls = 'lose';
    }
    speak(`${title}. ${text}`);
    line.textContent = ''; mini.innerHTML = '';
    // победители празднуют
    for (const f of fighters.filter((x) => x.side === winner && !x.down)) actor(f)?.play('cheer');
    actions.append(h('div', { class: 'result ' + cls }, h('h2', {}, title), h('p', {}, text)));
    const btns = h('div', { class: 'stack' });
    const end = (extra) => { th.dispose(); opts.onEnd({ winner, xp, ...extra }); };
    if (opts.arena) btns.append(h('button', { class: 'btn primary block', onclick: () => end({ rematch: true }) }, 'Реванш'));
    btns.append(h('button', { class: (opts.arena ? 'btn ghost' : 'btn primary') + ' block', onclick: () => end({}) }, opts.arena ? 'К героям' : 'Продолжить историю'));
    actions.append(btns);
  }

  // ---------- старт ----------
  (async () => {
    busy = true;
    say('Бойцы выходят на сцену…');
    await ready;
    cb.start();
    paint();
    // враги рычат, герои готовятся
    for (const f of fighters) if (!f.isHero) actor(f)?.play('taunt');
    say(opts.arena ? 'Бойцы бросают инициативу' : 'Бой! Бросаем инициативу');
    await sleep(900);
    say(`Первым ходит ${cb.current().name}`);
    speak(line.textContent);
    await sleep(500);
    busy = false;
    renderActions();
    const cur = cb.current();
    if (cur && !cur.isHero && !opts.arena) {
      busy = true;
      await sleep(500);
      const ch = cb.enemyChoice(cur);
      await play(cb.act(cur, ch.action, ch.target), null);
      await endTurn();
    }
  })();

  return { dispose: () => th.dispose() };
}
