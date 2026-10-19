// Правила игры: упрощённая система по мотивам D&D 5e (SRD 5.1, лицензия CC-BY-4.0).
// Здесь только данные и чистая математика, без интерфейса.

export const STATS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

export const STAT_NAMES = {
  str: 'Сила', dex: 'Ловкость', con: 'Телосложение',
  int: 'Интеллект', wis: 'Мудрость', cha: 'Харизма',
};

export const STAT_SHORT = {
  str: 'СИЛ', dex: 'ЛОВ', con: 'ТЕЛ', int: 'ИНТ', wis: 'МДР', cha: 'ХАР',
};

export const STAT_HINT = {
  str: 'выбить дверь, поднять камень, ударить мечом',
  dex: 'увернуться, прокрасться, выстрелить из лука',
  con: 'выдержать яд, холод, долгий бег',
  int: 'вспомнить знание, разгадать загадку, колдовать магу',
  wis: 'заметить засаду, понять ложь, колдовать жрецу',
  cha: 'убедить, обмануть, запугать',
};

// Сложность проверки (DC): сколько нужно выбросить на d20 вместе с бонусом
export const DC_LEVELS = [
  { dc: 5, name: 'Очень легко' },
  { dc: 10, name: 'Легко' },
  { dc: 15, name: 'Средне' },
  { dc: 20, name: 'Трудно' },
  { dc: 25, name: 'Почти невозможно' },
];

export const XP_LEVELS = [0, 300, 900, 2700, 6500]; // опыт для 1–5 уровня

// ---------- кубики ----------

export const rnd = (n) => 1 + Math.floor(Math.random() * n);
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const mod = (score) => Math.floor((score - 10) / 2);
export const fmtMod = (m) => (m >= 0 ? '+' + m : '−' + Math.abs(m));
export const prof = (level) => (level >= 5 ? 3 : 2);

// "2d6+3" -> {count:2, sides:6, bonus:3}
export function parseDice(str) {
  const m = String(str || '').replace(/\s/g, '').match(/^(\d*)[dкД](\d+)([+-]\d+)?$/i);
  if (!m) return { count: 1, sides: 6, bonus: 0 };
  return {
    count: Math.min(10, parseInt(m[1] || '1', 10)),
    sides: Math.min(20, parseInt(m[2], 10)),
    bonus: parseInt(m[3] || '0', 10),
  };
}

export function rollDice(str, crit = false) {
  const d = parseDice(str);
  const count = crit ? d.count * 2 : d.count; // крит удваивает кубики, не бонус
  const rolls = [];
  for (let i = 0; i < count; i++) rolls.push(rnd(d.sides));
  const total = Math.max(0, rolls.reduce((a, b) => a + b, 0) + d.bonus);
  return { total, rolls, bonus: d.bonus };
}

// Бросок d20 с преимуществом/помехой. adv: 1 преимущество, -1 помеха, 0 обычный
export function rollD20(adv = 0) {
  const a = rnd(20);
  if (!adv) return { natural: a, rolls: [a] };
  const b = rnd(20);
  const natural = adv > 0 ? Math.max(a, b) : Math.min(a, b);
  return { natural, rolls: [a, b] };
}

// 4d6, отбросить меньший: классический способ создания характеристик
export function roll4d6() {
  const r = [rnd(6), rnd(6), rnd(6), rnd(6)].sort((a, b) => b - a);
  return { score: r[0] + r[1] + r[2], rolls: r };
}

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

// ---------- расы ----------

export const RACES = {
  human: {
    name: 'Человек', bonus: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 },
    trait: 'Разносторонний: +1 ко всем характеристикам.',
    en: 'human',
  },
  elf: {
    name: 'Эльф', bonus: { dex: 2, int: 1 },
    trait: 'Острые чувства: преимущество на проверки Мудрости, чтобы заметить что-то.',
    en: 'elf with pointed ears',
  },
  dwarf: {
    name: 'Дварф', bonus: { con: 2, str: 2 },
    trait: 'Дварфская стойкость: получает на 1 урон меньше от каждого удара.',
    en: 'stout bearded dwarf',
  },
  halfling: {
    name: 'Полурослик', bonus: { dex: 2, cha: 1 },
    trait: 'Везучий: если на d20 выпала 1, кубик перебрасывается.',
    en: 'small cheerful halfling',
  },
  dragonborn: {
    name: 'Драконорождённый', bonus: { str: 2, cha: 1 },
    trait: 'Дыхание дракона: раз в бой выдыхает пламя по всем врагам, 2к6 урона.',
    en: 'dragonborn with scaled draconic head',
  },
  gnome: {
    name: 'Гном', bonus: { int: 2, con: 1 },
    trait: 'Гномья хитрость: преимущество на спасброски Интеллекта и Мудрости.',
    en: 'tiny clever gnome',
  },
  halforc: {
    name: 'Полуорк', bonus: { str: 2, con: 1 },
    trait: 'Неукротимость: раз в бой при падении до 0 здоровья остаётся с 1.',
    en: 'muscular half-orc with tusks',
  },
  tiefling: {
    name: 'Тифлинг', bonus: { cha: 2, int: 1 },
    trait: 'Адское наследие: получает вдвое меньше урона от огня.',
    en: 'tiefling with horns and tail',
  },
};

// ---------- классы ----------
// Каждое умение: id, название, описание, тип, лимит за бой (uses) или ячейки магии (slot)

export const CLASSES = {
  fighter: {
    name: 'Воин', hitDie: 10, primary: 'str', save: ['str', 'con'],
    order: ['str', 'con', 'dex', 'wis', 'cha', 'int'],
    weapon: { name: 'Длинный меч', dice: '1d8', stat: 'str' },
    ac: (s) => 16,
    armor: 'Кольчуга',
    desc: 'Мастер оружия и доспехов. Держит удар и бьёт без промаха.',
    en: 'fighter in chainmail with longsword and shield',
    abilities: [
      { id: 'second_wind', name: 'Второе дыхание', type: 'heal_self', dice: '1d10', addLevel: true, uses: 1,
        text: 'Лечит себя на 1к10 + уровень. Раз в бой.' },
      { id: 'action_surge', name: 'Всплеск действий', type: 'double_attack', uses: 1,
        text: 'Две атаки подряд. Раз в бой.' },
    ],
  },
  barbarian: {
    name: 'Варвар', hitDie: 12, primary: 'str', save: ['str', 'con'],
    order: ['str', 'con', 'dex', 'wis', 'cha', 'int'],
    weapon: { name: 'Секира', dice: '1d12', stat: 'str' },
    ac: (s) => 10 + mod(s.dex) + mod(s.con),
    armor: 'Без доспехов',
    desc: 'Яростный боец. В ярости бьёт сильнее и почти не чувствует боли.',
    en: 'barbarian warrior with greataxe, fur and warpaint',
    abilities: [
      { id: 'rage', name: 'Ярость', type: 'buff_rage', uses: 2,
        text: '3 хода: +2 к урону, получаемый урон вдвое меньше. Дважды за бой.' },
    ],
  },
  rogue: {
    name: 'Плут', hitDie: 8, primary: 'dex', save: ['dex', 'int'],
    order: ['dex', 'con', 'int', 'cha', 'wis', 'str'],
    weapon: { name: 'Короткий меч', dice: '1d6', stat: 'dex' },
    ac: (s) => 11 + mod(s.dex),
    armor: 'Кожаный доспех',
    desc: 'Ловкач и тень. Бьёт исподтишка, когда враг отвлечён.',
    en: 'hooded rogue with daggers in leather armor',
    passive: 'Скрытая атака: если рядом есть союзник, первый удар за ход наносит дополнительно 1к6 за каждые 2 уровня.',
    abilities: [
      { id: 'hide', name: 'Уйти в тень', type: 'buff_hide', uses: 3,
        text: 'Прячется: следующая атака с преимуществом, по нему атакуют с помехой.' },
    ],
  },
  wizard: {
    name: 'Маг', hitDie: 6, primary: 'int', save: ['int', 'wis'],
    order: ['int', 'con', 'dex', 'wis', 'cha', 'str'],
    weapon: { name: 'Кинжал', dice: '1d4', stat: 'dex' },
    ac: (s) => 13 + mod(s.dex),
    armor: 'Магический доспех',
    desc: 'Учёный чародей. Слабое тело, но заклинания разят сразу многих.',
    en: 'wizard in robes with glowing staff',
    caster: 'int',
    abilities: [
      { id: 'fire_bolt', name: 'Огненный снаряд', type: 'spell_attack', dice: '1d10', element: 'fire',
        text: 'Атака заклинанием, 1к10 огнём. Без ограничений.' },
      { id: 'magic_missile', name: 'Волшебная стрела', type: 'auto_hit', dice: '1d4+1', times: 3, slot: true,
        text: 'Три стрелы, каждая 1к4+1. Не промахивается. Тратит ячейку.' },
      { id: 'burning_hands', name: 'Огненные ладони', type: 'aoe_save', dice: '3d6', save: 'dex', element: 'fire', slot: true,
        text: 'Огонь по всем врагам: 3к6, спасбросок Ловкости вдвое меньше. Тратит ячейку.' },
    ],
  },
  cleric: {
    name: 'Жрец', hitDie: 8, primary: 'wis', save: ['wis', 'cha'],
    order: ['wis', 'con', 'str', 'cha', 'dex', 'int'],
    weapon: { name: 'Булава', dice: '1d6', stat: 'str' },
    ac: (s) => 16 + Math.min(0, mod(s.dex)) + 2,
    armor: 'Чешуйчатый доспех и щит',
    desc: 'Служитель света. Лечит друзей и жжёт нечисть священным огнём.',
    en: 'cleric in scale armor with holy symbol and mace',
    caster: 'wis',
    abilities: [
      { id: 'sacred_flame', name: 'Священное пламя', type: 'save_attack', dice: '1d8', save: 'dex',
        text: 'Столп света: 1к8, враг может увернуться спасброском Ловкости. Без ограничений.' },
      { id: 'healing_word', name: 'Лечащее слово', type: 'heal_ally', dice: '1d4', addCaster: true, slot: true,
        text: 'Лечит союзника на 1к4 + Мудрость, поднимает упавшего. Тратит ячейку.' },
      { id: 'cure_wounds', name: 'Лечение ран', type: 'heal_ally', dice: '1d8', addCaster: true, slot: true,
        text: 'Лечит союзника на 1к8 + Мудрость. Тратит ячейку.' },
    ],
  },
  ranger: {
    name: 'Следопыт', hitDie: 10, primary: 'dex', save: ['str', 'dex'],
    order: ['dex', 'wis', 'con', 'str', 'int', 'cha'],
    weapon: { name: 'Длинный лук', dice: '1d8', stat: 'dex' },
    ac: (s) => 13 + Math.min(2, mod(s.dex)),
    armor: 'Чешуйчатый доспех',
    desc: 'Охотник и разведчик. Стреляет без промаха и метит добычу.',
    en: 'ranger archer with longbow and green cloak',
    caster: 'wis',
    abilities: [
      { id: 'hunters_mark', name: 'Метка охотника', type: 'mark', dice: '1d6', slot: true,
        text: 'Метит врага: каждое попадание по нему +1к6 урона до конца боя. Тратит ячейку.' },
      { id: 'volley', name: 'Двойной выстрел', type: 'double_attack', uses: 1,
        text: 'Два выстрела подряд. Раз в бой.' },
    ],
  },
};

// Ячейки магии по уровню (для магов, жрецов, следопытов)
export function spellSlots(cls, level) {
  if (!CLASSES[cls].caster) return 0;
  if (cls === 'ranger') return level >= 2 ? 2 + Math.floor((level - 1) / 2) : 1;
  return [0, 2, 3, 4, 4, 5][level] || 5;
}

// ---------- создание героя ----------

export function finalStats(base, race) {
  const out = {};
  for (const s of STATS) out[s] = Math.min(20, (base[s] || 10) + ((RACES[race].bonus || {})[s] || 0));
  return out;
}

// Раскладывает набор чисел по характеристикам в порядке важности для класса
export function assignByClass(values, cls) {
  const sorted = [...values].sort((a, b) => b - a);
  const base = {};
  CLASSES[cls].order.forEach((s, i) => (base[s] = sorted[i]));
  return base;
}

export function maxHp(hero) {
  const c = CLASSES[hero.cls];
  const s = finalStats(hero.base, hero.race);
  const conMod = mod(s.con);
  let hp = c.hitDie + conMod;
  for (let l = 2; l <= hero.level; l++) hp += Math.floor(c.hitDie / 2) + 1 + conMod;
  if (hero.race === 'dwarf') hp += hero.level; // как у холмовых дварфов
  return Math.max(1, hp);
}

export function heroAC(hero) {
  return CLASSES[hero.cls].ac(finalStats(hero.base, hero.race));
}

export function levelFromXp(xp) {
  let lvl = 1;
  XP_LEVELS.forEach((need, i) => { if (xp >= need) lvl = i + 1; });
  return Math.min(5, lvl);
}

// ---------- монстры (SRD 5.1) ----------
// cr: показатель опасности, xp: опыт за победу

export const MONSTERS = [
  { key: 'goblin', name: 'Гоблин', hp: 7, ac: 15, atk: 4, dmg: '1d6+2', weapon: 'ржавый ятаган', cr: 0.25, xp: 50,
    en: 'snarling green goblin with rusty scimitar', where: ['лес', 'пещера', 'руины', 'дорога'] },
  { key: 'wolf', name: 'Волк', hp: 11, ac: 13, atk: 4, dmg: '2d4+2', weapon: 'клыки', cr: 0.25, xp: 50,
    en: 'grey wolf baring fangs', where: ['лес', 'горы', 'дорога'] },
  { key: 'skeleton', name: 'Скелет', hp: 13, ac: 13, atk: 4, dmg: '1d6+2', weapon: 'старый меч', cr: 0.25, xp: 50, vuln: 'radiant',
    en: 'undead skeleton warrior with old sword', where: ['склеп', 'руины', 'пещера'] },
  { key: 'zombie', name: 'Зомби', hp: 22, ac: 8, atk: 3, dmg: '1d6+1', weapon: 'гнилые руки', cr: 0.25, xp: 50, vuln: 'radiant',
    en: 'rotting zombie shambling', where: ['склеп', 'болото', 'деревня'] },
  { key: 'bandit', name: 'Разбойник', hp: 11, ac: 12, atk: 3, dmg: '1d6+1', weapon: 'дубина', cr: 0.125, xp: 25,
    en: 'masked bandit with club', where: ['дорога', 'лес', 'город'] },
  { key: 'cultist', name: 'Культист', hp: 9, ac: 12, atk: 3, dmg: '1d6+1', weapon: 'ритуальный нож', cr: 0.125, xp: 25,
    en: 'hooded cultist with ritual dagger', where: ['склеп', 'город', 'руины'] },
  { key: 'kobold', name: 'Кобольд', hp: 5, ac: 12, atk: 4, dmg: '1d4+2', weapon: 'копьё', cr: 0.125, xp: 25,
    en: 'small reptilian kobold with spear', where: ['пещера', 'горы'] },
  { key: 'orc', name: 'Орк', hp: 15, ac: 13, atk: 5, dmg: '1d12+3', weapon: 'секира', cr: 0.5, xp: 100,
    en: 'brutal orc with greataxe', where: ['горы', 'лес', 'дорога'] },
  { key: 'gnoll', name: 'Гнолл', hp: 22, ac: 15, atk: 4, dmg: '1d8+2', weapon: 'копьё', cr: 0.5, xp: 100,
    en: 'hyena-headed gnoll with spear', where: ['степь', 'дорога', 'руины'] },
  { key: 'spider', name: 'Гигантский паук', hp: 26, ac: 14, atk: 5, dmg: '1d8+3', weapon: 'ядовитые жвала', cr: 1, xp: 200,
    en: 'giant black spider', where: ['пещера', 'лес', 'руины'] },
  { key: 'bugbear', name: 'Багбир', hp: 27, ac: 16, atk: 4, dmg: '2d8+2', weapon: 'моргенштерн', cr: 1, xp: 200,
    en: 'hulking hairy bugbear with morningstar', where: ['пещера', 'лес'] },
  { key: 'ghoul', name: 'Гуль', hp: 22, ac: 12, atk: 4, dmg: '2d6+2', weapon: 'когти', cr: 1, xp: 200, vuln: 'radiant',
    en: 'pale ghoul with claws', where: ['склеп', 'болото'] },
  { key: 'wight', name: 'Умертвие', hp: 45, ac: 14, atk: 4, dmg: '1d8+2', weapon: 'чёрный меч', cr: 3, xp: 700, multi: 2, vuln: 'radiant',
    en: 'undead wight knight in black armor', where: ['склеп', 'руины'] },
  { key: 'ogre', name: 'Огр', hp: 59, ac: 11, atk: 6, dmg: '2d8+4', weapon: 'огромная дубина', cr: 2, xp: 450,
    en: 'huge ogre with tree-trunk club', where: ['горы', 'лес', 'болото'] },
  { key: 'minotaur', name: 'Минотавр', hp: 76, ac: 14, atk: 6, dmg: '2d12+4', weapon: 'двуручный топор', cr: 3, xp: 700,
    en: 'minotaur with double axe', where: ['руины', 'пещера'] },
];

// Подбор врагов под силу отряда: бюджет опыта по уровню и числу героев
export function buildEncounter(party, place = '', hard = false) {
  const lvl = Math.round(party.reduce((a, h) => a + h.level, 0) / Math.max(1, party.length));
  const perHero = [0, 50, 100, 150, 250, 500][lvl] * (hard ? 1.6 : 1);
  let budget = perHero * Math.max(1, party.length);
  let pool = MONSTERS.filter((m) => !place || m.where.some((w) => place.includes(w)));
  if (pool.length < 3) pool = MONSTERS;
  pool = pool.filter((m) => m.xp <= budget);
  if (!pool.length) pool = [MONSTERS[0]];
  const out = [];
  let guard = 0;
  while (budget > 0 && out.length < 5 && guard++ < 30) {
    const fits = pool.filter((m) => m.xp <= budget);
    if (!fits.length) break;
    const m = out.length ? (Math.random() < 0.6 ? out[0].src : pick(fits)) : pick(fits);
    if (m.xp > budget) continue;
    budget -= m.xp * (out.length >= 2 ? 1.5 : 1); // много врагов опаснее
    out.push({ src: m });
  }
  if (!out.length) out.push({ src: pool[0] });
  // Одинаковых врагов нумеруем, чтобы было понятно, в кого бить
  const total = {}, seen = {};
  out.forEach((o) => (total[o.src.key] = (total[o.src.key] || 0) + 1));
  return out.map((o) => {
    const k = o.src.key;
    seen[k] = (seen[k] || 0) + 1;
    return { ...o.src, name: total[k] > 1 ? `${o.src.name} ${seen[k]}` : o.src.name };
  });
}

// Приводит врага (из таблицы или придуманного ИИ) к безопасным числам
export function sanitizeEnemy(e, partyLevel = 1) {
  const cap = 8 + partyLevel * 14;
  const d = parseDice(e.dmg || e.damage || '1d6+1');
  return {
    name: String(e.name || 'Тварь').slice(0, 40),
    hp: Math.max(3, Math.min(cap, parseInt(e.hp, 10) || 10)),
    ac: Math.max(8, Math.min(18, parseInt(e.ac, 10) || 12)),
    atk: Math.max(0, Math.min(3 + partyLevel * 2, parseInt(e.atk ?? e.attack_bonus, 10) || 3)),
    dmg: `${Math.min(3, d.count)}d${d.sides}${d.bonus ? (d.bonus > 0 ? '+' : '') + Math.min(5, d.bonus) : ''}`,
    weapon: String(e.weapon || 'когти').slice(0, 40),
    xp: parseInt(e.xp, 10) || 50 * partyLevel,
    multi: Math.min(2, parseInt(e.multi, 10) || 1),
    vuln: e.vuln || '',
    en: String(e.en || e.prompt_en || 'fantasy monster').slice(0, 200),
    desc: String(e.desc || '').slice(0, 300),
  };
}
