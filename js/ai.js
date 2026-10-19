// Нейросети: текст (ведущий, генерация героев) и картинки.
// Бесплатный сервис Pollinations без ключа. Его лимиты (проверено 19.10.2026):
// 1 ответ текста в 30 секунд и 1 картинка в 45 секунд с одного адреса.
// Поэтому основные картинки лежат в приложении (папка art), а нейросеть рисует
// только уникальные портреты, через очередь. Ключ, если появится, хранится
// только в памяти телефона (localStorage) и в файлы не попадает.

import { RACES, CLASSES, STAT_NAMES, finalStats, mod, fmtMod } from './rules.js';

const TEXT_URL = 'https://text.pollinations.ai/openai';
const IMG_URL = 'https://image.pollinations.ai/prompt/';
const STYLE = 'dark fantasy digital painting, dramatic rim lighting, rich colors, detailed, no text';

export const settings = {
  get(key, def) {
    try { const v = localStorage.getItem('igra.set.' + key); return v === null ? def : JSON.parse(v); } catch { return def; }
  },
  set(key, val) {
    try { localStorage.setItem('igra.set.' + key, JSON.stringify(val)); } catch { /* приватный режим */ }
  },
};

const hasKey = () => !!settings.get('token', '');
export function aiArtOn() { return settings.get('images', true); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- библиотека картинок внутри приложения ----------

const PLACE_FILE = {
  'лес': 'les', 'пещера': 'peshera', 'руины': 'ruiny', 'склеп': 'sklep', 'болото': 'boloto',
  'горы': 'gory', 'город': 'gorod', 'деревня': 'derevnya', 'дорога': 'doroga', 'степь': 'step',
};
const PLACE_WORDS = [
  ['лес', ['лес', 'чащ', 'бор', 'роща', 'дерев']], ['пещера', ['пещер', 'грот', 'логов', 'шахт', 'подзем']],
  ['руины', ['руин', 'развалин', 'храм', 'башн', 'крепост', 'замок']], ['склеп', ['склеп', 'катакомб', 'кладбищ', 'гробниц', 'усыпальн']],
  ['болото', ['болот', 'топ', 'трясин']], ['горы', ['гор', 'перевал', 'скал', 'утёс', 'утес']],
  ['город', ['город', 'рынок', 'рыноч', 'площад', 'порт', 'улиц', 'таверн', 'трактир']], ['деревня', ['деревн', 'хутор', 'сел', 'мельниц']],
  ['дорога', ['дорог', 'тракт', 'мост', 'путь']], ['степь', ['степ', 'пустош', 'равнин', 'поле', 'курган']],
];

export function placeKind(text) {
  const t = String(text || '').toLowerCase();
  for (const [kind, words] of PLACE_WORDS) if (words.some((w) => t.includes(w))) return kind;
  return '';
}

export function libPlace(place) {
  if (!place) return null;
  if (place.arena) return `art/places/${place.arena}.webp`;
  const kind = place.kind || placeKind(`${place.name} ${place.desc}`);
  return `art/places/${PLACE_FILE[kind] || 'doroga'}.webp`;
}

export const libHero = (hero) => `art/heroes/${hero.race}-${hero.cls}.webp`;

const MONSTER_WORDS = [
  ['goblin', 'гоблин'], ['wolf', 'волк'], ['skeleton', 'скелет'], ['zombie', 'зомби'], ['bandit', 'разбойн'], ['bandit', 'бандит'],
  ['cultist', 'культист'], ['cultist', 'жрец'], ['kobold', 'кобольд'], ['orc', 'орк'], ['gnoll', 'гнолл'], ['spider', 'паук'],
  ['bugbear', 'багбир'], ['ghoul', 'гуль'], ['ghoul', 'мертвец'], ['wight', 'умертв'], ['wight', 'рыцар'], ['ogre', 'огр'],
  ['ogre', 'тролл'], ['ogre', 'великан'], ['minotaur', 'минотавр'],
];

export function libMonster(e) {
  if (e.key) return `art/monsters/${e.key}.webp`;
  const n = String(e.name || '').toLowerCase();
  const hit = MONSTER_WORDS.find(([, w]) => n.includes(w));
  return hit ? `art/monsters/${hit[0]}.webp` : null;
}

// ---------- уникальные картинки нейросети ----------

export function imageUrl(promptEn, seed, w = 384, h = 480) {
  const p = encodeURIComponent(`${promptEn}, ${STYLE}`);
  const t = settings.get('token', '');
  return `${IMG_URL}${p}?width=${w}&height=${h}&seed=${seed}&nologo=true${t ? '&token=' + encodeURIComponent(t) : ''}`;
}

export function portraitUrl(hero) {
  return imageUrl(`portrait of ${hero.portraitEn}, fantasy character, upper body`, hero.seed);
}

export function sceneUrl(place) {
  return imageUrl(`wide landscape, ${place.en}`, place.seed || 1, 768, 512);
}

// Очередь художника: по одной картинке, с паузой, которую требует сервис.
// Готовые картинки сохраняются в памяти телефона и второй раз не рисуются.
const imgMemo = new Map();
const imgQueue = [];
let imgBusy = false;
let nextImgAt = 0;
const IMG_GAP = hasKey() ? 2000 : 46000;

export function queueImage(url) {
  if (imgMemo.has(url)) return imgMemo.get(url);
  const p = new Promise((resolve) => imgQueue.push({ url, resolve, tries: 0 }));
  imgMemo.set(url, p);
  pumpImages();
  return p;
}

export function imageQueueInfo() {
  return { pending: imgQueue.length + (imgBusy ? 1 : 0), wait: Math.max(0, Math.ceil((nextImgAt - Date.now()) / 1000)) };
}

async function cached(url) {
  try {
    const c = await caches.open('igra-art');
    const hit = await c.match(url);
    return hit ? URL.createObjectURL(await hit.blob()) : null;
  } catch { return null; }
}

async function pumpImages() {
  if (imgBusy) return;
  imgBusy = true;
  while (imgQueue.length) {
    // Последний запрошенный рисуется первым: он сейчас на экране
    const job = imgQueue.pop();
    const hit = await cached(job.url);
    if (hit) { job.resolve(hit); continue; }
    const wait = nextImgAt - Date.now();
    if (wait > 0) await sleep(wait);
    try {
      const res = await fetch(job.url);
      if (res.status === 402 || res.status === 429) {
        const txt = await res.text();
        const m = txt.match(/every (\d+) seconds/);
        nextImgAt = Date.now() + ((m ? +m[1] : 45) + 2) * 1000;
        if (++job.tries < 4) imgQueue.push(job); else job.resolve(null);
        continue;
      }
      if (!res.ok) throw new Error(res.status);
      const blob = await res.blob();
      try { (await caches.open('igra-art')).put(job.url, new Response(blob)); } catch { /* без кэша тоже работает */ }
      nextImgAt = Date.now() + IMG_GAP;
      job.resolve(URL.createObjectURL(blob));
    } catch {
      nextImgAt = Date.now() + 10000;
      job.resolve(null);
      imgMemo.delete(job.url);
    }
  }
  imgBusy = false;
}

// ---------- текст ----------

let nextTextAt = 0;
const TEXT_GAP = 31000;

// onWait(sec): сообщает, сколько секунд осталось до ответа по лимиту сервиса
async function chat(messages, { json = true, timeout = 60000, onWait } = {}) {
  const body = { model: 'openai', messages, seed: Math.floor(Math.random() * 1e6) };
  if (json) body.response_format = { type: 'json_object' };
  const t = settings.get('token', '');
  const headers = { 'Content-Type': 'application/json' };
  if (t) headers.Authorization = 'Bearer ' + t;

  const deadline = Date.now() + 75000; // дольше ждать нельзя: игра переходит на таблицы
  for (let attempt = 0; attempt < 4; attempt++) {
    if (Date.now() + Math.max(0, nextTextAt - Date.now()) > deadline) break;
    while (!t && Date.now() < nextTextAt) {
      onWait?.(Math.ceil((nextTextAt - Date.now()) / 1000));
      await sleep(1000);
    }
    onWait?.(0);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    try {
      const res = await fetch(TEXT_URL, { method: 'POST', headers, body: JSON.stringify(body), signal: ctrl.signal });
      clearTimeout(timer);
      nextTextAt = Date.now() + TEXT_GAP;
      if (res.status === 402 || res.status === 429) {
        const txt = await res.text();
        const m = txt.match(/Retry after (\d+)s/);
        nextTextAt = Date.now() + ((m ? +m[1] : 30) + 1) * 1000;
        continue;
      }
      if (!res.ok) throw new Error('Сервис ответил ' + res.status);
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content || '';
      if (!json) return text.trim();
      return parseJson(text);
    } catch (e) {
      clearTimeout(timer);
      if (attempt >= 1) throw e;
    }
  }
  throw new Error('Сервис не отвечает');
}

function parseJson(text) {
  try { return JSON.parse(text); } catch { /* ниже вторая попытка */ }
  const m = text.match(/\{[\s\S]*\}/);
  if (m) return JSON.parse(m[0]);
  throw new Error('Нейросеть ответила не по формату');
}

const STYLE_RU = 'Пиши на правильном, простом и живом русском языке, как хороший писатель-сказочник. Короткие предложения. Без канцелярита и без выдуманных слов.';

// ---------- герой по описанию ----------

export async function heroFromIdea(idea, onWait) {
  const races = Object.entries(RACES).map(([k, r]) => `${k} (${r.name})`).join(', ');
  const classes = Object.entries(CLASSES).map(([k, c]) => `${k} (${c.name})`).join(', ');
  const sys = `Ты помогаешь создать персонажа для ролевой игры в стиле D&D. ${STYLE_RU}
Ответ строго JSON:
{"name":"имя и прозвище","race":"ключ расы","cls":"ключ класса","look":"внешность, 1 фраза","trait":"черта характера, 1 фраза","past":"прошлое, 1-2 фразы","portrait_en":"описание внешности на английском для художника, 15-25 слов, без имени"}
Расы: ${races}. Классы: ${classes}.`;
  const r = await chat([{ role: 'system', content: sys }, { role: 'user', content: idea || 'удиви меня' }], { onWait });
  if (!RACES[r.race]) r.race = 'human';
  if (!CLASSES[r.cls]) r.cls = 'fighter';
  return r;
}

// ---------- ведущий ----------

function partySheet(party) {
  return party.map((h) => {
    const s = finalStats(h.base, h.race);
    const stats = Object.keys(s).map((k) => `${STAT_NAMES[k]} ${s[k]} (${fmtMod(mod(s[k]))})`).join(', ');
    return `- id ${h.id}: ${h.name}, ${RACES[h.race].name}, ${CLASSES[h.cls].name.toLowerCase()}, ${h.level} ур., здоровье ${h.hp}/${h.maxHp}. ${stats}. Внешность: ${h.look}. Характер: ${h.trait}`;
  }).join('\n');
}

const GM_RULES = `Ты опытный ведущий настольной ролевой игры в стиле D&D. Компания друзей играет с одного телефона.
${STYLE_RU} 2-4 предложения. Обращайся к героям по именам. Не решай за игроков, что они делают.
Мир: ТЕМА. Будь честным: глупые действия могут провалиться, смелые вознаграждаются.
Когда исход действия не очевиден, назначь проверку: характеристика (str, dex, con, int, wis, cha) и сложность 10 (легко), 15 (средне) или 20 (трудно). В narration опиши только попытку, а исходы напиши в success и fail: что случится при успехе и при провале, по 1-2 предложения каждый. Если провал ведёт к драке, поставь fight_on_fail true.
Когда дело доходит до драки, начни бой и опиши врагов. Числа врагов для героев 1 уровня: здоровье 5-30, класс доспеха 11-15, бонус атаки 3-5, урон от 1d6+1 до 2d6+2. Врагов от 1 до 4. Не устраивай бой каждый ход.
Строки в квадратных скобках от системы: результаты бросков и боёв, учитывай их.
Ответ строго JSON такого вида:
{"narration":"текст ведущего",
 "check":null или {"hero_id":"id героя","stat":"dex","dc":15,"why":"что проверяем, коротко","success":"что будет при успехе","fail":"что будет при провале","fight_on_fail":false},
 "combat":null или {"enemies":[{"name":"","hp":0,"ac":0,"atk":0,"dmg":"1d6+1","weapon":"","desc":"","en":"short english description for artist"}]},
 "scene":null или {"name":"название нового места","desc":"1 фраза","en":"english description of the place for artist"},
 "stage":{"actors":[{"id":"короткий id","name":"Имя","creature":"вид из списка","enemy":true}],"props":[{"id":"chandelier","type":"тип предмета"}],"beats":[{"who":"id героя или актёра","do":"действие","to":"id предмета или места","target":"id","say":"реплика","fx":"fire"}]},
 "next_hero_id":"id героя, к которому обращаешься дальше",
 "options":["короткий вариант действия","вариант","вариант"],
 "xp":0}
stage это постановка для 3D-сцены: кто появился и что делают НЕ игроки (действие героя уже показано отдельно). 1-4 шага. Новых персонажей добавляй в actors, тех, кто уже на сцене, не повторяй.
Виды (creature): goblin, orc, wolf, spider, zombie, skeleton, giant, troll, ogre, minotaur, yeti, dragon, demon, imp, ghost, slime, golem, bat, rat, snake, bandit, cultist, guard, soldier, sorcerer, priest, innkeeper, noble, commoner, child, horse, cat, cow, chicken.
Предметы (type): table, chair, barrel, crate, chest, balcony, chandelier, pillar, rock, tree, bush, torch, campfire, well, cart, statue, altar, coffin, throne, door, bridge, cage, ladder, tent.
Действия (do): walk, run, sneak, jump, attack, shoot, cast, throw, block, dodge, hit, die, fall, getup, cheer, taunt, talk, use, pickup, sit, appear, vanish. fx для cast: fire, ice, lightning, heal, light, shadow. Места (to): left, center, right, back, front.
scene заполняй, только когда герои пришли в новое место. xp: опыт за решённую задачу без боя (0, 50 или 100).`;

export async function gmTurn(state, userMessage, onWait) {
  const sys = GM_RULES.replace('ТЕМА', state.theme || 'классическое фэнтези') +
    `\n\nЗадание: ${state.quest.giver} ${state.quest.goal}. Награда ${state.quest.reward} золотых.` +
    `\nТекущее место: ${state.place.name}. ${state.place.desc}` +
    `\nНа сцене сейчас: ${(state.stage?.actors || []).filter((x) => !x.dead).map((x) => `${x.id} (${x.name})`).join(', ') || 'никого'}; предметы: ${(state.stage?.props || []).map((p) => p.id).join(', ') || 'нет'}.` +
    `\nГерои:\n${partySheet(state.party)}`;
  const history = state.log.filter((e) => e.who === 'gm' || e.who === 'player').slice(-12).map((e) => ({
    role: e.who === 'gm' ? 'assistant' : 'user',
    content: e.who === 'gm' ? JSON.stringify({ narration: e.text }) : `${e.name || ''}: ${e.text}`,
  }));
  return chat([{ role: 'system', content: sys }, ...history, { role: 'user', content: userMessage }], { onWait });
}

export async function gmIntro(state, onWait) {
  return gmTurn(state, 'Начни приключение: опиши, где стоят герои и кто даёт им задание. Боя и проверки пока нет. Обратись к первому герою.', onWait);
}

// Помощь ведущему-человеку
export async function gmIdea(kind, state, onWait) {
  const what = {
    place: 'Придумай новое место для приключения. JSON {"name":"","desc":"2 фразы атмосферы","en":"english description for artist"}',
    npc: 'Придумай встречного персонажа. JSON {"name":"","role":"кто он","mood":"настроение","secret":"его тайна","speech":"фраза, которую он говорит","en":"english portrait description"}',
    twist: 'Придумай неожиданный поворот сюжета для текущей сцены. JSON {"text":"2-3 фразы"}',
    riddle: 'Придумай загадку, которую страж задаёт героям. Загадка должна иметь один ясный ответ. JSON {"text":"загадка","answer":"ответ"}',
  }[kind];
  const ctx = `Мир: ${state.theme || 'фэнтези'}. Место сейчас: ${state.place?.name || 'неизвестно'}. Задание: ${state.quest?.goal || 'нет'}.`;
  return chat([{ role: 'system', content: `Ты помощник ведущего ролевой игры. ${STYLE_RU} ${ctx}` }, { role: 'user', content: what }], { onWait });
}
