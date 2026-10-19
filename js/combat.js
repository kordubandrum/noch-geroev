// Боевой движок. Считает ходы, броски и урон, отдаёт список событий для анимации.
// Упрощения против D&D: нет клеток и расстояний, упавший герой выбывает из боя
// и после победы встаёт с 1 здоровья (без спасбросков от смерти).

import {
  CLASSES, RACES, finalStats, mod, prof, rollD20, rollDice, rnd, pick, heroAC, spellSlots,
} from './rules.js';

let uid = 0;

export function heroCombatant(h, side = 'A') {
  const s = finalStats(h.base, h.race);
  const c = CLASSES[h.cls];
  const abilities = [...c.abilities];
  if (h.race === 'dragonborn') {
    abilities.push({ id: 'breath', name: 'Дыхание дракона', type: 'aoe_save', dice: '2d6', save: 'dex', element: 'fire', uses: 1, stat: 'con',
      text: 'Пламя по всем врагам: 2к6, спасбросок Ловкости вдвое меньше. Раз в бой.' });
  }
  const uses = {};
  abilities.forEach((a) => { if (a.uses) uses[a.id] = a.uses; });
  return {
    id: 'c' + (++uid), heroId: h.id, isHero: true, side,
    name: h.name, cls: h.cls, race: h.race, level: h.level, stats: s,
    hp: h.hp, maxHp: h.maxHp, ac: heroAC(h),
    weapon: c.weapon, abilities, uses,
    slots: h.slots ?? spellSlots(h.cls, h.level),
    potions: h.potions ?? 0,
    fx: {}, down: h.hp <= 0, src: h,
  };
}

export function enemyCombatant(e, side = 'B') {
  return {
    id: 'c' + (++uid), isHero: false, side,
    name: e.name, hp: e.hp, maxHp: e.hp, ac: e.ac,
    atk: e.atk, dmg: e.dmg, weaponName: e.weapon, multi: e.multi || 1, vuln: e.vuln || '',
    xp: e.xp || 50, en: e.en, seed: e.seed || Math.floor(Math.random() * 1e6), desc: e.desc || '',
    stats: { dex: 10 + Math.floor((e.ac - 10) / 1.5), str: 12, con: 12, int: 8, wis: 10, cha: 8 },
    fx: {}, down: false, src: e,
  };
}

export class Combat {
  constructor(fighters) {
    this.all = fighters;
    this.round = 1;
    this.turn = 0;
    this.order = [];
    this.log = [];
  }

  start() {
    const ev = [];
    for (const f of this.all) {
      f.init = rnd(20) + mod(f.stats.dex);
      ev.push({ kind: 'text', text: `${f.name}: инициатива ${f.init}` });
    }
    this.order = [...this.all].sort((a, b) => b.init - a.init);
    this.turn = 0;
    this.skipDown();
    return ev;
  }

  current() { return this.order[this.turn]; }
  alive(side) { return this.all.filter((f) => f.side === side && !f.down); }
  enemiesOf(f) { return this.all.filter((x) => x.side !== f.side && !x.down); }
  alliesOf(f) { return this.all.filter((x) => x.side === f.side && x !== f); }

  outcome() {
    const sides = [...new Set(this.all.map((f) => f.side))];
    const standing = sides.filter((s) => this.alive(s).length > 0);
    return standing.length === 1 ? standing[0] : (standing.length === 0 ? 'draw' : null);
  }

  skipDown() {
    let guard = 0;
    while (this.current()?.down && guard++ < this.order.length) this.advance();
  }

  advance() {
    this.turn++;
    if (this.turn >= this.order.length) { this.turn = 0; this.round++; }
  }

  // Переход хода. Возвращает события начала хода (окончание ярости и т. п.)
  next() {
    this.advance();
    this.skipDown();
    const f = this.current();
    const ev = [];
    if (!f) return ev;
    f.fx.dodge = false;
    if (f.fx.rage) {
      f.fx.rage--;
      if (!f.fx.rage) ev.push({ kind: 'text', text: `${f.name} остывает, ярость прошла.` });
    }
    f.fx.sneakUsed = false;
    return ev;
  }

  // ---------- броски ----------

  advFor(attacker, target) {
    let a = 0;
    if (attacker.fx.hide) a++;
    if (target.fx.hide) a--;
    if (target.fx.dodge) a--;
    return Math.sign(a);
  }

  d20(f, adv) {
    let r = rollD20(adv);
    if (f.race === 'halfling' && r.natural === 1) {
      const re = rnd(20);
      r = { natural: re, rolls: [...r.rolls, re], lucky: true };
    }
    return r;
  }

  attackBonus(f) {
    if (!f.isHero) return f.atk;
    return prof(f.level) + mod(f.stats[f.weapon.stat]);
  }

  spellBonus(f) {
    return prof(f.level) + mod(f.stats[CLASSES[f.cls].caster]);
  }

  saveDC(f, stat) {
    return 8 + prof(f.level) + mod(f.stats[stat || CLASSES[f.cls].caster]);
  }

  saveBonus(t, stat) {
    if (!t.isHero) return Math.floor((t.atk || 2) / 2);
    const c = CLASSES[t.cls];
    return mod(t.stats[stat]) + (c.save.includes(stat) ? prof(t.level) : 0);
  }

  // ---------- урон и лечение ----------

  hurt(t, amount, ev, opt = {}) {
    let dmg = amount;
    if (t.isHero && t.race === 'dwarf') dmg = Math.max(1, dmg - 1);
    if (t.fx.rage) dmg = Math.ceil(dmg / 2);
    if (opt.element === 'fire' && t.race === 'tiefling') dmg = Math.ceil(dmg / 2);
    if (opt.element === 'radiant' && t.vuln === 'radiant') dmg *= 2;
    t.hp -= dmg;
    ev.push({ kind: 'damage', target: t.id, amount: dmg, crit: !!opt.crit, element: opt.element || '' });
    if (t.hp <= 0) {
      if (t.isHero && t.race === 'halforc' && !t.fx.relentlessUsed) {
        t.fx.relentlessUsed = true;
        t.hp = 1;
        ev.push({ kind: 'text', text: `${t.name} падает… и встаёт! Неукротимость полуорка.` });
        return;
      }
      t.hp = 0;
      t.down = true;
      t.fx.hide = false;
      ev.push({ kind: 'down', target: t.id, text: t.isHero ? `${t.name} без сознания.` : `${t.name} повержен.` });
    }
  }

  heal(t, amount, ev) {
    const wasDown = t.down;
    t.hp = Math.min(t.maxHp, t.hp + amount);
    t.down = t.hp <= 0;
    ev.push({ kind: 'heal', target: t.id, amount });
    if (wasDown && !t.down) ev.push({ kind: 'text', text: `${t.name} приходит в себя!` });
  }

  // ---------- атаки ----------

  weaponAttack(f, t, ev) {
    const adv = this.advFor(f, t);
    const r = this.d20(f, adv);
    const bonus = this.attackBonus(f);
    const total = r.natural + bonus;
    const crit = r.natural === 20;
    const hit = crit || (r.natural !== 1 && total >= t.ac);
    ev.push({ kind: 'roll', who: f.id, target: t.id, rolls: r.rolls, natural: r.natural, bonus, total, vs: t.ac, hit, crit, adv, lucky: r.lucky, label: 'Атака' });
    if (f.fx.hide) f.fx.hide = false;
    if (!hit) {
      ev.push({ kind: 'flavor', type: r.natural === 1 ? 'fumble' : 'miss', a: f.name, t: t.name });
      return;
    }
    let dice, extra = 0;
    if (f.isHero) {
      dice = f.weapon.dice;
      extra = mod(f.stats[f.weapon.stat]);
      if (f.fx.rage) extra += 2;
    } else {
      dice = f.dmg;
    }
    let dmg = rollDice(dice, crit).total + extra;
    if (f.isHero && f.cls === 'rogue' && !f.fx.sneakUsed &&
        (adv > 0 || this.alliesOf(f).some((a) => !a.down))) {
      const n = Math.ceil(f.level / 2);
      const sneak = rollDice(`${n}d6`, crit).total;
      dmg += sneak;
      f.fx.sneakUsed = true;
      ev.push({ kind: 'text', text: `Скрытая атака: +${sneak}` });
    }
    if (f.fx.mark && f.fx.mark === t.id) {
      const m = rollDice('1d6', crit).total;
      dmg += m;
      ev.push({ kind: 'text', text: `Метка охотника: +${m}` });
    }
    ev.push({ kind: 'flavor', type: crit ? 'crit' : 'hit', a: f.name, t: t.name });
    this.hurt(t, Math.max(1, dmg), ev, { crit });
  }

  spellAttack(f, t, ab, ev) {
    const adv = this.advFor(f, t);
    const r = this.d20(f, adv);
    const bonus = this.spellBonus(f);
    const total = r.natural + bonus;
    const crit = r.natural === 20;
    const hit = crit || (r.natural !== 1 && total >= t.ac);
    ev.push({ kind: 'roll', who: f.id, target: t.id, rolls: r.rolls, natural: r.natural, bonus, total, vs: t.ac, hit, crit, adv, lucky: r.lucky, label: ab.name });
    if (f.fx.hide) f.fx.hide = false;
    if (!hit) { ev.push({ kind: 'text', text: `${ab.name} пролетает мимо.` }); return; }
    const dmg = rollDice(scaleCantrip(ab.dice, f.level), crit).total;
    this.hurt(t, dmg, ev, { crit, element: ab.element });
  }

  saveEffect(f, targets, ab, ev) {
    const dc = this.saveDC(f, ab.stat);
    for (const t of targets) {
      const r = rnd(20);
      const total = r + this.saveBonus(t, ab.save);
      const saved = total >= dc;
      ev.push({ kind: 'save', who: f.id, target: t.id, natural: r, total, dc, saved, label: `Спасбросок: ${t.name}` });
      let dmg = rollDice(ab.type === 'save_attack' ? scaleCantrip(ab.dice, f.level) : ab.dice).total;
      if (saved) {
        if (ab.type === 'save_attack') { ev.push({ kind: 'text', text: `${t.name} уворачивается.` }); continue; }
        dmg = Math.floor(dmg / 2);
      }
      const element = ab.element || (ab.id === 'sacred_flame' ? 'radiant' : '');
      if (dmg > 0) this.hurt(t, dmg, ev, { element });
    }
  }

  // ---------- действия ----------

  // Какие действия доступны текущему бойцу. Для интерфейса.
  options(f) {
    const out = [{ id: 'attack', name: f.isHero ? f.weapon.name : 'Атака', target: 'enemy', text: 'Обычная атака оружием.' }];
    if (!f.isHero) return out;
    for (const a of f.abilities) {
      let left = null;
      if (a.slot) left = f.slots;
      else if (a.uses) left = f.uses[a.id] || 0;
      const target = { heal_ally: 'ally', heal_self: 'none', buff_hide: 'none', aoe_save: 'none' }[a.type] || 'enemy';
      out.push({ id: a.id, name: a.name, text: a.text, left, slot: !!a.slot, target, disabled: left !== null && left <= 0 });
    }
    out.push({ id: 'dodge', name: 'Защита', target: 'none', text: 'До следующего хода все атаки по нему с помехой.' });
    if (f.potions > 0) out.push({ id: 'potion', name: 'Зелье', target: 'none', left: f.potions, text: 'Выпить зелье лечения: 2к4+2.' });
    return out;
  }

  act(f, actionId, targetId) {
    const ev = [];
    const t = this.all.find((x) => x.id === targetId);
    const ab = f.isHero ? f.abilities.find((a) => a.id === actionId) : null;
    if (ab) {
      if (ab.slot) f.slots--;
      else if (ab.uses) f.uses[ab.id]--;
    }
    ev.push({ kind: 'start', who: f.id, target: targetId || null, action: actionId, label: ab ? ab.name : actionId === 'attack' ? 'Атака' : '' });

    const enemyTarget = () => (t && !t.down && t.side !== f.side ? t : pick(this.enemiesOf(f)));

    switch (ab ? ab.type : actionId) {
      case 'attack': {
        const times = f.isHero ? 1 : f.multi || 1;
        for (let i = 0; i < times; i++) {
          const tt = enemyTarget(); if (!tt) break;
          this.weaponAttack(f, tt, ev);
        }
        break;
      }
      case 'double_attack': {
        for (let i = 0; i < 2; i++) { const tt = enemyTarget(); if (!tt) break; this.weaponAttack(f, tt, ev); }
        break;
      }
      case 'buff_rage': {
        f.fx.rage = 3;
        ev.push({ kind: 'buff', target: f.id, text: `${f.name} впадает в ярость!` });
        const tt = enemyTarget(); if (tt) this.weaponAttack(f, tt, ev);
        break;
      }
      case 'buff_hide': {
        f.fx.hide = true;
        ev.push({ kind: 'buff', target: f.id, text: `${f.name} растворяется в тенях.` });
        break;
      }
      case 'mark': {
        const tt = enemyTarget(); if (!tt) break;
        f.fx.mark = tt.id;
        ev.push({ kind: 'buff', target: tt.id, text: `${f.name} метит цель: ${tt.name}.` });
        this.weaponAttack(f, tt, ev);
        break;
      }
      case 'heal_self': {
        const amount = rollDice(ab.dice).total + (ab.addLevel ? f.level : 0);
        this.heal(f, amount, ev);
        break;
      }
      case 'heal_ally': {
        const tt = t && t.side === f.side ? t : f;
        const amount = rollDice(ab.dice).total + (ab.addCaster ? Math.max(0, mod(f.stats[CLASSES[f.cls].caster])) : 0);
        this.heal(tt, Math.max(1, amount), ev);
        break;
      }
      case 'spell_attack': {
        const tt = enemyTarget(); if (tt) this.spellAttack(f, tt, ab, ev);
        break;
      }
      case 'auto_hit': {
        for (let i = 0; i < (ab.times || 1); i++) {
          const tt = enemyTarget(); if (!tt) break;
          this.hurt(tt, rollDice(ab.dice).total, ev, { element: 'force' });
        }
        break;
      }
      case 'aoe_save': {
        this.saveEffect(f, this.enemiesOf(f), ab, ev);
        break;
      }
      case 'save_attack': {
        const tt = enemyTarget(); if (tt) this.saveEffect(f, [tt], ab, ev);
        break;
      }
      case 'dodge': {
        f.fx.dodge = true;
        ev.push({ kind: 'buff', target: f.id, text: `${f.name} уходит в глухую защиту.` });
        break;
      }
      case 'potion': {
        f.potions--;
        this.heal(f, rollDice('2d4+2').total, ev);
        break;
      }
      default: break;
    }
    ev.push({ kind: 'end', who: f.id });
    return ev;
  }

  // Ход врага: бьёт того, кто ближе к смерти, с долей случайности
  enemyChoice(f) {
    const foes = this.enemiesOf(f);
    if (!foes.length) return null;
    const weakest = [...foes].sort((a, b) => a.hp - b.hp)[0];
    const t = Math.random() < 0.5 ? weakest : pick(foes);
    return { action: 'attack', target: t.id };
  }

  xpReward() {
    return this.all.filter((f) => !f.isHero && f.down).reduce((a, f) => a + (f.xp || 0), 0);
  }
}

// Заговоры усиливаются с уровнем: на 5 уровне два кубика
function scaleCantrip(dice, level) {
  if (level < 5) return dice;
  return dice.replace(/^1d/, '2d');
}

export { RACES };
