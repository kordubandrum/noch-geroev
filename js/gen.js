// Генераторы без интернета: имена, внешность, локации, задания, встречные персонажи,
// короткие фразы для боя. Работают, когда нейросеть недоступна.

import { pick, RACES, CLASSES, MONSTERS, STANDARD_ARRAY, assignByClass, roll4d6 } from './rules.js';

const NAMES = {
  human: ['Ратибор', 'Всеслава', 'Милош', 'Ядвига', 'Борислав', 'Любава', 'Тихомир', 'Злата', 'Ведан', 'Агния'],
  elf: ['Лиэниэль', 'Аэлар', 'Тирэль', 'Сильвиэн', 'Элоран', 'Найриэль', 'Фаэлин', 'Ариэна'],
  dwarf: ['Торгрим', 'Брунхильда', 'Дургаш', 'Хельга', 'Балин', 'Грета', 'Ульфрик', 'Ода'],
  halfling: ['Пиппо', 'Розалинда', 'Бодо', 'Мэриголд', 'Тобиас', 'Лили', 'Фредегар', 'Мирта'],
  dragonborn: ['Арджхан', 'Сора', 'Медраш', 'Кава', 'Торинн', 'Бири', 'Назир', 'Харанн'],
  gnome: ['Шестерёнка', 'Пимпа', 'Зукк', 'Нисса', 'Фонкин', 'Орли', 'Тикко', 'Ваня-Винтик'],
  halforc: ['Грумш', 'Ока', 'Дренч', 'Шаута', 'Краг', 'Вола', 'Хенк', 'Мурра'],
  tiefling: ['Мордай', 'Акта', 'Скамос', 'Нимия', 'Дамакос', 'Кэллоу', 'Лерисса', 'Эззек'],
};

const NICK = ['Рыжий', 'Тихий', 'Хромой', 'Весёлый', 'Однорукий', 'Пепельный', 'Ворон', 'Бродяга',
  'Сказочник', 'Неудачник', 'Молчун', 'Счастливчик', 'Седой', 'Колючий'];

const LOOKS = [
  ['шрам через бровь', 'scar across eyebrow'],
  ['седая прядь в волосах', 'streak of white hair'],
  ['татуировки на руках', 'tattooed arms'],
  ['потрёпанный плащ', 'worn travelling cloak'],
  ['яркий шарф', 'bright red scarf'],
  ['повязка на глазу', 'eyepatch'],
  ['серьга в ухе', 'golden earring'],
  ['вечно растрёпанные волосы', 'messy hair'],
  ['обожжённая рука', 'burned hand'],
  ['множество амулетов', 'many amulets'],
];

const TRAITS = [
  'боится пауков, но никому не признаётся',
  'вечно голоден и таскает с собой сухари',
  'верит каждому слову и легко попадается на обман',
  'коллекционирует чужие зубы',
  'говорит стихами, когда волнуется',
  'не умеет плавать',
  'всем обещает отдать долг завтра',
  'спорит даже с богами',
  'жалеет каждого встречного зверя',
  'мечтает стать знаменитым бардом',
];

const PASTS = [
  'Вырос в портовом городе и знает всех контрабандистов.',
  'Сбежал из монастыря, прихватив старую книгу.',
  'Был деревенским кузнецом, пока деревню не сожгли.',
  'Служил стражником у жадного барона и ушёл со скандалом.',
  'Потерял брата в шахтах и ищет его до сих пор.',
  'Выиграл карту сокровищ в кости и теперь ищет, куда она ведёт.',
  'Ученик, который случайно взорвал башню учителя.',
  'Охотился на чудовищ ради денег, теперь ради мести.',
  'Подкидыш, найденный у храма с медальоном на шее.',
  'Бывший циркач, умеющий ходить по канату.',
];

export function randomHero(playerName = '') {
  const race = pick(Object.keys(RACES));
  const cls = pick(Object.keys(CLASSES));
  return makeHero({ race, cls, playerName });
}

export function makeHero({ race, cls, playerName = '', name, rolled }) {
  const look = pick(LOOKS);
  const values = rolled || STANDARD_ARRAY;
  return {
    id: 'h' + Math.random().toString(36).slice(2, 9),
    playerName,
    name: name || `${pick(NAMES[race])} ${pick(NICK)}`,
    race, cls, level: 1, xp: 0,
    base: assignByClass(values, cls),
    look: look[0],
    trait: pick(TRAITS),
    past: pick(PASTS),
    portraitEn: `${RACES[race].en} ${CLASSES[cls].en}, ${look[1]}`,
    lookEn: look[1],
    seed: Math.floor(Math.random() * 1e6),
    potions: 2,
  };
}

export function rollStatsArray() {
  return Array.from({ length: 6 }, () => roll4d6().score);
}

// ---------- локации ----------

const PLACES = [
  { kind: 'лес', names: ['Шепчущий лес', 'Чаща Кривых Сосен', 'Волчий бор'],
    desc: 'Старые деревья сплелись ветвями так густо, что днём здесь сумерки. Где-то трещат сучья.',
    en: 'dark ancient forest with twisted trees and mist' },
  { kind: 'пещера', names: ['Пещера Капающих Слёз', 'Горло Горы', 'Логово под холмом'],
    desc: 'Сырой камень, капли воды и далёкое эхо. На стенах царапины, похожие на знаки.',
    en: 'damp cave with glowing mushrooms and stalactites' },
  { kind: 'руины', names: ['Руины Старой Крепости', 'Павший храм', 'Башня Безымянного мага'],
    desc: 'Обломки колонн поросли плющом. Под ногами битая мозаика с ликами забытых королей.',
    en: 'overgrown ancient ruins with broken columns at dusk' },
  { kind: 'склеп', names: ['Склеп рода Вороновых', 'Нижние катакомбы', 'Усыпальница без имени'],
    desc: 'Холодно, пахнет пылью и воском. В нишах лежат кости, и некоторые как будто смотрят.',
    en: 'gloomy crypt with stone sarcophagi and candles' },
  { kind: 'болото', names: ['Гнилые топи', 'Болото Блуждающих огней', 'Туманная трясина'],
    desc: 'Под ногами хлюпает, над водой висят зелёные огоньки. Кто-то булькает в тростнике.',
    en: 'foggy swamp with will-o-wisps and dead trees' },
  { kind: 'горы', names: ['Перевал Ледяного Зуба', 'Орлиный уступ', 'Каменная лестница'],
    desc: 'Ветер рвёт плащи, тропа узкая, внизу пропасть. Наверху видны чьи-то костры.',
    en: 'narrow mountain pass with snow and cliffs' },
  { kind: 'город', names: ['Нижний квартал Вельграда', 'Рыночная площадь', 'Портовые склады'],
    desc: 'Толпа, крики торговцев, запах рыбы и специй. В переулках легко потерять кошелёк.',
    en: 'busy medieval fantasy town market street' },
  { kind: 'деревня', names: ['Деревня Тихий Ручей', 'Хутор у мельницы', 'Застава у брода'],
    desc: 'Низкие дома, дым из труб, лай собак. Жители смотрят на чужаков с опаской.',
    en: 'small medieval village with thatched roofs at evening' },
  { kind: 'дорога', names: ['Старый тракт', 'Королевская дорога', 'Мост через Чёрную реку'],
    desc: 'Разбитая колея, перевёрнутая телега у обочины и следы множества ног.',
    en: 'old forest road with overturned cart at sunset' },
  { kind: 'степь', names: ['Ковыльная степь', 'Курганы Предков', 'Пустошь Ветров'],
    desc: 'Трава до пояса и бескрайнее небо. Вдалеке темнеют курганы, над ними кружат птицы.',
    en: 'wide grassland steppe with ancient burial mounds' },
];

export const ARENAS = [
  { name: 'Арена Семи Ворот', desc: 'Песок, трибуны и рёв толпы. Победитель получит венок и славу.',
    en: 'gladiator arena with sand and roaring crowd', arena: 'arena1' },
  { name: 'Круг камней', desc: 'Древние камни стоят кругом. Кто выйдет из круга, тот проиграл.',
    en: 'circle of ancient standing stones under full moon', arena: 'arena2' },
  { name: 'Мост над бездной', desc: 'Узкий каменный мост, внизу клубится туман. Отступать некуда.',
    en: 'narrow stone bridge over misty abyss', arena: 'arena3' },
];

export function randomPlace(kind) {
  const p = kind ? PLACES.find((x) => x.kind === kind) || pick(PLACES) : pick(PLACES);
  return { name: pick(p.names), desc: p.desc, en: p.en, kind: p.kind, seed: Math.floor(Math.random() * 1e6) };
}

const QUEST_WHO = ['Староста деревни', 'Испуганная травница', 'Раненый гонец', 'Старый жрец', 'Купец без каравана', 'Девочка с котом'];
const QUEST_WHAT = [
  'просит найти пропавших детей',
  'просит вернуть украденную реликвию',
  'обещает награду за голову вожака банды',
  'умоляет снять проклятие с колодца',
  'просит проводить его через опасные земли',
  'хочет узнать, кто по ночам воет у кладбища',
];

export function randomQuest() {
  const place = randomPlace();
  return {
    giver: pick(QUEST_WHO),
    goal: pick(QUEST_WHAT),
    place,
    reward: 50 + Math.floor(Math.random() * 10) * 25,
  };
}

const NPC_ROLE = ['трактирщик', 'стражник', 'бродячий торговец', 'отшельник', 'гадалка', 'кузнец', 'беглый вор', 'монах'];
const NPC_MOOD = ['подозрительный', 'болтливый', 'испуганный', 'жадный', 'добродушный', 'хитрый', 'усталый'];
const NPC_SECRET = [
  'знает тайный ход', 'работает на разбойников', 'прячет в подвале раненого',
  'видел чудовище своими глазами', 'должен денег не тем людям', 'на самом деле переодетый дворянин',
];

export function randomNpc() {
  const race = pick(Object.keys(RACES));
  return {
    name: pick(NAMES[race]),
    race: RACES[race].name,
    role: pick(NPC_ROLE),
    mood: pick(NPC_MOOD),
    secret: pick(NPC_SECRET),
    en: `${RACES[race].en} ${'medieval villager'} portrait`,
    seed: Math.floor(Math.random() * 1e6),
  };
}

export function monsterFromTable(m) {
  return { ...m, desc: '', en: m.en };
}

export function randomMonster() {
  return pick(MONSTERS);
}

// ---------- фразы боя ----------

const HIT = [
  '{a} бьёт {t}, и {t2} отшатывается.',
  '{a} находит брешь в защите и попадает.',
  'Удар {a2} достигает цели.',
  '{a} не даёт врагу опомниться.',
];
const MISS = [
  '{t} уходит от удара {a2}.',
  '{a} промахивается, оружие свистит в воздухе.',
  'Удар {a2} отскакивает от защиты.',
  '{a} спотыкается, атака уходит мимо.',
];
const CRIT = [
  'Сокрушительный удар! {a} попадает точно в цель.',
  'Двадцать на кубике! {a} наносит идеальный удар.',
];
const FUMBLE = [
  'Единица на кубике. {a} роняет оружие и едва его подхватывает.',
  'Позор! {a} бьёт в пустоту и чуть не падает.',
];

export function flavor(kind, a, t) {
  const pool = { hit: HIT, miss: MISS, crit: CRIT, fumble: FUMBLE }[kind];
  return pick(pool)
    .replaceAll('{a2}', a).replaceAll('{t2}', t)
    .replaceAll('{a}', a).replaceAll('{t}', t);
}

// ---------- ведущий без интернета ----------

export function offlineIntro(state) {
  const q = state.quest;
  return `${q.giver} ${q.goal}. Путь ведёт в место под названием «${q.place.name}». ` +
    `${q.place.desc} Обещанная награда: ${q.reward} золотых. Что вы делаете?`;
}

const OUT_OK = [
  'Получилось! Путь становится понятнее.',
  'Удача на вашей стороне. Вы продвигаетесь дальше.',
  'Всё вышло, как задумано. Впереди новая загадка.',
];
const OUT_FAIL = [
  'Не вышло. Шум привлёк чьё-то внимание.',
  'Неудача. Придётся искать другой путь.',
  'Провал, и это стоило вам времени. Где-то рядом шорох.',
];

export function offlineOutcome(success) {
  return pick(success ? OUT_OK : OUT_FAIL);
}

// Какую характеристику проверять по словам игрока
export function guessStat(text) {
  const t = text.toLowerCase();
  const rules = [
    ['str', ['выбить', 'сломать', 'поднять', 'толкн', 'тащ', 'удар', 'сила', 'залез', 'карабк']],
    ['dex', ['прокрад', 'спрят', 'увернут', 'прыгн', 'взлом', 'украст', 'тихо', 'бежать', 'отмычк']],
    ['con', ['выдерж', 'терпе', 'выпить', 'холод', 'яд']],
    ['int', ['вспомн', 'изуч', 'прочит', 'разгад', 'понять', 'магия', 'руны', 'книг']],
    ['wis', ['осмотр', 'замет', 'прислуш', 'выслед', 'след', 'почувств', 'лечить', 'молит']],
    ['cha', ['убед', 'уговор', 'обман', 'соврать', 'запуга', 'договор', 'спросить', 'поговор', 'торг', 'спеть']],
  ];
  for (const [stat, words] of rules) if (words.some((w) => t.includes(w))) return stat;
  return pick(['str', 'dex', 'wis', 'cha']);
}
