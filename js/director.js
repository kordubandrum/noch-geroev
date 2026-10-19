// Режиссёр: переводит слова игроков и ведущего в сценарий для 3D-театра.
// Работает без интернета, по ключевым словам. ИИ-ведущий дополняет его своими шагами.

import { propFromText, PROPS, PROP_WORDS, setForKind } from './theater.js';

const PROP_WORDS_LIST = () => PROP_WORDS;
import { creatureFromText } from './cast.js';

// Глаголы -> действие на сцене. Порядок важен: сначала более точные.
const VERBS = [
  ['appear', ['появля', 'выскакива', 'выползa', 'выползае', 'вылезае', 'выходит из', 'возника', 'материализ', 'выбегает из', 'вылетает из']],
  ['jump', ['перепрыг', 'взмыва', 'пикиру', 'запрыг', 'прыг', 'скачу', 'сигаю', 'взбира', 'забира', 'залез', 'карабка', 'лезу', 'влезаю', 'взлета']],
  ['shoot', ['стреля', 'выстрел', 'пускаю стрел', 'из лука', 'из арбалета']],
  ['throw', ['брос', 'кида', 'кину', 'метаю', 'метну', 'швыря', 'швырн']],
  ['kick', ['пина', 'пну', 'пинок', 'ногой']],
  ['punch', ['кулаком', 'кулак', 'в морду', 'в челюсть']],
  ['cast', ['колду', 'заклина', 'магию', 'магией', 'чары', 'огненн', 'фаербол', 'молни', 'ледян', 'заморажива', 'исцеля', 'лечу ', 'лечу,', 'вылечи', 'благослов', 'молюсь', 'призыва', 'телепорт']],
  ['attack', ['бью', 'кусает', 'кусаю', 'царапа', 'хлещ', 'сокруша', 'размахива', 'ударю', 'ударяю', 'удар', 'рублю', 'руби', 'атаку', 'нападаю', 'колю', 'режу', 'пронза', 'рассека', 'кромсаю', 'сражаюсь', 'дерусь', 'набрасыва', 'вонза', 'отрубаю', 'бьёт', 'бьет', 'нападает', 'атакует']],
  ['block', ['щитом', 'закрываюсь', 'блокиру', 'защищаю', 'прикрываю']],
  ['dodge', ['уворачива', 'уклоня', 'отскакива', 'отпрыгиваю назад', 'ныряю']],
  ['sneak', ['крадусь', 'подкрад', 'прячусь', 'спрятаться', 'скрываюсь', 'тихо иду', 'на цыпочках']],
  ['run', ['бегу', 'бежа', 'выбега', 'несётся', 'несется', 'мчится', 'кидается', 'бросается', 'бежим', 'бежит', 'убега', 'мчусь', 'несусь', 'рванул', 'рвану', 'бросаюсь к', 'кидаюсь к', 'спешу', 'отступаю', 'бегом']],
  ['walk', ['иду', 'идём', 'идем', 'подхожу', 'подойду', 'подходит', 'шагаю', 'направляюсь', 'отправляюсь', 'захожу', 'вхожу', 'выхожу', 'приближаюсь']],
  ['pickup', ['беру', 'возьму', 'поднимаю', 'хватаю', 'подбираю', 'забираю', 'краду', 'стащить', 'ворую']],
  ['use', ['открыва', 'осматрива', 'обыскива', 'изуча', 'трогаю', 'дёргаю', 'дергаю', 'тяну', 'нажима', 'ищу', 'исследу', 'пью', 'выпиваю', 'ем ', 'чиню', 'взламыва', 'читаю']],
  ['sit', ['сажусь', 'сяду', 'присажива', 'сидеть']],
  ['fall', ['падаю', 'ложусь', 'притворяюсь мёртв', 'притворяюсь мертв', 'валюсь', 'сплю', 'засыпаю']],
  ['cheer', ['радуюсь', 'танцую', 'праздну', 'смеюсь', 'ликую', 'пляшу', 'аплодиру']],
  ['taunt', ['дразн', 'насмеха', 'угрожа', 'рыч', 'ревёт', 'ревет', 'рёв', 'запугива', 'показываю язык', 'скали', 'шипит']],
  ['talk', ['говор', 'крич', 'спраш', 'отвеча', 'шепч', 'бормоч', 'вопит', 'скажу', 'спрашива', 'спрошу', 'кричу', 'зову', 'приветству', 'здорова', 'убежда', 'уговарива', 'торгу', 'шучу', 'пою', 'рассказыва', 'объясня', 'предлага', 'прошу', 'обращаюсь', 'знакомлюсь', 'договарива', 'вру', 'обманыва', 'льщу']],
];

const FX_WORDS = [
  ['fire', ['огн', 'пламен', 'фаербол', 'жар', 'сжига']], ['lightning', ['молни', 'гром', 'электр']],
  ['ice', ['лёд', 'лед', 'ледян', 'мороз', 'холод', 'замораж']], ['heal', ['исцел', 'лечу', 'вылеч', 'лечение', 'благослов']],
  ['light', ['свет', 'сияни', 'святой', 'священн']], ['shadow', ['тьм', 'тень', 'тени', 'проклят', 'некро']], ['poison', ['яд', 'отрав']],
];

const HOSTILE = new Set(['attack', 'shoot', 'throw', 'kick', 'punch', 'cast', 'taunt']);

function splitClauses(text) {
  return String(text)
    .replace(/[«»"“”]([^«»"“”]*)[«»"“”]/g, (m) => m.replace(/[,.]/g, '‧'))
    .split(/[,.;!?]|\s+и\s+|\s+а потом\s+|\s+потом\s+|\s+затем\s+|\s+после этого\s+|\s+тут же\s+/i)
    .map((s) => s.replace(/‧/g, ',').trim())
    .filter((s) => s.length > 1);
}

function quoted(text) {
  const m = String(text).match(/[«"“]([^«»"“”]{1,140})[»"”]/);
  return m ? m[1] : '';
}

function verbOf(clause) {
  const t = ' ' + clause.toLowerCase() + ' ';
  let best = null, pos = Infinity;
  for (const [act, ws] of VERBS) {
    for (const w of ws) {
      const i = t.indexOf(w);
      if (i >= 0 && i < pos) { pos = i; best = act; }
    }
  }
  return best;
}

// Все предметы в тексте по порядку упоминания
function propsInText(text) {
  const t = String(text).toLowerCase();
  const found = [];
  for (const [type, ws] of PROP_WORDS_LIST()) {
    let at = Infinity;
    for (const w of ws) { const i = t.indexOf(w); if (i >= 0 && i < at) at = i; }
    if (at < Infinity) found.push([at, type]);
  }
  return found.sort((a, b) => a[0] - b[0]).map((x) => x[1]);
}

function fxOf(text) {
  const t = String(text).toLowerCase();
  const hit = FX_WORDS.find(([, ws]) => ws.some((w) => t.includes(w)));
  return hit ? hit[0] : null;
}

// Сцена в памяти игры: место, предметы, кто стоит на сцене (кроме героев)
export function emptyStage(place) {
  return { set: setForKind(place?.kind || '', `${place?.name || ''} ${place?.desc || ''}`), props: [], actors: [] };
}

let uid = 0;
const newId = (p) => `${p}${Date.now().toString(36)}${(uid++).toString(36)}`;

// Найти на сцене актёра, о котором речь в тексте (по имени или по виду существа)
function findActorIn(text, stage, heroes) {
  const t = String(text).toLowerCase();
  for (const h of heroes) {
    const first = h.name.split(' ')[0].toLowerCase();
    if (first.length > 2 && t.includes(first.slice(0, Math.max(3, first.length - 2)))) return { id: h.id, hero: true };
  }
  for (const a of stage.actors) {
    const n = a.name.toLowerCase().split(' ')[0];
    if (n.length > 2 && t.includes(n.slice(0, Math.max(3, n.length - 2)))) return { id: a.id };
  }
  const kind = creatureFromText(t);
  if (kind) {
    const same = stage.actors.find((a) => a.creature === kind && !a.dead);
    if (same) return { id: same.id };
    return { spawn: kind };
  }
  return null;
}

const CREATURE_NAMES = {
  goblin: 'Гоблин', kobold: 'Кобольд', orc: 'Орк', wolf: 'Волк', spider: 'Паук', zombie: 'Зомби', ghoul: 'Упырь', giant: 'Великан',
  ogre: 'Огр', troll: 'Тролль', minotaur: 'Минотавр', bugbear: 'Багбир', gnoll: 'Гнолл', yeti: 'Йети', mushroom: 'Грибник',
  dragon: 'Дракон', demon: 'Демон', imp: 'Бес', ghost: 'Призрак', ghostskull: 'Череп', slime: 'Слизень', golem: 'Голем',
  bat: 'Летучая мышь', rat: 'Крыса', snake: 'Змея', ninja: 'Убийца', horse: 'Конь', cat: 'Кот', chicken: 'Курица', cow: 'Корова',
  skeleton: 'Скелет', skeleton_mage: 'Некромант', skeleton_rogue: 'Скелет', skeleton_minion: 'Скелет', wight: 'Умертвие',
  bandit: 'Разбойник', cultist: 'Культист', guard: 'Стражник', soldier: 'Воин', sorcerer: 'Колдун', priest: 'Жрец',
  brute: 'Громила', innkeeper: 'Трактирщик', noble: 'Вельможа', child: 'Ребёнок', commoner: 'Житель',
};

const FRIENDLY = new Set(['horse', 'cat', 'chicken', 'cow', 'guard', 'priest', 'innkeeper', 'noble', 'child', 'commoner']);

// Добавить существо в сцену. Возвращает его описание.
export function spawn(stage, creature, name, extra = {}) {
  const used = new Set(stage.actors.map((a) => a.slot));
  const slots = FRIENDLY.has(creature) ? ['back', 'back-right', 'center', 'back-left', 'front-right'] : ['right', 'back-right', 'front-right', 'center', 'back'];
  const slot = slots.find((s) => !used.has(s)) || 'back';
  const same = stage.actors.filter((a) => a.creature === creature).length;
  const a = { id: newId('a'), creature, name: name || (CREATURE_NAMES[creature] || 'Незнакомец') + (same ? ` ${same + 1}` : ''), slot, side: FRIENDLY.has(creature) ? 'N' : 'B', ...extra };
  stage.actors.push(a);
  return a;
}

export function addPropTo(stage, type, slot) {
  const have = stage.props.find((p) => p.type === type);
  if (have) return have;
  const p = { id: type + (stage.props.length ? stage.props.length : ''), type, slot };
  stage.props.push(p);
  return p;
}

// Главное: фраза -> сценарий.
// who: id того, кто действует (герой). Если null, подлежащее ищется в тексте (для ведущего).
export function parseAction(text, { who, stage, heroes }) {
  const beats = [];
  const spawned = [];
  const say = quoted(text);
  const clauses = splitClauses(text);
  let lastTarget = null;
  let lastProp = null;
  let actorId = who;

  for (const clause of clauses) {
    const verb = verbOf(clause);
    let subject = actorId;
    // У ведущего подлежащее может быть любым: «орк выбегает из-за бочки»
    if (!who) {
      const s = findActorIn(clause.split(/\s+/).slice(0, 3).join(' '), stage, heroes);
      if (s?.spawn) { const a = spawn(stage, s.spawn); spawned.push(a); subject = a.id; beats.push({ who: a.id, do: 'appear' }); }
      else if (s) subject = s.id;
      if (subject) actorId = subject; // «дракон взлетает и рычит»: второе действие того же дракона
    }
    if (!subject) {
      // Упомянули существо или предмет без действия: просто появляется
      const s = findActorIn(clause, stage, heroes);
      if (s?.spawn) { const a = spawn(stage, s.spawn); spawned.push(a); beats.push({ who: a.id, do: 'appear' }); }
      const pt = propFromText(clause);
      if (pt && PROPS[pt]) addPropTo(stage, pt);
      continue;
    }
    const types = propsInText(clause).filter((x) => PROPS[x]);
    // «с балкона на люстру»: сначала на первый предмет, потом на второй
    if (types.length > 1 && (verb === 'jump' || verb === 'run' || verb === 'walk')) {
      for (const tp of types.slice(0, -1)) beats.push({ who: subject, do: verb === 'jump' ? 'jump' : verb, to: addPropTo(stage, tp).id });
    }
    let prop = types.length ? addPropTo(stage, types[types.length - 1]) : null;
    if (!prop && lastProp && ['use', 'pickup', 'sit', 'sneak'].includes(verb)) prop = lastProp;
    if (prop) lastProp = prop;
    // цель: кто-то, кроме самого действующего
    const rest = clause.replace(/^\S+\s*/, '');
    let tgt = findActorIn(rest, stage, heroes);
    if (tgt && tgt.id === subject) tgt = null;
    if (tgt?.spawn) {
      const a = spawn(stage, tgt.spawn);
      spawned.push(a);
      beats.push({ who: a.id, do: 'appear' });
      tgt = { id: a.id };
    }
    if (!tgt && verb && HOSTILE.has(verb) && verb !== 'cast') {
      const foe = stage.actors.find((a) => a.side === 'B' && !a.dead);
      if (foe) tgt = { id: foe.id };
    }
    if (tgt) lastTarget = tgt.id;
    const target = tgt?.id || (verb && HOSTILE.has(verb) ? lastTarget : null);
    if (verb === 'appear') { if (!beats.some((x) => x.who === subject && x.do === 'appear')) beats.push({ who: subject, do: 'appear' }); continue; }
    const b = { who: subject, do: verb || (prop ? 'walk' : 'talk') };
    if (prop) b.to = prop.id;
    if (target) b.target = target;
    if (verb === 'cast') b.fx = fxOf(clause) || 'magic';
    if (verb === 'attack' && /спин|кругом|вокруг|вихр/.test(clause)) b.do = 'spin';
    if ((verb === 'walk' || verb === 'run' || verb === 'sneak') && !prop && target) b.to = target;
    if ((verb === 'walk' || verb === 'run') && !b.to) b.to = 'center';
    if (verb === 'talk' && say) b.say = say;
    if (verb === 'talk' && !say) b.say = clause.length < 60 ? clause : '';
    beats.push(b);
  }

  if (!beats.length && who) beats.push({ who, do: 'talk', say: say || '' });
  return { beats, spawned };
}

// Итог проверки: короткая сцена успеха или провала
export function outcomeBeats(heroId, ok, stage) {
  const foe = stage.actors.find((a) => a.side === 'B' && !a.dead);
  if (ok) return [{ who: heroId, do: 'cheer' }];
  return foe
    ? [{ who: foe.id, do: 'taunt' }, { who: heroId, do: 'hit' }]
    : [{ who: heroId, do: 'fall', wait: 500 }, { who: heroId, do: 'getup' }];
}

// Шаги, которые прислал ИИ: проверяем, что кто/куда существуют, лишнее отбрасываем
const DOS = new Set(['walk', 'run', 'sneak', 'fly', 'jump', 'climb', 'attack', 'jump_attack', 'spin', 'shoot', 'cast', 'summon', 'throw',
  'kick', 'punch', 'block', 'dodge', 'hit', 'die', 'fall', 'getup', 'rise', 'cheer', 'taunt', 'talk', 'use', 'pickup', 'open', 'sit', 'appear', 'vanish']);

export function acceptAiStage(st, stage, heroes) {
  if (!st || typeof st !== 'object') return [];
  const ids = new Map();
  for (const p of (Array.isArray(st.props) ? st.props : []).slice(0, 6)) {
    const type = PROPS[p?.type] ? p.type : propFromText(`${p?.type} ${p?.id}`);
    if (type) { const pr = addPropTo(stage, type); ids.set(String(p.id || type), pr.id); }
  }
  for (const a of (Array.isArray(st.actors) ? st.actors : []).slice(0, 6)) {
    if (!a?.name) continue;
    const known = stage.actors.find((x) => x.name.toLowerCase() === String(a.name).toLowerCase());
    if (known) { ids.set(String(a.id || a.name), known.id); continue; }
    const kind = (a.creature && CREATURE_NAMES[a.creature] ? a.creature : null) || creatureFromText(`${a.name} ${a.creature || ''}`) || 'commoner';
    const n = spawn(stage, kind, String(a.name).slice(0, 30));
    if (a.enemy === false) n.side = 'N';
    if (a.enemy === true) n.side = 'B';
    ids.set(String(a.id || a.name), n.id);
  }
  const heroIds = new Set(heroes.map((h) => h.id));
  const ref = (x) => {
    if (!x) return undefined;
    const s = String(x);
    if (ids.has(s)) return ids.get(s);
    if (heroIds.has(s)) return s;
    if (stage.actors.some((a) => a.id === s)) return s;
    if (stage.props.some((p) => p.id === s)) return s;
    const h = heroes.find((hh) => hh.name.toLowerCase().startsWith(s.toLowerCase().slice(0, 4)));
    if (h) return h.id;
    const a = stage.actors.find((aa) => aa.name.toLowerCase().startsWith(s.toLowerCase().slice(0, 4)));
    if (a) return a.id;
    const pt = propFromText(s);
    if (pt) return addPropTo(stage, pt).id;
    return ['left', 'center', 'right', 'back', 'front', 'back-left', 'back-right', 'front-left', 'front-right'].includes(s) ? s : undefined;
  };
  const out = [];
  for (const b of (Array.isArray(st.beats) ? st.beats : []).slice(0, 10)) {
    const who = ref(b?.who);
    if (!who || !DOS.has(b.do)) continue;
    out.push({ who, do: b.do, to: ref(b.to), target: ref(b.target), say: b.say ? String(b.say).slice(0, 120) : undefined, fx: b.fx });
  }
  // новые существа без шагов всё равно появляются
  return out;
}
