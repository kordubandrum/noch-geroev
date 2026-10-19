// Ночь Героев: экраны и ход игры.

import {
  RACES, CLASSES, STATS, STAT_NAMES, STAT_SHORT, STAT_HINT, DC_LEVELS, MONSTERS,
  finalStats, mod, fmtMod, prof, maxHp, heroAC, spellSlots, levelFromXp, rollD20, rnd,
  STANDARD_ARRAY, assignByClass, buildEncounter, sanitizeEnemy, pick,
} from './rules.js';
import {
  makeHero, randomHero, rollStatsArray, randomPlace, randomQuest, randomNpc, ARENAS,
  offlineIntro, offlineOutcome, guessStat,
} from './gen.js';
import { settings, imageUrl, heroFromIdea, gmTurn, gmIntro, gmIdea, placeKind } from './ai.js';
import {
  h, toast, art, heroArt, placeImg, diceOverlay, sheet, speak, stopSpeak, canListen, listen,
} from './ui.js';
import { runCombat } from './combat-view.js';

const app = document.getElementById('app');
const mount = (...nodes) => app.append(...nodes.filter((x) => x !== null && x !== undefined && x !== false));
const SAVE_KEY = 'igra.save.v1';

// ---------- сохранение ----------

let S = load();

function load() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || null; } catch { return null; }
}
function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch { /* память переполнена или приватный режим */ }
}

function newState(mode) {
  return {
    v: 1, mode, theme: 'классическое фэнтези',
    party: [], quest: null, place: null, log: [],
    activeHeroId: null, options: [], pending: null, gold: 0, started: false,
  };
}

// ---------- навигация ----------

const screens = {};
function go(name, ...args) {
  stopSpeak();
  app.innerHTML = '';
  window.scrollTo(0, 0);
  screens[name](...args);
}

const back = (to) => h('button', { class: 'icon-btn', 'aria-label': 'Назад', onclick: () => go(to) }, '‹');

const modeName = { ai: 'Ведущий-ИИ', human: 'Ведущий-человек', arena: 'Арена' };

// ---------- главный экран ----------

screens.home = () => {
  const die = h('div', { class: 'home-die', html: `<svg viewBox="0 0 200 200" width="150" height="150"><polygon points="100,8 180,54 180,146 100,192 20,146 20,54" fill="#d4ab52" stroke="#0f1226" stroke-width="5" stroke-linejoin="round"/><polygon points="100,46 154,140 46,140" fill="#f0d48a" stroke="#0f1226" stroke-width="4"/><g stroke="#0f1226" stroke-width="4" fill="none"><polyline points="100,8 100,46"/><polyline points="180,54 154,140"/><polyline points="20,54 46,140"/><polyline points="20,54 100,46 180,54"/><polyline points="20,146 46,140 100,192 154,140 180,146"/></g><text x="100" y="118" text-anchor="middle" font-family="Cormorant, serif" font-weight="700" font-size="46" fill="#0f1226">20</text></svg>` });
  const has = S && S.party?.length;
  mount(h('div', { class: 'home' },
    h('div', { class: 'home-art' }, h('div', { class: 'center' }, die, h('h1', { class: 'home-title' }, 'Ночь Героев', h('span', {}, 'ролевая игра с одного телефона')))),
    has ? h('button', { class: 'btn primary block', onclick: resume }, `Продолжить: ${S.party.map((x) => x.name.split(' ')[0]).join(', ')}`) : null,
    h('button', { class: (has ? 'btn' : 'btn primary') + ' block', onclick: () => go('setup') }, 'Новая игра'),
    h('div', { class: 'row' },
      h('button', { class: 'btn ghost grow', onclick: () => go('rules') }, 'Как играть'),
      h('button', { class: 'btn ghost grow', onclick: () => go('settings') }, 'Настройки')),
  ));
};

function resume() {
  if (!S.started) return go('party');
  if (S.mode === 'arena') return go('party');
  go('story');
}

// ---------- новая игра ----------

const THEMES = ['классическое фэнтези', 'тёмное фэнтези, нежить и проклятия', 'пираты и морские острова', 'добрая сказка для детей', 'славянские сказки и нечисть'];

screens.setup = () => {
  const st = { mode: 'ai', theme: THEMES[0], custom: '' };
  const modes = [
    ['ai', 'Ведущий-ИИ', 'Нейросеть рассказывает историю, назначает проверки и врагов. Играют все.'],
    ['human', 'Ведущий-человек', 'Один из вас ведёт игру. Приложение придумывает места, встречных, врагов и показывает бой.'],
    ['arena', 'Арена', 'Без сюжета: создайте героев и сразитесь друг с другом.'],
  ];
  const list = h('div', { class: 'stack' });
  const themeBox = h('div', { class: 'stack' });
  const draw = () => {
    list.innerHTML = '';
    for (const [k, n, d] of modes) {
      list.append(h('button', { class: 'choice' + (st.mode === k ? ' on' : ''), onclick: () => { st.mode = k; draw(); } }, h('b', {}, n), h('span', { class: 'muted small' }, d)));
    }
    themeBox.hidden = st.mode === 'arena';
    themeBox.innerHTML = '';
    themeBox.append(h('h3', {}, 'Мир'));
    const chips = h('div', { class: 'chips' });
    for (const t of THEMES) chips.append(h('button', { class: 'chip' + (st.theme === t && !st.custom ? ' on' : ''), onclick: () => { st.theme = t; st.custom = ''; draw(); } }, t));
    const inp = h('input', { type: 'text', placeholder: 'или свой: «киберпанк-Волгоград», «школа магии»…', value: st.custom });
    inp.oninput = () => { st.custom = inp.value; chips.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', !inp.value && c.textContent === st.theme)); };
    themeBox.append(chips, inp);
  };
  draw();
  mount(
    h('div', { class: 'topbar' }, back('home'), h('h2', {}, 'Новая игра')),
    list, h('div', { class: 'spacer' }), themeBox, h('div', { class: 'grow' }), h('div', { class: 'spacer' }),
    h('button', { class: 'btn primary block', onclick: () => {
      if (S?.party?.length && !confirmReplace()) return;
      const keep = S?.party?.length ? S.party : [];
      S = newState(st.mode);
      S.theme = st.custom.trim() || st.theme;
      S.party = keep.map(freshHero);
      save();
      go('party');
    } }, 'Дальше: герои'),
  );
};

function confirmReplace() {
  // Старых героев не выбрасываем: они переходят в новую игру, сюжет начинается заново
  toast('Герои из прошлой игры перешли в новую. Лишних можно убрать.');
  return true;
}

function freshHero(h0) {
  const hero = { ...h0 };
  hero.maxHp = maxHp(hero);
  hero.hp = hero.maxHp;
  hero.slots = spellSlots(hero.cls, hero.level);
  hero.potions = Math.max(hero.potions ?? 0, 2);
  return hero;
}

// ---------- отряд ----------

screens.party = () => {
  const list = h('div', { class: 'stack' });
  for (const hero of S.party) {
    list.append(h('button', { class: 'card hero-row', onclick: () => go('hero', hero.id) },
      heroArt(hero, { note: false }),
      h('div', {},
        h('h3', {}, hero.name),
        h('div', { class: 'muted small' }, `${RACES[hero.race].name}, ${CLASSES[hero.cls].name.toLowerCase()}, ${hero.level} ур.`),
        hero.playerName ? h('div', { class: 'small' }, 'Игрок: ' + hero.playerName) : null,
        h('div', { class: 'badges' }, h('span', { class: 'badge hp' }, `♥ ${hero.hp ?? maxHp(hero)}/${maxHp(hero)}`), h('span', { class: 'badge ac' }, `⛨ ${heroAC(hero)}`)),
      )));
  }
  const need = S.mode === 'arena' ? 2 : 1;
  const empty = !S.party.length ? h('p', { class: 'muted' }, S.mode === 'arena'
    ? 'Для арены нужно минимум два героя. Каждый игрок создаёт своего.'
    : 'Каждый игрок создаёт своего героя. Можно одного на всех, можно до шести.') : null;
  mount(
    h('div', { class: 'topbar' }, back('home'), h('h2', {}, 'Герои'), h('span', { class: 'badge' }, modeName[S.mode])),
    empty, list, h('div', { class: 'spacer' }),
    S.party.length < 6 ? h('button', { class: 'btn block', onclick: () => go('hero', null) }, 'Создать героя') : null,
    S.party.length < 6 ? h('button', { class: 'btn ghost block', style: { marginTop: '8px' }, onclick: () => {
      const hero = freshHero(randomHero());
      S.party.push(hero); save(); go('party');
    } }, 'Случайный герой за секунду') : null,
    h('div', { class: 'grow' }), h('div', { class: 'spacer' }),
    h('button', { class: 'btn primary block', disabled: S.party.length < need || null, onclick: startGame },
      S.mode === 'arena' ? 'На арену' : S.started ? 'Вернуться в историю' : 'Начать приключение'),
  );
};

// ---------- редактор героя ----------

screens.hero = (id) => {
  const existing = S.party.find((x) => x.id === id);
  const d = existing ? structuredClone(existing) : makeHero({ race: 'human', cls: 'fighter' });
  let swapFrom = null;

  const root = h('div', { class: 'stack' });
  mount(h('div', { class: 'topbar' }, back('party'), h('h2', {}, existing ? 'Герой' : 'Новый герой')), root);

  const draw = () => {
    root.innerHTML = '';
    const s = finalStats(d.base, d.race);
    const c = CLASSES[d.cls];

    // Игрок
    const player = h('input', { type: 'text', placeholder: 'Как зовут игрока', value: d.playerName || '' });
    player.oninput = () => (d.playerName = player.value);
    root.append(h('label', { class: 'field' }, 'Игрок', player));

    // Придумать словами
    const idea = h('textarea', { placeholder: 'Опиши героя словами, например: «гном-повар, который боится темноты и мечтает о славе»' });
    const ideaBtn = h('button', { class: 'btn block' }, 'Создать героя по описанию');
    ideaBtn.onclick = async () => {
      ideaBtn.disabled = true;
      ideaBtn.textContent = 'Нейросеть придумывает…';
      try {
        const r = await heroFromIdea(idea.value.trim(), (sec) => {
          ideaBtn.textContent = sec > 0 ? `Нейросеть занята, ещё ${sec} с…` : 'Нейросеть придумывает…';
        });
        d.race = r.race; d.cls = r.cls;
        d.name = r.name || d.name; d.look = r.look || d.look; d.trait = r.trait || d.trait; d.past = r.past || d.past;
        if (r.portrait_en) d.lookEn = r.portrait_en;
        setPortraitEn(d);
        d.base = assignByClass(Object.values(d.base), d.cls);
        d.seed = rnd(1e6);
        d.customArt = true;
        toast('Готово. Портрет дорисуется сам, остальное можно поправить ниже.');
      } catch (e) {
        toast('Нейросеть не ответила. Собери героя вручную ниже.');
      }
      draw();
    };
    root.append(h('div', { class: 'card stack' }, h('h3', {}, 'Придумать словами'), idea, ideaBtn));

    // Портрет и имя
    const name = h('input', { type: 'text', value: d.name });
    name.oninput = () => (d.name = name.value);
    root.append(h('div', { class: 'card hero-row' },
      heroArt(d),
      h('div', { class: 'stack', style: { gap: '6px' } },
        h('label', { class: 'field' }, 'Имя героя', name),
        h('button', { class: 'btn sm ghost', onclick: () => {
          d.customArt = true; d.seed = rnd(1e6); setPortraitEn(d);
          toast('Портрет в очереди художника. Бесплатно рисуется одна картинка за 45 секунд.');
          draw();
        } }, d.customArt ? 'Нарисовать другой' : 'Нарисовать уникальный'),
        d.customArt ? h('button', { class: 'btn sm ghost', onclick: () => { d.customArt = false; draw(); } }, 'Обычный портрет') : null,
      )));

    // Раса
    const races = h('div', { class: 'chips' });
    for (const [k, r] of Object.entries(RACES)) races.append(h('button', { class: 'chip' + (d.race === k ? ' on' : ''), onclick: () => { d.race = k; setPortraitEn(d); draw(); } }, r.name));
    root.append(h('h3', {}, 'Раса'), races, h('p', { class: 'small muted' }, RACES[d.race].trait));

    // Класс
    const classes = h('div', { class: 'chips' });
    for (const [k, cl] of Object.entries(CLASSES)) classes.append(h('button', { class: 'chip' + (d.cls === k ? ' on' : ''), onclick: () => { d.cls = k; d.base = assignByClass(Object.values(d.base), k); setPortraitEn(d); draw(); } }, cl.name));
    root.append(h('h3', {}, 'Класс'), classes, h('p', { class: 'small muted' }, c.desc));

    // Характеристики
    const grid = h('div', { class: 'statgrid' });
    for (const k of STATS) {
      const box = h('button', { class: 'stat', style: swapFrom === k ? { borderColor: 'var(--gilt-hi)' } : null, title: STAT_HINT[k] },
        h('div', { class: 'k' }, STAT_NAMES[k]), h('div', { class: 'v' }, s[k]), h('div', { class: 'm' }, fmtMod(mod(s[k]))));
      box.onclick = () => {
        if (!swapFrom) { swapFrom = k; draw(); return; }
        if (swapFrom !== k) { const t = d.base[swapFrom]; d.base[swapFrom] = d.base[k]; d.base[k] = t; }
        swapFrom = null; draw();
      };
      grid.append(box);
    }
    root.append(
      h('h3', {}, 'Характеристики'),
      h('p', { class: 'small muted' }, 'Нажми на две характеристики, чтобы поменять их местами. Бонус расы уже прибавлен.'),
      grid,
      h('div', { class: 'row' },
        h('button', { class: 'btn sm grow', onclick: async () => {
          const vals = rollStatsArray();
          d.base = assignByClass(vals, d.cls);
          toast('Выпало: ' + vals.join(', '));
          draw();
        } }, 'Бросить 4к6'),
        h('button', { class: 'btn sm ghost grow', onclick: () => { d.base = assignByClass(STANDARD_ARRAY, d.cls); draw(); } }, 'Ровный набор')),
    );

    // Итог по герою
    const preview = { ...d, level: d.level || 1 };
    root.append(h('div', { class: 'badges' },
      h('span', { class: 'badge hp' }, `Здоровье ${maxHp(preview)}`),
      h('span', { class: 'badge ac' }, `Доспех ${heroAC(preview)} (${c.armor.toLowerCase()})`),
      h('span', { class: 'badge' }, `${c.weapon.name} ${c.weapon.dice}${fmtMod(mod(s[c.weapon.stat]))}`)));
    root.append(h('h3', {}, 'Умения'));
    if (c.passive) root.append(h('div', { class: 'ability' }, h('b', {}, 'Всегда: '), c.passive));
    for (const a of c.abilities) root.append(h('div', { class: 'ability' }, h('b', {}, a.name + '. '), a.text));

    // Описание
    const look = h('input', { type: 'text', value: d.look || '' }); look.oninput = () => (d.look = look.value);
    const trait = h('input', { type: 'text', value: d.trait || '' }); trait.oninput = () => (d.trait = trait.value);
    const past = h('textarea', {}); past.value = d.past || ''; past.oninput = () => (d.past = past.value);
    root.append(h('h3', {}, 'Кто он'),
      h('label', { class: 'field' }, 'Внешность', look),
      h('label', { class: 'field' }, 'Характер', trait),
      h('label', { class: 'field' }, 'Прошлое', past));

    root.append(...[h('div', { class: 'spacer' }),
      h('button', { class: 'btn primary block', onclick: () => {
        if (!d.name.trim()) return toast('Дай герою имя');
        const hero = existing ? { ...d, maxHp: maxHp(d), hp: Math.min(existing.hp ?? 999, maxHp(d)) } : freshHero(d);
        if (!existing) hero.hp = hero.maxHp;
        if (existing) S.party[S.party.indexOf(existing)] = hero; else S.party.push(hero);
        save(); go('party');
      } }, 'Сохранить героя'),
      existing ? h('button', { class: 'btn danger block', onclick: () => {
        S.party = S.party.filter((x) => x !== existing); save(); go('party');
      } }, 'Убрать из отряда') : null].filter(Boolean));
  };
  draw();
};

function setPortraitEn(d) {
  d.portraitEn = `${RACES[d.race].en} ${CLASSES[d.cls].en}, ${d.lookEn || 'heroic pose'}`;
}

// ---------- старт ----------

async function startGame() {
  if (S.mode === 'arena') return arenaSetup();
  if (S.started) return go('story');
  S.started = true;
  S.quest = randomQuest();
  S.place = S.quest.place;
  S.activeHeroId = S.party[0].id;
  S.log = [];
  save();
  go('story');
  if (S.mode === 'ai') {
    await askGm(null, { intro: true });
  } else {
    addLog('sys', `Ведущий, подсказка для начала: ${S.quest.giver.toLowerCase()} ${S.quest.goal}. Место: «${S.quest.place.name}». Награда ${S.quest.reward} золотых.`);
    redrawLog();
  }
}

// ---------- журнал ----------

function addLog(who, text, extra = {}) {
  S.log.push({ who, text, ...extra, t: Date.now() });
  if (S.log.length > 200) S.log = S.log.slice(-200);
  save();
}

let logEl = null, dockEl = null, bannerEl = null, stripEl = null;

screens.story = () => {
  bannerEl = h('div', { class: 'scene-banner' });
  stripEl = h('div', { class: 'party-strip' });
  logEl = h('div', { class: 'log' });
  dockEl = h('div', { class: 'dock' });
  mount(bannerEl, stripEl, logEl, dockEl);
  bannerKey = '';
  drawBanner(); drawStrip(); redrawLog(); drawDock();
};

let bannerKey = '';
function drawBanner() {
  if (!bannerEl) return;
  const key = JSON.stringify([S.place?.name, S.place?.seed]);
  if (key === bannerKey) return;
  bannerKey = key;
  bannerEl.innerHTML = '';
  bannerEl.append(placeImg(S.place, 'scene-art'), h('div', { class: 'cap' }, S.place?.name || ''),
    h('div', { class: 'tools' },
      h('button', { class: 'icon-btn', 'aria-label': 'Меню', onclick: storyMenu }, '☰')));
}

function drawStrip() {
  if (!stripEl) return;
  stripEl.innerHTML = '';
  for (const hero of S.party) {
    const pct = Math.round((Math.max(0, hero.hp) / hero.maxHp) * 100);
    stripEl.append(h('button', { class: 'pchip' + (S.mode === 'ai' && hero.id === S.activeHeroId ? ' on' : ''), onclick: () => heroSheet(hero) },
      heroArt(hero, { cls: 'ava portrait', note: false }),
      h('span', {}, hero.name.split(' ')[0], h('span', { class: 'hpmini' }, h('i', { style: { width: pct + '%' } })))));
  }
}

function redrawLog() {
  if (!logEl) return;
  logEl.innerHTML = '';
  for (const e of S.log.slice(-60)) logEl.append(entryEl(e));
  requestAnimationFrame(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));
}

function entryEl(e) {
  if (e.who === 'player') return h('div', { class: 'entry player' }, h('span', { class: 'who' }, e.name || ''), e.text);
  if (e.who === 'roll') return h('div', { class: 'entry roll ' + (e.ok ? 'ok' : 'bad') }, e.text, ' ', h('span', { class: 'num' }, e.total), ' ', e.ok ? 'успех' : 'провал');
  return h('div', { class: 'entry ' + e.who }, e.text);
}

function heroSheet(hero) {
  const s = finalStats(hero.base, hero.race);
  const c = CLASSES[hero.cls];
  const need = [0, 300, 900, 2700, 6500][hero.level] ?? null;
  sheet((close) => h('div', { class: 'stack' },
    h('div', { class: 'hero-row' }, heroArt(hero), h('div', {},
      h('h2', {}, hero.name),
      h('p', { class: 'muted' }, `${RACES[hero.race].name}, ${c.name.toLowerCase()}, ${hero.level} уровень`),
      h('div', { class: 'badges' }, h('span', { class: 'badge hp' }, `♥ ${hero.hp}/${hero.maxHp}`), h('span', { class: 'badge ac' }, `⛨ ${heroAC(hero)}`),
        h('span', { class: 'badge' }, `опыт ${hero.xp}${need ? ' из ' + need : ''}`), h('span', { class: 'badge' }, `зелий ${hero.potions}`)))),
    h('div', { class: 'statgrid' }, STATS.map((k) => h('div', { class: 'stat' }, h('div', { class: 'k' }, STAT_NAMES[k]), h('div', { class: 'v' }, s[k]), h('div', { class: 'm' }, fmtMod(mod(s[k])))))),
    h('p', {}, h('b', {}, 'Внешность: '), hero.look),
    h('p', {}, h('b', {}, 'Характер: '), hero.trait),
    h('p', {}, h('b', {}, 'Прошлое: '), hero.past),
    h('p', { class: 'small muted' }, RACES[hero.race].trait),
    c.passive ? h('div', { class: 'ability' }, c.passive) : null,
    ...c.abilities.map((a) => h('div', { class: 'ability' }, h('b', {}, a.name + '. '), a.text)),
    c.caster ? h('p', { class: 'small' }, `Ячеек магии: ${hero.slots} из ${spellSlots(hero.cls, hero.level)}`) : null,
    h('button', { class: 'btn ghost block', onclick: close }, 'Закрыть'),
  ));
}

function storyMenu() {
  sheet((close) => h('div', { class: 'stack' },
    h('h2', {}, 'Меню'),
    h('p', { class: 'muted small' }, `Задание: ${S.quest.giver.toLowerCase()} ${S.quest.goal}. Награда ${S.quest.reward} золотых. Золото отряда: ${S.gold}.`),
    h('button', { class: 'btn block', onclick: () => { close(); rest(); } }, 'Отдохнуть у костра'),
    h('button', { class: 'btn block', onclick: () => { close(); go('party'); } }, 'Герои отряда'),
    h('button', { class: 'btn ghost block', onclick: () => { close(); go('rules'); } }, 'Как играть'),
    h('button', { class: 'btn ghost block', onclick: () => { close(); go('settings'); } }, 'Настройки'),
    h('button', { class: 'btn ghost block', onclick: () => { close(); go('home'); } }, 'Главное меню'),
  ));
}

function rest() {
  for (const hero of S.party) {
    hero.hp = hero.maxHp;
    hero.slots = spellSlots(hero.cls, hero.level);
  }
  addLog('sys', 'Отряд отдыхает у костра. Здоровье и магия восстановлены.');
  note('Герои разбили лагерь и отдохнули ночь, наступило утро.');
  save(); drawStrip(); redrawLog();
}

// Заметки для ведущего-ИИ: уходят вместе со следующим ходом игроков,
// чтобы не тратить лишний запрос (бесплатно 1 ответ в 30 секунд)
function note(text) {
  S.notes = [...(S.notes || []), text].slice(-6);
}

// ---------- нижняя панель ----------

function activeHero() {
  return S.party.find((x) => x.id === S.activeHeroId) || S.party[0];
}

function drawDock() {
  if (!dockEl) return;
  dockEl.innerHTML = '';
  if (S.mode === 'human') return drawGmDock();
  if (thinking) return dockEl.append(thinkingEl);
  const p = S.pending;
  if (p?.type === 'check') {
    const hero = S.party.find((x) => x.id === p.heroId) || activeHero();
    dockEl.append(h('div', { class: 'callout' },
      h('p', {}, h('b', {}, hero.name), `, проверка: ${STAT_NAMES[p.stat]}, сложность ${p.dc}.`, p.why ? h('span', { class: 'muted' }, ' ' + p.why) : null),
      h('button', { class: 'btn primary block', onclick: () => doCheck(hero, p.stat, p.dc, p.why) }, 'Бросить кубик')));
    return;
  }
  if (p?.type === 'combat') {
    dockEl.append(h('div', { class: 'callout fight' },
      h('p', {}, h('b', {}, 'Бой! '), p.enemies.map((e) => e.name).join(', ')),
      h('button', { class: 'btn primary block', onclick: () => fight(p.enemies) }, 'В бой')));
    return;
  }
  const hero = activeHero();
  const ta = h('textarea', { rows: 1, placeholder: `Что делает ${hero.name.split(' ')[0]}?` });
  const send = h('button', { class: 'send', 'aria-label': 'Отправить' }, '➤');
  const submit = () => {
    const text = ta.value.trim();
    if (!text) return;
    askGm(text, { hero });
  };
  send.onclick = submit;
  ta.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } };
  const row = h('div', { class: 'composer' }, ta);
  if (canListen) {
    const mic = h('button', { class: 'icon-btn mic', 'aria-label': 'Сказать голосом' }, '🎙');
    let rec = null;
    mic.onclick = () => {
      if (rec) { rec.stop(); return; }
      mic.classList.add('on');
      rec = listen((t) => (ta.value = t), () => { mic.classList.remove('on'); rec = null; });
    };
    row.append(mic);
  }
  row.append(send);

  if (S.party.length > 1) {
    const who = h('div', { class: 'chips scroll' }, h('span', { class: 'small muted', style: { alignSelf: 'center', flex: 'none' } }, 'Ходит:'));
    for (const x of S.party) who.append(h('button', { class: 'chip' + (x.id === hero.id ? ' on' : ''), onclick: () => { S.activeHeroId = x.id; save(); drawStrip(); drawDock(); } }, x.name.split(' ')[0]));
    dockEl.append(who);
  }
  if (S.options?.length) {
    const opts = h('div', { class: 'chips scroll' });
    for (const o of S.options.slice(0, 3)) opts.append(h('button', { class: 'chip', onclick: () => askGm(o, { hero }) }, o));
    dockEl.append(opts);
  }
  dockEl.append(row);
}

// ---------- ведущий-ИИ ----------

let thinking = false;
const thinkingEl = h('div', { class: 'thinking' }, h('i'), h('i'), h('i'), h('span', {}, ' ведущий думает'));

async function askGm(text, { hero, intro = false } = {}) {
  if (thinking) return;
  thinking = true;
  if (text) addLog('player', text, { name: hero?.name.split(' ')[0] || '' });
  redrawLog();
  drawDock();
  const label = thinkingEl.querySelector('span');
  const onWait = (sec) => { label.textContent = sec > 0 ? ` ведущий ответит через ${sec} с` : ' ведущий думает'; };
  const notes = (S.notes || []).map((n) => `[${n}]`).join(' ');
  const msg = intro ? null : `${notes} ${hero.name} (id ${hero.id}): ${text}`.trim();
  try {
    const r = intro ? await gmIntro(S, onWait) : await gmTurn(S, msg, onWait);
    S.notes = [];
    applyGm(r);
  } catch (e) {
    offlineTurn(text, hero, intro);
  }
  thinking = false;
  save();
  drawBanner(); drawStrip(); redrawLog(); drawDock();
}

function applyGm(r) {
  if (r.narration) { addLog('gm', r.narration); speak(r.narration); }
  if (r.scene?.name) {
    S.place = { name: r.scene.name, desc: r.scene.desc || '', en: r.scene.en || 'fantasy landscape', kind: placeKind(`${r.scene.name} ${r.scene.desc}`), seed: rnd(1e6), custom: true };
  }
  if (r.xp > 0) giveXp(Math.min(200, r.xp));
  S.options = Array.isArray(r.options) ? r.options.filter((x) => typeof x === 'string').slice(0, 3) : [];
  if (r.next_hero_id && S.party.some((x) => x.id === r.next_hero_id)) S.activeHeroId = r.next_hero_id;
  else rotateHero();
  S.pending = null;
  if (r.check && STATS.includes(r.check.stat)) {
    S.pending = {
      type: 'check',
      heroId: S.party.some((x) => x.id === r.check.hero_id) ? r.check.hero_id : S.activeHeroId,
      stat: r.check.stat,
      dc: Math.max(5, Math.min(25, parseInt(r.check.dc, 10) || 15)),
      why: r.check.why || '',
      success: r.check.success || '',
      fail: r.check.fail || '',
      fightOnFail: !!r.check.fight_on_fail,
    };
  } else if (r.combat?.enemies?.length) {
    const lvl = Math.round(S.party.reduce((a, x) => a + x.level, 0) / S.party.length);
    const enemies = r.combat.enemies.slice(0, 5).map((e) => ({ ...sanitizeEnemy(e, lvl), seed: rnd(1e6) }));
    const total = {}, seen = {};
    enemies.forEach((e) => (total[e.name] = (total[e.name] || 0) + 1));
    enemies.forEach((e) => { if (total[e.name] > 1) { seen[e.name] = (seen[e.name] || 0) + 1; e.name = `${e.name} ${seen[e.name]}`; } });
    S.pending = { type: 'combat', enemies };
  }
}

function rotateHero() {
  const i = S.party.findIndex((x) => x.id === S.activeHeroId);
  S.activeHeroId = S.party[(i + 1) % S.party.length].id;
}

function localEncounter() {
  return buildEncounter(S.party, S.place?.kind || placeKind(S.place?.name)).map((m) => ({ ...m, seed: rnd(1e6) }));
}

// Если нейросеть не ответила, ход играется по таблицам
function offlineTurn(text, hero, intro) {
  if (!S.log.slice(-10).some((e) => e.offline)) {
    addLog('sys', 'Ведущий-ИИ сейчас не на связи. Пока играю по встроенным таблицам.', { offline: true });
  }
  if (intro) {
    const t = offlineIntro(S);
    addLog('gm', t); speak(t);
    S.activeHeroId = S.party[0].id;
    return;
  }
  if (text && hero) {
    const stat = guessStat(text);
    S.pending = { type: 'check', heroId: hero.id, stat, dc: pick([10, 15, 15]), why: '', success: '', fail: '', fightOnFail: Math.random() < 0.35 };
  }
}

async function doCheck(hero, stat, dc, why) {
  const p = S.pending || {};
  const s = finalStats(hero.base, hero.race);
  const c = CLASSES[hero.cls];
  const bonus = mod(s[stat]) + (c.primary === stat || c.save.includes(stat) ? prof(hero.level) : 0);
  const adv = hero.race === 'elf' && stat === 'wis' ? 1 : 0;
  const r = await diceOverlay({
    title: hero.name,
    sub: `${STAT_NAMES[stat]}${why ? ': ' + why : ''}`,
    bonus, target: dc,
    roll: () => {
      let d = rollD20(adv);
      if (hero.race === 'halfling' && d.natural === 1) { const re = rnd(20); d = { natural: re, rolls: [...d.rolls, re] }; }
      const total = d.natural + bonus;
      return { ...d, bonus, total, ok: d.natural === 20 || (d.natural !== 1 && total >= dc) };
    },
  });
  S.pending = null;
  addLog('roll', `${hero.name.split(' ')[0]}, ${STAT_NAMES[stat].toLowerCase()}:`, { total: r.total, ok: r.ok });
  const verdict = r.natural === 20 ? 'критический успех' : r.natural === 1 ? 'критический провал' : r.ok ? 'успех' : 'провал';
  if (S.mode === 'ai') {
    const out = (r.ok ? p.success : p.fail) || offlineOutcome(r.ok);
    addLog('gm', out); speak(out);
    note(`Проверка: ${hero.name}, ${STAT_NAMES[stat]}${why ? ' (' + why + ')' : ''}, ${verdict}. Ведущий сказал: ${out}`);
    if (!r.ok && p.fightOnFail) {
      const enemies = localEncounter();
      addLog('gm', `На вас нападают: ${enemies.map((e) => e.name).join(', ')}!`);
      S.pending = { type: 'combat', enemies };
    } else if (r.ok) {
      giveXp(25);
    }
  }
  save(); drawStrip(); redrawLog(); drawDock();
}

// ---------- бой ----------

function fight(enemies, place = S.place) {
  app.innerHTML = '';
  stopSpeak();
  logEl = dockEl = bannerEl = stripEl = null;
  runCombat(app, {
    party: S.party, enemies, place, arena: false,
    onEnd: ({ winner, xp }) => {
      S.pending = null;
      const won = winner === 'A';
      for (const hero of S.party) if (hero.hp <= 0) hero.hp = 1;
      const names = enemies.map((e) => e.name).join(', ');
      if (won) {
        const share = Math.floor(xp / S.party.length);
        const loot = rnd(6) * 5 * enemies.length;
        S.gold += loot;
        addLog('sys', `Победа над: ${names}. Каждый герой получает ${share} опыта. Найдено ${loot} золотых, в казне ${S.gold}.`);
        giveXp(share);
      } else {
        addLog('sys', 'Отряд проиграл бой. Герои очнулись позже, едва живые.');
      }
      const status = S.party.map((x) => `${x.name} ${x.hp}/${x.maxHp}`).join(', ');
      note(`Бой окончен: ${won ? 'герои победили' : 'герои проиграли, враги их не убили, они очнулись позже'} (${names}). Здоровье: ${status}`);
      S.options = won ? ['Обыскать поверженных', 'Перевязать раны', 'Идти дальше'] : ['Осмотреться', 'Перевязать раны', 'Искать, куда делись враги'];
      save();
      go('story');
    },
  });
}

function giveXp(each) {
  for (const hero of S.party) {
    const before = hero.level;
    hero.xp = (hero.xp || 0) + each;
    hero.level = levelFromXp(hero.xp);
    if (hero.level > before) {
      const oldMax = hero.maxHp;
      hero.maxHp = maxHp(hero);
      hero.hp += hero.maxHp - oldMax;
      hero.slots = spellSlots(hero.cls, hero.level);
      addLog('sys', `${hero.name} достигает ${hero.level} уровня! Здоровье до ${hero.maxHp}.`);
      toast(`${hero.name.split(' ')[0]}: новый уровень!`);
    }
  }
}

// ---------- ведущий-человек ----------

function drawGmDock() {
  const tools = h('div', { class: 'gm-tools' },
    h('button', { class: 'btn sm', onclick: checkSheet }, 'Проверка'),
    h('button', { class: 'btn sm', onclick: battleSheet }, 'Бой'),
    h('button', { class: 'btn sm', onclick: placeSheet }, 'Место'),
    h('button', { class: 'btn sm ghost', onclick: () => ideaSheet('npc') }, 'Встречный'),
    h('button', { class: 'btn sm ghost', onclick: () => ideaSheet('twist') }, 'Поворот'),
    h('button', { class: 'btn sm ghost', onclick: () => ideaSheet('riddle') }, 'Загадка'),
  );
  const ta = h('textarea', { rows: 1, placeholder: 'Что видят герои…' });
  const send = h('button', { class: 'send', 'aria-label': 'Записать' }, '➤');
  send.onclick = () => {
    const t = ta.value.trim();
    if (!t) return;
    addLog('gm', t); speak(t); redrawLog(); ta.value = '';
  };
  const row = h('div', { class: 'composer' }, ta);
  if (canListen) {
    const mic = h('button', { class: 'icon-btn mic', 'aria-label': 'Надиктовать' }, '🎙');
    let rec = null;
    mic.onclick = () => {
      if (rec) { rec.stop(); return; }
      mic.classList.add('on');
      rec = listen((t) => (ta.value = t), () => { mic.classList.remove('on'); rec = null; });
    };
    row.append(mic);
  }
  row.append(send);
  dockEl.append(tools, row);
}

function checkSheet() {
  const st = { hero: S.party[0].id, stat: 'str', dc: 15 };
  sheet((close) => {
    const box = h('div', { class: 'stack' });
    const draw = () => {
      box.innerHTML = '';
      const heroes = h('div', { class: 'chips' }, S.party.map((x) => h('button', { class: 'chip' + (st.hero === x.id ? ' on' : ''), onclick: () => { st.hero = x.id; draw(); } }, x.name.split(' ')[0])));
      const stats = h('div', { class: 'chips' }, STATS.map((k) => h('button', { class: 'chip' + (st.stat === k ? ' on' : ''), onclick: () => { st.stat = k; draw(); } }, STAT_NAMES[k])));
      const dcs = h('div', { class: 'chips' }, DC_LEVELS.map((d) => h('button', { class: 'chip' + (st.dc === d.dc ? ' on' : ''), onclick: () => { st.dc = d.dc; draw(); } }, `${d.name} (${d.dc})`)));
      box.append(h('h2', {}, 'Проверка'), h('h3', {}, 'Кто'), heroes, h('h3', {}, 'Что проверяем'), stats,
        h('p', { class: 'small muted' }, STAT_HINT[st.stat]), h('h3', {}, 'Сложность'), dcs,
        h('button', { class: 'btn primary block', onclick: () => { close(); doCheck(S.party.find((x) => x.id === st.hero), st.stat, st.dc, ''); } }, 'Бросить кубик'));
    };
    draw();
    return box;
  });
}

function battleSheet() {
  const counts = {};
  sheet((close) => {
    const box = h('div', { class: 'stack' });
    const draw = () => {
      box.innerHTML = '';
      box.append(h('h2', {}, 'Бой'),
        h('button', { class: 'btn block', onclick: () => { close(); const en = buildEncounter(S.party, S.place?.kind || '').map((m) => ({ ...m, seed: rnd(1e6) })); addLog('gm', `Появляются враги: ${en.map((e) => e.name).join(', ')}.`); fight(en); } }, 'Подобрать врагов под отряд'),
        h('h3', {}, 'Или выбери сам'));
      for (const m of MONSTERS) {
        const n = counts[m.key] || 0;
        box.append(h('div', { class: 'counter' },
          h('div', {}, h('b', {}, m.name), h('div', { class: 'small muted' }, `♥ ${m.hp}, ⛨ ${m.ac}, ${m.weapon} ${m.dmg}`)),
          h('div', { class: 'ctl' },
            h('button', { class: 'icon-btn', onclick: () => { counts[m.key] = Math.max(0, n - 1); draw(); } }, '−'),
            h('b', {}, n),
            h('button', { class: 'icon-btn', onclick: () => { counts[m.key] = Math.min(6, n + 1); draw(); } }, '+'))));
      }
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      box.append(h('button', { class: 'btn primary block', disabled: !total || null, onclick: () => {
        const en = [];
        for (const m of MONSTERS) for (let i = 0; i < (counts[m.key] || 0); i++) en.push({ ...m, name: (counts[m.key] > 1 ? `${m.name} ${i + 1}` : m.name), seed: rnd(1e6) });
        close(); addLog('gm', `Появляются враги: ${en.map((e) => e.name).join(', ')}.`); fight(en);
      } }, `В бой (${total})`));
    };
    draw();
    return box;
  });
}

function placeSheet() {
  sheet((close) => {
    const box = h('div', { class: 'stack' });
    const kinds = ['лес', 'пещера', 'руины', 'склеп', 'болото', 'горы', 'город', 'деревня', 'дорога', 'степь'];
    const apply = (p) => {
      S.place = p; addLog('gm', `${p.name}. ${p.desc}`); speak(`${p.name}. ${p.desc}`);
      save(); close(); drawBanner(); redrawLog();
    };
    const ai = h('button', { class: 'btn block' }, 'Придумать с нейросетью');
    ai.onclick = async () => {
      ai.disabled = true; ai.textContent = 'Придумываю…';
      try {
        const r = await gmIdea('place', S, (sec) => { ai.textContent = sec > 0 ? `Нейросеть занята, ещё ${sec} с…` : 'Придумываю…'; });
        apply({ name: r.name, desc: r.desc, en: r.en || 'fantasy landscape', kind: placeKind(`${r.name} ${r.desc}`), seed: rnd(1e6), custom: true });
      } catch { ai.textContent = 'Нейросеть не ответила, выбери из списка'; }
    };
    box.append(h('h2', {}, 'Новое место'), ai, h('h3', {}, 'Или случайное'),
      h('div', { class: 'chips' }, kinds.map((k) => h('button', { class: 'chip', onclick: () => apply(randomPlace(k)) }, k))));
    return box;
  });
}

const TWISTS = [
  'Тот, кто дал задание, сам всё это и устроил.',
  'Враги на самом деле бегут от кого-то пострашнее.',
  'Сокровище оказалось живым и разговаривает.',
  'Одного из героев узнают как давно пропавшего наследника.',
  'Мост позади рушится: назад пути нет.',
];
const RIDDLES = [
  ['Без рук, без ног, а ворота отворяет.', 'ветер'],
  ['Чем больше из неё берёшь, тем больше она становится.', 'яма'],
  ['Не лает, не кусает, а в дом не пускает.', 'замок'],
  ['Всё видит, а глаз нет.', 'зеркало… или совесть'],
];

function ideaSheet(kind) {
  sheet((close) => {
    const wait = h('span', {}, ' придумываю');
    const box = h('div', { class: 'stack' }, h('div', { class: 'thinking' }, h('i'), h('i'), h('i'), wait));
    const onWait = (sec) => { wait.textContent = sec > 0 ? ` нейросеть занята, ещё ${sec} с` : ' придумываю'; };
    const show = (title, body, logText, url) => {
      box.innerHTML = '';
      if (url) box.append(h('div', { style: { width: '140px' } }, art({ ai: url, glyph: title[0] })));
      box.append(h('h2', {}, title), ...body.map((b) => h('p', {}, b)),
        h('button', { class: 'btn primary block', onclick: () => { addLog('gm', logText); speak(logText); redrawLog(); close(); } }, 'Записать в журнал'),
        h('button', { class: 'btn ghost block', onclick: () => { close(); ideaSheet(kind); } }, 'Другой вариант'));
    };
    (async () => {
      try {
        const r = await gmIdea(kind, S, onWait);
        if (kind === 'npc') show(r.name, [`${r.role}, ${r.mood}.`, `«${r.speech}»`, `Тайна (только для ведущего): ${r.secret}`], `Перед вами ${r.name}, ${r.role}. «${r.speech}»`, imageUrl(`portrait of ${r.en}`, rnd(1e6), 384, 480));
        else if (kind === 'twist') show('Поворот', [r.text], r.text);
        else show('Загадка', [r.text, `Ответ: ${r.answer}`], `Страж говорит: «${r.text}»`);
      } catch {
        if (kind === 'npc') { const n = randomNpc(); show(n.name, [`${n.race}, ${n.role}, ${n.mood}.`, `Тайна (только для ведущего): ${n.secret}`], `Перед вами ${n.name}, ${n.role}.`, imageUrl(`portrait of ${n.en}`, n.seed, 384, 480)); }
        else if (kind === 'twist') { const t = pick(TWISTS); show('Поворот', [t], t); }
        else { const [q, a] = pick(RIDDLES); show('Загадка', [q, `Ответ: ${a}`], `Страж говорит: «${q}»`); }
      }
    })();
    return box;
  });
}

// ---------- арена ----------

function arenaSetup() {
  const sides = {};
  S.party.forEach((x, i) => (sides[x.id] = i % 2 ? 'B' : 'A'));
  let arena = ARENAS[0];
  sheet((close) => {
    const box = h('div', { class: 'stack' });
    const draw = () => {
      box.innerHTML = '';
      box.append(h('h2', {}, 'Кто против кого'), h('p', { class: 'small muted' }, 'Нажми на героя, чтобы перевести его в другую команду.'));
      for (const x of S.party) {
        box.append(h('button', { class: 'counter', style: { width: '100%' }, onclick: () => { sides[x.id] = sides[x.id] === 'A' ? 'B' : 'A'; draw(); } },
          h('b', {}, x.name), h('span', { class: 'badge', style: { borderColor: sides[x.id] === 'A' ? 'var(--violet)' : 'var(--blood)' } }, sides[x.id] === 'A' ? 'синие' : 'красные')));
      }
      box.append(h('h3', {}, 'Где'), h('div', { class: 'chips' }, ARENAS.map((a) => h('button', { class: 'chip' + (arena === a ? ' on' : ''), onclick: () => { arena = a; draw(); } }, a.name))));
      const both = new Set(Object.values(sides)).size === 2;
      box.append(h('button', { class: 'btn primary block', disabled: !both || null, onclick: () => { close(); arenaFight(sides, { ...arena, seed: 7 }); } }, both ? 'В бой' : 'Нужны обе команды'));
    };
    draw();
    return box;
  });
}

function arenaFight(sides, place) {
  for (const x of S.party) { x.hp = x.maxHp; x.slots = spellSlots(x.cls, x.level); }
  S.started = true; save();
  app.innerHTML = '';
  runCombat(app, {
    party: S.party, enemies: [], sides, place, arena: true,
    onEnd: ({ winner, rematch }) => {
      for (const x of S.party) { x.hp = x.maxHp; x.slots = spellSlots(x.cls, x.level); }
      if (winner !== 'draw') {
        for (const x of S.party.filter((p) => sides[p.id] === winner)) x.wins = (x.wins || 0) + 1;
      }
      save();
      if (rematch) arenaFight(sides, place); else go('party');
    },
  });
}

// ---------- правила ----------

screens.rules = () => {
  const R = (title, ...body) => [h('h3', {}, title), ...body];
  mount(h('div', { class: 'topbar' }, back(S?.started && S.mode !== 'arena' ? 'story' : 'home'), h('h2', {}, 'Как играть')),
    h('div', { class: 'rules' },
      h('p', {}, 'Это ролевая игра в духе «Подземелий и драконов». Каждый игрок управляет своим героем, ведущий рассказывает историю. Вы говорите, что делает герой, а кубик решает, получилось ли.'),
      ...R('Герой', h('p', {}, 'У героя шесть характеристик: Сила, Ловкость, Телосложение, Интеллект, Мудрость, Харизма. Число 10 означает обычного человека. Каждые 2 очка сверху дают +1 к броску: 12 даёт +1, 14 даёт +2, 16 даёт +3.')),
      ...R('Проверка', h('p', {}, 'Когда исход неясен, ведущий называет характеристику и сложность. Бросаешь двадцатигранный кубик, прибавляешь бонус. Набрал сложность или больше, значит получилось.'),
        h('ul', {}, h('li', {}, '10: легко, получится почти у всех'), h('li', {}, '15: средне, нужно постараться'), h('li', {}, '20: трудно, нужен талант и удача')),
        h('p', {}, '20 на кубике всегда успех, 1 всегда провал.')),
      ...R('Бой', h('p', {}, 'Все бросают инициативу, ходят по очереди. Атака: кубик плюс бонус против доспеха цели (значок ⛨). Попал, значит бросаешь урон. Здоровье упало до нуля, значит выбыл из боя.'),
        h('p', {}, 'Преимущество: бросаешь два кубика и берёшь больший. Помеха: берёшь меньший.')),
      ...R('Умения', h('p', {}, 'У каждого класса свои приёмы. Заклинания тратят ячейки магии, они восстанавливаются отдыхом у костра. Зелье лечит 2к4+2.')),
      ...R('Опыт', h('p', {}, 'За победы и решённые задачи герои получают опыт. 300 опыта дают 2 уровень, 900 третий, 2700 четвёртый, 6500 пятый. С уровнем растёт здоровье и магия.')),
      ...R('Совет', h('p', {}, 'Описывайте действия смело и подробно: «прыгаю с балкона на люстру и бью орка сверху» лучше, чем «бью». Хорошему ведущему это нравится, и ИИ тоже.')),
      ...R('Источник', h('p', { class: 'small muted' }, 'Правила упрощены по мотивам System Reference Document 5.1 от Wizards of the Coast LLC, лицензия CC-BY-4.0. Картинки нарисованы нейросетью Pollinations.')),
    ));
};

// ---------- настройки ----------

screens.settings = () => {
  const box = h('div', { class: 'stack' });
  const toggle = (key, def, title, text) => {
    const on = settings.get(key, def);
    return h('button', { class: 'choice' + (on ? ' on' : ''), onclick: () => { settings.set(key, !on); go('settings'); } },
      h('b', {}, `${title}: ${on ? 'включено' : 'выключено'}`), h('span', { class: 'muted small' }, text));
  };
  const token = h('input', { type: 'password', placeholder: 'не обязательно', value: settings.get('token', '') });
  token.onchange = () => { settings.set('token', token.value.trim()); toast('Ключ сохранён на этом телефоне'); };
  box.append(
    toggle('tts', false, 'Голос ведущего', 'Телефон читает вслух рассказ ведущего и события боя.'),
    toggle('images', true, 'Уникальные картинки', 'Нейросеть дорисовывает портреты по описанию и новые места. Бесплатно одна картинка за 45 секунд. Без этого видны готовые картинки из игры.'),
    h('label', { class: 'field' }, 'Ключ Pollinations (для картинок без логотипа и быстрее)', token),
    h('p', { class: 'small muted' }, 'Без ключа всё работает бесплатно. Ключ хранится только на этом телефоне.'),
    h('div', { class: 'spacer' }),
    h('button', { class: 'btn danger block', onclick: () => {
      sheet((close) => h('div', { class: 'stack' },
        h('h2', {}, 'Стереть игру?'), h('p', {}, 'Пропадут герои и вся история на этом телефоне.'),
        h('button', { class: 'btn danger block', onclick: () => { localStorage.removeItem(SAVE_KEY); S = null; close(); go('home'); } }, 'Стереть'),
        h('button', { class: 'btn ghost block', onclick: close }, 'Оставить')));
    } }, 'Стереть сохранённую игру'),
  );
  mount(h('div', { class: 'topbar' }, back(S?.started && S.mode !== 'arena' ? 'story' : 'home'), h('h2', {}, 'Настройки')), box);
};

// ---------- запуск ----------

go('home');

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
