// Кастинг: кем на сцене играется герой, монстр или встречный персонаж.
// Герои и люди: KayKit Adventurers и Skeletons (CC0, Kay Lousberg).
// Монстры и животные: Quaternius (Public Domain, poly.pizza).

const KK = (n) => `models/${n}.glb`;
const QM = (n) => `models/m/${n}.glb`;

const WEAPONS = {
  knight: ['1H_Sword_Offhand', 'Badge_Shield', 'Rectangle_Shield', 'Round_Shield', 'Spike_Shield', '1H_Sword', '2H_Sword'],
  barbarian: ['1H_Axe_Offhand', 'Barbarian_Round_Shield', '1H_Axe', '2H_Axe', 'Mug'],
  mage: ['Spellbook', 'Spellbook_open', '1H_Wand', '2H_Staff'],
  rogue: ['Knife_Offhand', '1H_Crossbow', '2H_Crossbow', 'Knife', 'Throwable'],
};

// Класс героя: модель, оружие в руках, манера боя
const CLASS_LOOK = {
  fighter: { model: 'knight', show: ['1H_Sword', 'Round_Shield'], style: 'melee' },
  barbarian: { model: 'barbarian', show: ['2H_Axe'], style: 'heavy' },
  rogue: { model: 'rogue_hooded', w: 'rogue', show: ['Knife', 'Knife_Offhand'], style: 'dual' },
  wizard: { model: 'mage', show: ['2H_Staff'], style: 'caster' },
  cleric: { model: 'knight', show: ['1H_Sword', 'Badge_Shield'], style: 'melee', tint: 0xfff0c8 },
  ranger: { model: 'rogue', show: ['2H_Crossbow'], style: 'ranged' },
};

// Раса: рост, ширина, цвет кожи, уши или рога
const RACE_LOOK = {
  human: { s: 1 },
  elf: { s: 1.02, ears: true },
  dwarf: { s: 0.78, wide: 1.18 },
  halfling: { s: 0.64 },
  gnome: { s: 0.6, ears: true },
  halforc: { s: 1.08, wide: 1.08, skin: 0x9ccf7a },
  tiefling: { s: 1, skin: 0xe07a74, horns: 0x3a2228 },
  dragonborn: { s: 1.06, skin: 0xd8a85a, horns: 0xe8dcc0 },
};

// Существа: модель, рост на сцене, окраска, летает ли
const CREATURES = {
  goblin: { url: QM('goblin'), h: 1.4 },
  kobold: { url: QM('goblin'), h: 1.1, tint: 0xf0a060 },
  orc: { url: QM('orc'), h: 2.3 },
  wolf: { url: QM('wolf'), h: 1.2 },
  spider: { url: QM('spider'), h: 1.3 },
  zombie: { url: QM('zombie'), h: 2.0 },
  ghoul: { url: QM('zombie'), h: 1.9, tint: 0xc8d0c0 },
  giant: { url: QM('giant'), h: 3.4 },
  ogre: { url: QM('giant'), h: 3.2, tint: 0xc0d090 },
  troll: { url: QM('giant'), h: 3.3, tint: 0x90b080 },
  minotaur: { url: QM('giant'), h: 3.2, tint: 0xa87050 },
  bugbear: { url: QM('yeti'), h: 2.6, tint: 0xa07850 },
  gnoll: { url: QM('demon'), h: 2.3, tint: 0xc0a070 },
  yeti: { url: QM('yeti'), h: 2.8 },
  mushroom: { url: QM('mushroom'), h: 1.8 },
  dragon: { url: QM('dragon'), h: 3.2, flying: true },
  demon: { url: QM('demon'), h: 2.6 },
  imp: { url: QM('imp'), h: 1.5 },
  ghost: { url: QM('ghost'), h: 1.8, flying: true },
  ghostskull: { url: QM('ghostskull'), h: 1.8, flying: true },
  slime: { url: QM('slime'), h: 1.0 },
  golem: { url: QM('golem'), h: 2.6 },
  bat: { url: QM('bat'), h: 0.9, flying: true },
  rat: { url: QM('rat'), h: 0.6 },
  snake: { url: QM('snake'), h: 0.8 },
  ninja: { url: QM('ninja'), h: 2.0 },
  horse: { url: QM('horse'), h: 2.2 },
  cat: { url: QM('cat'), h: 0.6 },
  chicken: { url: QM('chicken'), h: 0.7 },
  cow: { url: QM('cow'), h: 1.8 },
  skeleton: { url: KK('skeleton_warrior'), kaykit: true, h: 2.2 },
  skeleton_mage: { url: KK('skeleton_mage'), kaykit: true, h: 2.2, style: 'caster' },
  skeleton_rogue: { url: KK('skeleton_rogue'), kaykit: true, h: 2.2 },
  skeleton_minion: { url: KK('skeleton_minion'), kaykit: true, h: 2.0 },
  wight: { url: KK('skeleton_warrior'), kaykit: true, h: 2.6, tint: 0x8a8aa8 },
  // люди: герои KayKit в другой раскраске
  bandit: { url: KK('rogue_hooded'), kaykit: true, h: 2.2, w: 'rogue', show: ['Knife'], tint: 0x8a8a9a },
  cultist: { url: KK('mage'), kaykit: true, h: 2.2, w: 'mage', show: ['1H_Wand'], tint: 0xb05050, style: 'caster' },
  guard: { url: KK('knight'), kaykit: true, h: 2.3, w: 'knight', show: ['1H_Sword', 'Rectangle_Shield'] },
  soldier: { url: KK('knight'), kaykit: true, h: 2.3, w: 'knight', show: ['2H_Sword'], tint: 0xd0c0a0, style: 'heavy' },
  sorcerer: { url: KK('mage'), kaykit: true, h: 2.2, w: 'mage', show: ['2H_Staff'], tint: 0x9a8ad0, style: 'caster' },
  priest: { url: KK('mage'), kaykit: true, h: 2.2, w: 'mage', show: ['Spellbook_open'], tint: 0xfff0d0, style: 'caster' },
  brute: { url: KK('barbarian'), kaykit: true, h: 2.3, w: 'barbarian', show: ['1H_Axe'], tint: 0xc0a080 },
  innkeeper: { url: KK('barbarian'), kaykit: true, h: 2.2, w: 'barbarian', show: ['Mug'], tint: 0xe0c8a0 },
  commoner: { url: KK('rogue'), kaykit: true, h: 2.1, w: 'rogue', show: [], tint: 0xd8c8a8 },
  noble: { url: KK('knight'), kaykit: true, h: 2.2, w: 'knight', show: [], tint: 0xe8c860 },
  child: { url: KK('rogue'), kaykit: true, h: 1.4, w: 'rogue', show: [], tint: 0xf0d8c0 },
};

// Таблица монстров игры (rules.js) -> существо
const MONSTER_KEY = {
  goblin: 'goblin', wolf: 'wolf', skeleton: 'skeleton', zombie: 'zombie', bandit: 'bandit', cultist: 'cultist',
  kobold: 'kobold', orc: 'orc', gnoll: 'gnoll', spider: 'spider', bugbear: 'bugbear', ghoul: 'ghoul',
  wight: 'wight', ogre: 'ogre', minotaur: 'minotaur',
};

// Слова -> существо, для того, что придумал ИИ или игроки
const WORDS = [
  ['dragon', ['дракон', 'виверн', 'змей горыныч']], ['imp', ['бес', 'чёрт', 'черт', 'чертён', 'имп']],
  ['demon', ['демон', 'дьявол', 'исчадие']], ['ghostskull', ['череп', 'лич']],
  ['ghost', ['призрак', 'привиден', 'дух', 'фантом', 'тень', 'банши']], ['slime', ['слиз', 'желе', 'слайм', 'жиж']],
  ['golem', ['голем', 'истукан', 'каменн', 'элементал']], ['bat', ['летуч', 'нетопыр', 'мыш']],
  ['rat', ['крыс']], ['snake', ['змея', 'змей', 'змеи', 'гадюк', 'василиск', 'кобр']], ['spider', ['паук', 'паучих', 'арахн']],
  ['wolf', ['волк', 'варг', 'пёс', 'пес', 'собак', 'гончая', 'шакал', 'лис']], ['goblin', ['гоблин', 'кобольд']],
  ['orc', ['орк', 'хобгоблин']], ['ghoul', ['гуль', 'упыр', 'вурдалак']], ['zombie', ['зомби', 'мертвец', 'утопленник', 'оживш']],
  ['wight', ['умертв', 'рыцарь смерти', 'тёмный рыцарь']], ['skeleton_mage', ['некромант', 'скелет-маг']],
  ['skeleton', ['скелет', 'костя']], ['minotaur', ['минотавр']], ['troll', ['тролл']], ['ogre', ['огр', 'людоед']],
  ['giant', ['великан', 'гигант', 'циклоп', 'исполин']], ['yeti', ['йети', 'снежн', 'медвед']], ['bugbear', ['багбир']],
  ['gnoll', ['гнолл']], ['mushroom', ['гриб', 'миконид']], ['ninja', ['ниндзя', 'убийц', 'ассасин', 'наёмный убий']],
  ['horse', ['лошад', 'конь', 'кобыл', 'единорог', 'пони']], ['cat', ['кот', 'кошк', 'котён']], ['chicken', ['куриц', 'петух', 'цыпл', 'птиц']],
  ['cow', ['коров', 'бык', 'телён']],
  ['cultist', ['культист', 'сектант', 'фанатик']], ['sorcerer', ['колдун', 'чародей', 'маг', 'ведьм', 'волшебн', 'шаман', 'алхимик']],
  ['priest', ['жрец', 'священник', 'монах', 'отшельник', 'старец', 'настоятел']],
  ['guard', ['стражник', 'страж', 'часовой', 'дозорн']], ['soldier', ['рыцарь', 'солдат', 'воин', 'паладин', 'капитан', 'наёмник', 'наемник']],
  ['bandit', ['разбойник', 'бандит', 'вор', 'грабител', 'пират', 'контрабандист']],
  ['innkeeper', ['трактирщик', 'корчмар', 'хозяин таверн', 'бармен', 'повар', 'кузнец', 'мельник']],
  ['noble', ['король', 'королев', 'принц', 'барон', 'граф', 'князь', 'герцог', 'староста', 'вельмож']],
  ['brute', ['громил', 'варвар', 'вышибал', 'дровосек']], ['child', ['ребён', 'ребен', 'мальчик', 'девочк', 'дети', 'детей']],
  ['commoner', ['крестьян', 'торговец', 'купец', 'травниц', 'гонец', 'житель', 'селян', 'старик', 'старух', 'женщин', 'мужчин', 'нищ', 'фермер']],
];

export function creatureFromText(text) {
  const t = String(text || '').toLowerCase();
  for (const [key, ws] of WORDS) if (ws.some((w) => t.includes(w))) return key;
  return null;
}

function heroLook(spec) {
  const c = CLASS_LOOK[spec.cls] || CLASS_LOOK.fighter;
  const r = RACE_LOOK[spec.race] || RACE_LOOK.human;
  return {
    url: KK(c.model), kaykit: true, h: 2.2 * r.s, wide: r.wide || 1,
    weaponNodes: WEAPONS[c.w || c.model], show: c.show, style: c.style,
    tint: r.skin || null, tintParts: r.skin ? ['_Head', 'Arm'] : null,
    bodyTint: c.tint || null, ears: r.ears, horns: r.horns,
  };
}

export const CAST = {
  resolve(spec) {
    let look;
    if (spec.kind === 'hero') look = heroLook(spec);
    else {
      const key = spec.creature || MONSTER_KEY[spec.key] || creatureFromText(`${spec.name || ''} ${spec.desc || ''}`) || 'goblin';
      const c = CREATURES[key] || CREATURES.goblin;
      look = { ...c, creature: key, weaponNodes: c.w ? WEAPONS[c.w] : null };
    }
    return look;
  },
  creatureFromText,
  CREATURES,
};
