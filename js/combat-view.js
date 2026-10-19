// Экран боя: карточки бойцов, порядок ходов, выбор действия и цели, анимация.

import { Combat, heroCombatant, enemyCombatant } from './combat.js';
import { CLASSES, RACES, fmtMod } from './rules.js';
import { flavor } from './gen.js';
import { h, sleep, d20Svg, speak, sheet, heroArt, enemyArt, placeImg } from './ui.js';

// opts: { party, enemies, sides (heroId->'A'|'B'), place, arena, onEnd(result) }
export function runCombat(root, opts) {
  const fighters = [];
  for (const hero of opts.party) {
    if (hero.hp <= 0 && !opts.arena) continue;
    fighters.push(heroCombatant(hero, opts.sides?.[hero.id] || 'A'));
  }
  for (const e of opts.enemies || []) fighters.push(enemyCombatant(e, 'B'));

  const cb = new Combat(fighters);
  const els = new Map();
  let busy = false;

  root.innerHTML = '';
  const battle = h('section', { class: 'battle' });
  const bg = h('div', { class: 'battle-bg' });
  if (opts.place) bg.append(placeImg(opts.place, 'scene-art'));
  const ini = h('div', { class: 'initiative' });
  const top = h('div', { class: 'side' });
  const bottom = h('div', { class: 'side' });
  const line = h('div', { class: 'callout-line' });
  const mini = h('div', { class: 'mini-die' });
  const mid = h('div', { class: 'stage-mid' }, line, mini);
  const actions = h('div', { class: 'actions' });
  battle.append(bg, ini, top, mid, bottom, actions);
  root.append(battle);

  // Сверху враги (или красная сторона арены), снизу герои (синяя сторона)
  const topSide = 'B';
  for (const f of fighters) {
    const el = fighterCard(f);
    els.set(f.id, el);
    (f.side === topSide ? top : bottom).append(el);
  }

  function fighterCard(f) {
    const pic = f.isHero ? heroArt(f.src, { note: false }) : enemyArt(f.src, { note: false });
    const el = h('div', { class: 'fighter ' + (f.isHero ? 'hero' : 'foe'), 'data-id': f.id },
      h('span', { class: 'acb', title: 'Класс доспеха' }, '⛨' + f.ac),
      h('span', { class: 'fx' }),
      pic,
      h('div', { class: 'nm' }, f.name),
      h('div', { class: 'hpbar' }, h('i'), h('span')),
    );
    el.addEventListener('click', () => onCardTap(f));
    return el;
  }

  function paint() {
    const cur = cb.current();
    for (const f of fighters) {
      const el = els.get(f.id);
      el.classList.toggle('down', f.down);
      el.classList.toggle('now', f === cur);
      const pct = Math.max(0, Math.round((f.hp / f.maxHp) * 100));
      el.querySelector('.hpbar i').style.width = pct + '%';
      el.querySelector('.hpbar span').textContent = `${Math.max(0, f.hp)}/${f.maxHp}`;
      const fx = [];
      if (f.fx.rage) fx.push('ярость');
      if (f.fx.hide) fx.push('в тени');
      if (f.fx.dodge) fx.push('защита');
      if (fighters.some((x) => x.fx.mark === f.id && !x.down)) fx.push('метка');
      el.querySelector('.fx').innerHTML = fx.map((t) => `<b>${t}</b>`).join('');
    }
    ini.innerHTML = '';
    ini.append(h('span', { class: 'round' }, `Раунд ${cb.round}`));
    cb.order.forEach((f, i) => {
      const dot = h('span', { class: 'ini' + (f.isHero ? '' : ' foe') + (i === cb.turn ? ' now' : '') + (f.down ? ' out' : ''), title: f.name }, f.name[0]);
      ini.append(dot);
    });
  }

  // ---------- анимации ----------

  function center(el) {
    const r = el.getBoundingClientRect();
    const b = battle.getBoundingClientRect();
    return { x: r.left - b.left + r.width / 2, y: r.top - b.top + r.height / 3 };
  }

  function floatText(targetId, text, cls) {
    const el = els.get(targetId);
    if (!el) return;
    const c = center(el);
    const f = h('div', { class: 'float ' + cls, style: { left: c.x + 'px', top: c.y + 'px' } }, text);
    battle.append(f);
    setTimeout(() => f.remove(), 1200);
  }

  function pulse(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), 600);
  }

  async function lunge(whoId, targetId) {
    const a = els.get(whoId), t = els.get(targetId);
    if (!a || !t || a === t || !a.animate) return;
    const ra = a.getBoundingClientRect(), rt = t.getBoundingClientRect();
    const dx = (rt.left - ra.left) * 0.45, dy = (rt.top - ra.top) * 0.45;
    a.style.zIndex = 4;
    await a.animate([
      { transform: 'translate(0,0)' },
      { transform: `translate(${dx}px, ${dy}px) scale(1.06)`, offset: 0.45 },
      { transform: 'translate(0,0)' },
    ], { duration: 520, easing: 'cubic-bezier(.3,.7,.4,1)' }).finished.catch(() => {});
    a.style.zIndex = '';
  }

  const nameOf = (id) => fighters.find((f) => f.id === id)?.name || '';

  async function play(events) {
    for (const e of events) {
      switch (e.kind) {
        case 'start':
          if (e.label && e.label !== 'Атака') line.textContent = `${nameOf(e.who)}: ${e.label}`;
          if (e.target && e.action !== 'dodge') lunge(e.who, e.target);
          await sleep(250);
          break;
        case 'roll': {
          const advTxt = e.adv > 0 ? ' с преимуществом' : e.adv < 0 ? ' с помехой' : '';
          mini.innerHTML = d20Svg(34) + ` <span>${e.natural} ${fmtMod(e.bonus)} = <b>${e.total}</b> против ⛨${e.vs}${advTxt}${e.lucky ? ', везение!' : ''}</span>`;
          if (e.crit) pulse(battle, 'screen-crit');
          if (!e.hit) { floatText(e.target, 'мимо', 'miss'); }
          await sleep(650);
          break;
        }
        case 'save':
          mini.innerHTML = `<span>${e.label}: ${e.total} против ${e.dc}, ${e.saved ? 'увернулся' : 'не успел'}</span>`;
          await sleep(550);
          break;
        case 'flavor': {
          const text = flavor(e.type, e.a, e.t);
          line.textContent = text;
          speak(text);
          break;
        }
        case 'damage': {
          const el = els.get(e.target);
          floatText(e.target, '−' + e.amount, e.crit ? 'crit' : 'dmg');
          if (el) { pulse(el, 'shake'); pulse(el, 'flash-red'); }
          if (navigator.vibrate) navigator.vibrate(e.crit ? [40, 40, 80] : 30);
          paint();
          await sleep(500);
          break;
        }
        case 'heal': {
          const el = els.get(e.target);
          floatText(e.target, '+' + e.amount, 'heal');
          if (el) pulse(el, 'flash-green');
          paint();
          await sleep(500);
          break;
        }
        case 'down':
          line.textContent = e.text;
          speak(e.text);
          paint();
          await sleep(600);
          break;
        case 'buff':
        case 'text':
          line.textContent = e.text;
          paint();
          await sleep(650);
          break;
        default: break;
      }
    }
  }

  // ---------- управление ----------

  let pending = null; // {action, targetKind}

  function onCardTap(f) {
    const cur = cb.current();
    if (!pending) {
      if (!busy) showInfo(f);
      return;
    }
    const ok = pending.targetKind === 'enemy' ? (f.side !== cur.side && !f.down)
      : pending.targetKind === 'ally' ? f.side === cur.side : false;
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
        f.isHero ? h('span', { class: 'badge' }, `Атака ${fmtMod(cb.attackBonus(f))}, ${f.weapon.name} ${f.weapon.dice}`) : h('span', { class: 'badge' }, `Атака ${fmtMod(f.atk)}, ${f.weaponName} ${f.dmg}`),
      ),
      f.isHero && f.slots ? h('p', { class: 'small muted' }, `Ячеек магии осталось: ${f.slots}`) : null,
      h('button', { class: 'btn ghost block', onclick: close }, 'Закрыть'),
    ));
  }

  function clearPick() {
    pending = null;
    for (const el of els.values()) el.classList.remove('pickable');
  }

  function renderActions() {
    actions.innerHTML = '';
    const cur = cb.current();
    if (!cur) return;
    if (!cur.isHero && !opts.arena) {
      actions.append(h('div', { class: 'who' }, `Ходит ${cur.name}`), h('div', { class: 'act-hint' }, 'Враг выбирает цель…'));
      return;
    }
    const sideName = opts.arena ? (cur.side === 'A' ? ' · синие' : ' · красные') : '';
    const c = CLASSES[cur.cls];
    actions.append(h('div', { class: 'who' }, cur.name, ' ', h('small', {}, `${c.name}${cur.src.playerName ? ', игрок ' + cur.src.playerName : ''}${sideName}`)));
    const grid = h('div', { class: 'act-grid' });
    const hint = h('div', { class: 'act-hint' }, 'Выбери действие');
    for (const o of cb.options(cur)) {
      const meta = o.left !== null && o.left !== undefined ? (o.slot ? `ячеек: ${o.left}` : `осталось: ${o.left}`) : '';
      const b = h('button', { class: 'act' + (o.id === 'attack' ? ' main' : ''), disabled: o.disabled || null },
        h('b', {}, o.name), meta ? h('small', {}, meta) : null);
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
    cands.forEach((f) => els.get(f.id).classList.add('pickable'));
    hint.textContent = (o.target === 'enemy' ? 'Нажми на врага: ' : 'Нажми на союзника: ') + o.text;
  }

  async function doAction(f, action, targetId) {
    busy = true;
    actions.querySelectorAll('button').forEach((b) => (b.disabled = true));
    const ev = cb.act(f, action, targetId);
    await play(ev);
    await endTurn();
  }

  async function endTurn() {
    const out = cb.outcome();
    if (out) return finish(out);
    const ev = cb.next();
    paint();
    if (ev.length) await play(ev);
    busy = false;
    mini.innerHTML = '';
    renderActions();
    const cur = cb.current();
    if (cur && !cur.isHero && !opts.arena) {
      busy = true;
      await sleep(700);
      const ch = cb.enemyChoice(cur);
      if (!ch) return finish(cb.outcome() || 'A');
      await play(cb.act(cur, ch.action, ch.target));
      await endTurn();
    }
  }

  function finish(winner) {
    busy = true;
    // Переносим состояние героев обратно в отряд
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
      title = 'Победа';
      text = `Враги повержены. Опыт: ${xp}.`;
      cls = 'win';
    } else {
      title = 'Поражение';
      text = 'Герои пали. Но история на этом не кончается…';
      cls = 'lose';
    }
    speak(`${title}. ${text}`);
    line.textContent = '';
    mini.innerHTML = '';
    actions.append(h('div', { class: 'result ' + cls }, h('h2', {}, title), h('p', {}, text)));
    const btns = h('div', { class: 'stack' });
    if (opts.arena) btns.append(h('button', { class: 'btn primary block', onclick: () => opts.onEnd({ winner, xp, rematch: true }) }, 'Реванш'));
    btns.append(h('button', { class: (opts.arena ? 'btn ghost' : 'btn primary') + ' block', onclick: () => opts.onEnd({ winner, xp }) }, opts.arena ? 'К героям' : 'Продолжить историю'));
    actions.append(btns);
  }

  // ---------- старт ----------
  paint();
  (async () => {
    busy = true;
    const ev = cb.start();
    paint();
    line.textContent = opts.arena ? 'Бойцы бросают инициативу' : 'Бой! Бросаем инициативу';
    mini.innerHTML = '';
    await sleep(500);
    line.textContent = `Первым ходит ${cb.current().name}`;
    speak(line.textContent);
    await sleep(600);
    // повтор логики начала хода без сдвига очереди
    busy = false;
    renderActions();
    const cur = cb.current();
    if (cur && !cur.isHero && !opts.arena) {
      busy = true;
      await sleep(600);
      const ch = cb.enemyChoice(cur);
      await play(cb.act(cur, ch.action, ch.target));
      await endTurn();
    }
    void ev;
  })();
}
