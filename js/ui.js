// Общие детали интерфейса: создание элементов, всплывашки, кубик на весь экран,
// картинки с запасной заставкой, озвучка ведущего и голосовой ввод.

import {
  settings, aiArtOn, queueImage, imageQueueInfo, libHero, libMonster, libPlace, portraitUrl, imageUrl, sceneUrl,
} from './ai.js';
import { fmtMod } from './rules.js';

export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid === null || kid === undefined || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let toastTimer;
export function toast(text, ms = 2600) {
  const t = document.getElementById('toast');
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), ms);
}

// Картинка с заставкой. lib: готовая картинка из приложения, видна сразу.
// ai: адрес уникальной картинки нейросети, встаёт поверх, когда художник дорисует.
// Пока ничего нет или не загрузилось, видна буква-руна.
export function art({ lib, ai, glyph, cls = 'portrait', note = true } = {}) {
  const wrap = h('div', { class: cls });
  wrap.append(h('span', { class: 'glyph' }, glyph || '?'));
  const show = (src) => {
    const img = h('img', { alt: '', decoding: 'async' });
    img.onload = () => {
      img.classList.add('ok');
      wrap.querySelectorAll('img.ok').forEach((o) => o !== img && setTimeout(() => o.remove(), 700));
    };
    img.onerror = () => img.remove();
    img.src = src;
    wrap.append(img);
  };
  if (lib) show(lib);
  if (ai && aiArtOn()) {
    const label = note ? h('span', { class: 'loading' }, 'художник рисует…') : null;
    if (label) wrap.append(label);
    const tick = label ? setInterval(() => {
      const q = imageQueueInfo();
      label.textContent = q.wait > 0 ? `художник рисует… ${q.wait} с` : 'художник рисует…';
    }, 1000) : null;
    queueImage(ai).then((src) => {
      clearInterval(tick);
      label?.remove();
      if (src) show(src);
    });
  }
  return wrap;
}

export const heroArt = (hero, opt = {}) => art({
  lib: libHero(hero), ai: hero.customArt ? portraitUrl(hero) : null, glyph: (hero.name || '?')[0], ...opt,
});

export const enemyArt = (e, opt = {}) => {
  const lib = libMonster(e);
  return art({ lib, ai: lib ? null : imageUrl(`portrait of ${e.en}, menacing creature`, e.seed || 1), glyph: (e.name || '?')[0], ...opt });
};

// Фон места: картинка из библиотеки, а для придуманного нейросетью места ещё и уникальная
export function placeImg(place, cls) {
  return art({ lib: libPlace(place), ai: place?.custom ? sceneUrl(place) : null, glyph: '', cls, note: false });
}

// ---------- кубик d20 ----------

export function d20Svg(size = 200) {
  // Плоский рисунок икосаэдра: шестиугольник, центральный треугольник и грани
  return `<svg viewBox="0 0 200 200" width="${size}" height="${size}" aria-hidden="true">
    <polygon class="face" points="100,8 180,54 180,146 100,192 20,146 20,54" fill="#d4ab52" stroke="#0f1226" stroke-width="5" stroke-linejoin="round"/>
    <polygon points="100,46 154,140 46,140" fill="#f0d48a" stroke="#0f1226" stroke-width="4" stroke-linejoin="round"/>
    <g stroke="#0f1226" stroke-width="4" fill="none" stroke-linejoin="round">
      <polyline points="100,8 100,46"/><polyline points="180,54 154,140"/><polyline points="20,54 46,140"/>
      <polyline points="20,54 100,46 180,54"/><polyline points="20,146 46,140 100,192 154,140 180,146"/>
    </g>
  </svg>`;
}

// Бросок на весь экран. Игрок сам нажимает на кубик.
// roll(): функция, которая делает бросок и возвращает {natural, rolls, bonus, total, target, ok, label}
export function diceOverlay({ title, sub, bonus = 0, target = null, roll, auto = false }) {
  return new Promise((resolve) => {
    const ov = document.getElementById('overlay');
    ov.innerHTML = '';
    const num = h('div', { class: 'die-num' }, '20');
    const wrap = h('div', { class: 'die-wrap', role: 'button', tabindex: '0', 'aria-label': 'Бросить кубик' });
    wrap.innerHTML = d20Svg();
    wrap.append(num);
    const verdict = h('div', { class: 'verdict' });
    const math = h('div', { class: 'math' }, target !== null ? `Нужно ${target} или больше. Бонус ${fmtMod(bonus)}` : `Бонус ${fmtMod(bonus)}`);
    const hint = h('p', { class: 'muted' }, 'Нажми на кубик, чтобы бросить');
    const done = h('button', { class: 'btn primary', hidden: true }, 'Дальше');
    ov.append(...[h('h2', {}, title), sub ? h('p', { class: 'muted', style: { marginTop: '6px' } }, sub) : null, wrap, verdict, math, hint, done].filter(Boolean));
    ov.hidden = false;

    let rolled = false;
    const go = async () => {
      if (rolled) return;
      rolled = true;
      hint.remove();
      const r = roll();
      wrap.classList.add('rolling');
      const t0 = performance.now();
      while (performance.now() - t0 < 850) {
        num.textContent = 1 + Math.floor(Math.random() * 20);
        await sleep(55);
      }
      wrap.classList.remove('rolling');
      num.textContent = r.natural;
      if (r.natural === 20) wrap.classList.add('crit');
      if (r.natural === 1) wrap.classList.add('fumble');
      if (navigator.vibrate) navigator.vibrate(r.ok ? 40 : [30, 60, 30]);
      const extra = r.rolls.length > 1 ? ` (кубики ${r.rolls.join(' и ')})` : '';
      math.textContent = `${r.natural} ${fmtMod(r.bonus)} = ${r.total}${target !== null ? ` против ${target}` : ''}${extra}`;
      verdict.textContent = r.natural === 20 ? 'Критический успех!' : r.natural === 1 ? 'Критический провал' : r.ok ? 'Успех' : 'Провал';
      verdict.className = 'verdict ' + (r.ok ? 'ok' : 'bad');
      speak(verdict.textContent);
      done.hidden = false;
      done.focus();
      done.onclick = () => { ov.hidden = true; ov.innerHTML = ''; resolve(r); };
    };
    wrap.onclick = go;
    wrap.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') go(); };
    if (auto) setTimeout(go, 300);
  });
}

// ---------- нижняя шторка ----------

export function sheet(content, { onClose } = {}) {
  const bg = h('div', { class: 'sheet-bg' });
  const sh = h('div', { class: 'sheet', role: 'dialog' });
  const close = () => { bg.remove(); sh.remove(); onClose?.(); };
  bg.onclick = close;
  sh.append(typeof content === 'function' ? content(close) : content);
  document.body.append(bg, sh);
  return close;
}

// ---------- озвучка ведущего ----------

let ruVoice = null;
function pickVoice() {
  const vs = speechSynthesis.getVoices();
  ruVoice = vs.find((v) => v.lang?.startsWith('ru') && /Milena|Yuri|Google/i.test(v.name)) || vs.find((v) => v.lang?.startsWith('ru')) || null;
}
if ('speechSynthesis' in window) {
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice;
  // iPhone не даёт говорить, пока человек не коснулся экрана: первое касание
  // проговаривает пустую фразу, и дальше голос работает без касаний
  const unlock = () => {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    speechSynthesis.speak(u);
  };
  document.addEventListener('touchend', unlock, { once: true });
  document.addEventListener('click', unlock, { once: true });
}

export function speak(text) {
  if (!settings.get('tts', false) || !('speechSynthesis' in window) || !text) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ru-RU';
  if (ruVoice) u.voice = ruVoice;
  u.rate = settings.get('rate', 1);
  speechSynthesis.speak(u);
}

export function stopSpeak() {
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}

// ---------- голосовой ввод ----------

const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
export const canListen = !!Rec;

export function listen(onText, onEnd) {
  if (!Rec) return null;
  const r = new Rec();
  r.lang = 'ru-RU';
  r.interimResults = true;
  r.continuous = false;
  r.onresult = (e) => {
    let text = '';
    for (const res of e.results) text += res[0].transcript;
    onText(text);
  };
  r.onend = () => onEnd?.();
  r.onerror = () => onEnd?.();
  r.start();
  return r;
}
