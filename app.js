'use strict';

// ===================== Calcoli (funzioni pure) =====================
const pad = n => String(n).padStart(2, '0');
function normT(s){
  s = String(s == null ? '' : s).trim().replace(/[.,;\s'"]+/g, ':').replace(/^:+|:+$/g, '');
  if (!s) return '';
  if (/^\d{3,4}$/.test(s)) s = s.slice(0, -2) + ':' + s.slice(-2);
  const m = /^(\d{1,3}):(\d{1,2})$/.exec(s);
  if (!m) return s;
  return pad(+m[1]) + ':' + pad(+m[2]);
}
function parseT(s){
  const m = /^(\d{1,3}):(\d{1,2})$/.exec(String(s == null ? '' : s).trim());
  if (!m || Number(m[2]) > 59) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}
const mmss = sec => pad(Math.floor(sec / 60)) + ':' + pad(sec % 60);
function hms(sec){ return pad(Math.floor(sec / 3600)) + ' : ' + pad(Math.floor(sec % 3600 / 60)) + ' : ' + pad(sec % 60); }
function short(sec){
  const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
  return h > 0 ? h + ':' + pad(m) + ':' + pad(s) : pad(m) + ':' + pad(s);
}
// Secondi per ogni penalità: impostabili da 20 a 60 all'avvio della gara.
const PEN_MIN = 20, PEN_MAX = 60;
function clampPen(v){ const n = parseInt(v, 10); return Number.isFinite(n) ? Math.min(PEN_MAX, Math.max(PEN_MIN, n)) : PEN_MIN; }
function totals(rows, penVal){
  const pv1 = clampPen(penVal == null ? PEN_MIN : penVal);
  let part = 0, pen = 0, bad = 0;
  for (const r of rows) {
    const t = String(r.t == null ? '' : r.t).trim();
    if (t) { const s = parseT(t); if (s == null) bad++; else part += s; }
    const pv = String(r.p == null ? '' : r.p).trim();
    if (pv !== '') { const k = parseInt(pv, 10); if (Number.isFinite(k) && k >= 0) pen += k; else bad++; }
  }
  return { part, pen, penSec: pen * pv1, final: part + pen * pv1, bad };
}

// ===================== Configurazione =====================
const GARE = {
  carroponte: { nome: 'Carroponte Super Circuit', file: 'modelli/carroponte.pdf' },
  mulettisti: { nome: 'Mulettisti Super Circuit', file: 'modelli/mulettisti.pdf' }
};
// Posizioni dei campi sul modello PDF (punti, origine in alto a sinistra), misurate sui tuoi modelli.
const LAYOUT = {"names":[[60.0,173.5,175.2,184.5],[188.3,301.9,175.2,184.5],[316.7,430.2,175.2,184.5],[445.1,558.5,175.2,184.5],[573.5,686.9,175.2,184.5],[702.0,815.5,175.2,184.5]],
  "rowBottoms":[248.1,279.9,311.7,343.5,375.3,407.1],
  "rowG":[{"t":[52.6,106.6],"p":[118.1,169.5]},{"t":[181.0,235.1],"p":[246.5,297.8]},{"t":[309.3,363.5],"p":[374.9,426.2]},{"t":[437.7,491.7],"p":[503.2,554.6]},{"t":[566.1,620.1],"p":[631.6,683.0]},{"t":[694.4,748.5],"p":[760.0,811.4]}],
  "part":{"bottom":449.5,"pbottom":450.8,"g":[{"t":[50.9,107.9],"p":[114.4,172.7]},{"t":[179.3,236.3],"p":[242.8,301.1]},{"t":[307.7,364.7],"p":[371.2,429.5]},{"t":[436.1,493.1],"p":[499.6,557.9]},{"t":[564.5,621.5],"p":[628.0,686.3]},{"t":[692.9,749.9],"p":[756.4,814.7]}]},
  "penLabel":[{"x0":157.18,"x1":167.46,"base":127.2},{"x0":284.75,"x1":295.03,"base":127.08},{"x0":413.15,"x1":423.42,"base":127.08},{"x0":541.52,"x1":551.8,"base":127.08},{"x0":669.92,"x1":680.19,"base":127.08},{"x0":798.31,"x1":808.59,"base":127.08}],
  "colBg":[[0.855,0.945,0.953],[1.0,0.882,0.8],[0.82,0.945,0.855],[0.996,0.949,0.804],[0.949,0.949,0.949],[1.0,0.8,1.0]],
  "final":{"bottom":509.1,"g":[[[49.0,85.0],[93.4,129.4],[137.8,173.8]],[[177.4,213.4],[221.8,257.8],[266.1,302.3]],[[305.7,341.8],[350.1,386.1],[394.5,430.7]],[[434.1,470.1],[478.5,514.6],[522.9,559.0]],[[562.4,598.6],[606.9,642.9],[651.2,687.3]],[[690.9,727.0],[735.3,771.4],[779.7,815.7]]]}};

const PROMPT = [
  'Le immagini sono foto di una scheda cronometrica compilata a mano per una gara tra corsisti (Carroponte Super Circuit o Mulettisti Super Circuit).',
  'La scheda ha fino a 6 colonne colorate numerate da 1 a 6. In cima a ogni colonna c\'è il nome del partecipante, poi 6 righe P1-P6, ciascuna con "Tempo (mm:ss)" e "Penalità (n°)".',
  'Più foto possono mostrare parti diverse della stessa scheda (per esempio colonne 1-3 in una foto e 4-6 in un\'altra): unisci tutte le colonne compilate, in ordine di numero, senza duplicarle.',
  'Ignora le righe in fondo PART (bordo giallo) e FINAL (bordo rosso) anche se compilate: i totali li calcola l\'app.',
  'La penalità può essere scritta cifra per cifra nelle tre caselle (per esempio 0 1 6 vale 16): leggila come un unico numero intero.',
  'Per ogni colonna con almeno un nome o un dato restituisci il nome e, per P1..P6, il tempo nel formato mm:ss a due cifre (per esempio "07:42") e le penalità come intero.',
  'Riga non usata o cella vuota: tempo "" e penalita null. Una penalità scritta come 0 o "-" in una riga con tempo vale 0.',
  'Non inventare e non correggere i valori. Se una cifra o un nome è illeggibile o dubbio, scrivi la migliore lettura e aggiungi la cella all\'elenco "dubbi" con le etichette "nome", "P1 tempo", "P1 penalita", "P2 tempo" e così via.',
  'Rispondi SOLO con JSON valido, senza testo prima o dopo, in questa forma:',
  '{"gara":"Carroponte","colonne":[{"numero":1,"nome":"Marino","prove":[{"tempo":"10:01","penalita":6},{"tempo":"07:54","penalita":0},{"tempo":"","penalita":null},{"tempo":"","penalita":null},{"tempo":"","penalita":null},{"tempo":"","penalita":null}],"dubbi":["P2 tempo"]}]}',
  '"prove" ha sempre 6 elementi (P1..P6). "gara" vale "Carroponte" o "Mulettisti" se riconosci il logo in alto, altrimenti "".'
].join('\n');

// ===================== Stato =====================
const $ = s => document.querySelector(s);
const KEY_STATE = 'sg-state-v1', KEY_API = 'sg-apikey', KEY_SET = 'sg-settings';
const today = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const state = { gara: 'carroponte', data: today(), pen: 20, parts: [] };
const settings = { model: 'claude-sonnet-5-5', stamp: true, corso: '', sede: '' };
let nextId = 1;
const refs = {};
let photos = [];      // {blob, url} delle ultime foto lette (solo in memoria)
let lastBatch = [];   // file dell'ultima lettura, per "Rileggi"
let lastAdded = [];   // partecipanti aggiunti dall'ultima lettura
let ctl = null, timer = null;

const store = {
  get(k){ try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v){ try { localStorage.setItem(k, v); } catch (e) {} },
  del(k){ try { localStorage.removeItem(k); } catch (e) {} }
};

function newPart(nome){
  return { id: nextId++, nome: nome || '', rows: Array.from({ length: 6 }, () => ({ t: '', p: '' })), dubbi: new Set() };
}
const displayName = (p, i) => p.nome.trim() || ('Partecipante ' + (i + 1));

function save(){
  store.set(KEY_STATE, JSON.stringify({
    gara: state.gara, data: state.data, pen: state.pen,
    parts: state.parts.map(p => ({ nome: p.nome, rows: p.rows, dubbi: [...p.dubbi] }))
  }));
}
function load(){
  try {
    const s = JSON.parse(store.get(KEY_STATE) || 'null');
    if (s) {
      if (GARE[s.gara]) state.gara = s.gara;
      if (typeof s.data === 'string' && s.data) state.data = s.data;
      if (s.pen != null) state.pen = clampPen(s.pen);
      for (const q of (Array.isArray(s.parts) ? s.parts : [])) {
        const p = newPart(String(q.nome || ''));
        for (let r = 0; r < 6; r++) { const x = (q.rows || [])[r] || {}; p.rows[r].t = String(x.t || ''); p.rows[r].p = String(x.p == null ? '' : x.p); }
        (q.dubbi || []).forEach(k => p.dubbi.add(String(k)));
        state.parts.push(p);
      }
    }
    const st = JSON.parse(store.get(KEY_SET) || 'null');
    if (st) {
      if (typeof st.model === 'string' && st.model) settings.model = st.model;
      if (typeof st.stamp === 'boolean') settings.stamp = st.stamp;
      if (typeof st.corso === 'string') settings.corso = st.corso;
      else if (typeof st.nota === 'string') settings.corso = st.nota;
      if (typeof st.sede === 'string') settings.sede = st.sede;
    }
  } catch (e) {}
}
const saveSettings = () => store.set(KEY_SET, JSON.stringify(settings));

// ===================== UI di base =====================
function h(tag, props, ...kids){
  const e = document.createElement(tag);
  if (props) for (const [k, v] of Object.entries(props)) {
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k === 'value') e.value = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v === true) e.setAttribute(k, '');
    else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const c of kids.flat()) if (c != null) e.append(c);
  return e;
}
function status(msg, cls){ const s = $('#status'); s.textContent = msg || ''; s.className = 'status' + (cls ? ' ' + cls : ''); }
let toastT = null;
function toast(msg){ const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2600); }

function syncGara(){
  document.querySelectorAll('.seg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.g === state.gara)));
}

// ===================== Schede partecipanti =====================
function cardFor(p, idx){
  const ref = {};
  const name = h('input', { class: 'name', type: 'text', id: 'n-' + p.id, placeholder: 'Nome partecipante', autocomplete: 'off', 'aria-label': 'Nome partecipante ' + (idx + 1), value: p.nome });
  if (p.dubbi.has('n')) name.classList.add('doubt');
  name.addEventListener('input', () => { p.nome = name.value; p.dubbi.delete('n'); name.classList.remove('doubt'); changed(); });

  const grid = h('div', { class: 'grid' }, h('span'), h('span', { class: 'gh' }, 'Tempo', h('br'), '(mm:ss)'), h('span', { class: 'gh' }, 'Penalità', h('br'), '(n°)'));
  p.rows.forEach((row, r) => {
    const t = h('input', { class: 'in-t', type: 'text', id: 't-' + p.id + '-' + r, inputmode: 'numeric', placeholder: '00:00', autocomplete: 'off', 'aria-label': 'Tempo P' + (r + 1), value: row.t });
    const q = h('input', { class: 'in-p', type: 'number', id: 'p-' + p.id + '-' + r, inputmode: 'numeric', min: '0', step: '1', placeholder: '0', 'aria-label': 'Penalità P' + (r + 1), value: row.p });
    if (p.dubbi.has(r + ':t')) t.classList.add('doubt');
    if (p.dubbi.has(r + ':p')) q.classList.add('doubt');
    const check = () => { const v = t.value.trim(); t.classList.toggle('invalid', v !== '' && parseT(v) == null); };
    t.addEventListener('input', () => { row.t = t.value; p.dubbi.delete(r + ':t'); t.classList.remove('doubt'); changed(); });
    t.addEventListener('blur', () => { const n = normT(t.value); t.value = n; row.t = n; check(); changed(); });
    q.addEventListener('input', () => { row.p = q.value; p.dubbi.delete(r + ':p'); q.classList.remove('doubt'); changed(); });
    check();
    grid.append(h('span', { class: 'pl' }, 'P' + (r + 1)), t, q);
  });

  ref.partT = h('b'); ref.penS = h('b'); ref.penSmall = h('small'); ref.finalT = h('span', { class: 'big' });
  ref.warn = h('p', { class: 'warnline', hidden: true });
  const rm = h('button', { type: 'button', class: 'rm', 'aria-label': 'Rimuovi partecipante ' + (idx + 1), text: '×' });
  let armed = false;
  rm.addEventListener('click', () => {
    if (!armed) { armed = true; rm.textContent = '✓?'; rm.setAttribute('aria-label', 'Tocca di nuovo per rimuovere'); setTimeout(() => { armed = false; rm.textContent = '×'; }, 3000); return; }
    state.parts = state.parts.filter(x => x !== p); renderCards(); save();
  });
  const card = h('article', { class: 'card', style: '--col:var(--c' + (idx % 6 + 1) + ')' },
    h('div', { class: 'cardhead' }, h('span', { class: 'num', 'aria-hidden': 'true' }, String(idx % 6 + 1)), name, rm),
    grid,
    h('div', { class: 'tot part' }, h('span', { class: 'k' }, 'PART'), h('span', {}, ref.partT, ' ', h('small', {}, 'min:sec')), h('span', {}, ref.penS, ' ', ref.penSmall)),
    h('div', { class: 'tot final' }, h('span', { class: 'k' }, 'FINAL'), ref.finalT, h('small', {}, 'ore : min : sec')),
    ref.warn);
  refs[p.id] = ref;
  return card;
}

function renderCards(){
  const box = $('#cards');
  box.replaceChildren();
  state.parts.forEach((p, i) => box.append(cardFor(p, i)));
  const has = state.parts.length > 0;
  $('#bar').hidden = !has;
  $('#btnNew').hidden = !has;
  $('#camText').textContent = has ? 'Aggiungi altra foto' : 'Fotografa la scheda';
  $('#camSub').textContent = has ? 'per le colonne mancanti; la lettura parte da sola' : 'la lettura parte da sola';
  $('#legend').hidden = !state.parts.some(p => p.dubbi.size);
  updateTotals();
}

function ranking(){
  return state.parts.map((p, i) => ({ p, i, t: totals(p.rows, state.pen) })).filter(x => x.t.part > 0).sort((a, b) => a.t.final - b.t.final);
}
function updateTotals(){
  state.parts.forEach(p => {
    const r = refs[p.id]; if (!r) return;
    const t = totals(p.rows, state.pen);
    r.partT.textContent = mmss(t.part);
    r.penS.textContent = String(t.penSec);
    r.penSmall.textContent = 'sec (' + t.pen + ' × ' + state.pen + ')';
    r.finalT.textContent = hms(t.final);
    r.warn.hidden = t.bad === 0;
    r.warn.textContent = t.bad ? 'Un valore non è valido ed è escluso dal calcolo (tempo come mm:ss, secondi da 00 a 59).' : '';
  });
  const rk = ranking(), ol = $('#rank');
  ol.replaceChildren();
  rk.forEach((x, k) => ol.append(h('li', {}, h('span', { class: 'pos' }, (k + 1) + '°'), h('span', { class: 'nm' }, displayName(x.p, x.i)), h('span', { class: 'tm' }, short(x.t.final)))));
  $('#rankPanel').hidden = rk.length === 0;
}
function changed(){ updateTotals(); save(); $('#legend').hidden = !state.parts.some(p => p.dubbi.size); }

// ===================== Foto =====================
async function shrink(file){
  // Ridimensiona a max 1568 px sul lato lungo (risoluzione ottimale per Claude) e converte in JPEG.
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch (e) {
    bmp = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
  }
  const W = bmp.width, H = bmp.height, k = Math.min(1, 1568 / Math.max(W, H));
  const c = document.createElement('canvas');
  c.width = Math.round(W * k); c.height = Math.round(H * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await new Promise(res => c.toBlob(res, 'image/jpeg', 0.9));
  const b64 = c.toDataURL('image/jpeg', 0.9).split(',')[1];
  return { blob, b64 };
}

function renderThumbs(){
  const box = $('#thumbs');
  box.replaceChildren();
  photos.forEach((ph, i) => box.append(h('button', { type: 'button', 'aria-label': 'Ingrandisci foto ' + (i + 1), onclick: () => { $('#viewerImg').src = ph.url; $('#viewer').hidden = false; } }, h('img', { src: ph.url, alt: '' }))));
}

const API_ERR = {
  401: 'Chiave API non valida. Controllala in Impostazioni.',
  403: 'La chiave API non ha i permessi necessari.',
  402: 'Credito API esaurito: ricarica su console.anthropic.com (Billing).',
  413: 'Foto troppo grande. Riprova.',
  429: 'Troppe richieste o limite raggiunto. Riprova tra un minuto.',
  500: 'Errore temporaneo del servizio. Riprova.',
  529: 'Servizio sovraccarico in questo momento. Riprova tra poco.'
};

async function callClaude(images, signal){
  const key = store.get(KEY_API);
  if (!key) throw { msg: 'Manca la chiave API: aggiungila in Impostazioni.' };
  const content = images.map(b64 => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } }));
  content.push({ type: 'text', text: PROMPT });
  let res;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({ model: settings.model, max_tokens: 4096, messages: [{ role: 'user', content }] })
    });
  } catch (e) {
    if (e && e.name === 'AbortError') throw e;
    throw { msg: 'Nessuna connessione a internet. Controlla la rete e riprova.' };
  }
  let body = null;
  try { body = await res.json(); } catch (e) {}
  if (!res.ok) {
    const apiMsg = body && body.error && body.error.message || '';
    if (/credit balance/i.test(apiMsg)) throw { msg: API_ERR[402] };
    if (res.status === 404 || /model/i.test(apiMsg) && res.status === 400) throw { msg: 'Modello non disponibile per la tua chiave. Prova l\'altra opzione di lettura in Impostazioni.' };
    throw { msg: API_ERR[res.status] || ('Errore ' + res.status + (apiMsg ? ': ' + apiMsg : '')) };
  }
  const text = (body && body.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
  let s = text.trim();
  const fence = /```(?:json)?\s*([\s\S]*?)```/.exec(s);
  if (fence) s = fence[1];
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b < a) throw { msg: 'Non sono riuscito a interpretare la scheda. Riprova con una foto più nitida e frontale.' };
  try { return JSON.parse(s.slice(a, b + 1)); }
  catch (e) { throw { msg: 'Non sono riuscito a interpretare la scheda. Riprova con una foto più nitida e frontale.' }; }
}

function importData(d){
  const cols = (Array.isArray(d && d.colonne) ? d.colonne : []).slice().sort((x, y) => (Number(x && x.numero) || 0) - (Number(y && y.numero) || 0));
  const wasEmpty = state.parts.length === 0;
  lastAdded = [];
  let n = 0;
  for (const c of cols) {
    if (!c || typeof c !== 'object') continue;
    const p = newPart(String(c.nome == null ? '' : c.nome).trim());
    const prove = Array.isArray(c.prove) ? c.prove : [];
    let any = p.nome !== '';
    for (let r = 0; r < 6; r++) {
      const q = prove[r] || {};
      p.rows[r].t = normT(q.tempo);
      const pen = q.penalita;
      p.rows[r].p = (pen === null || pen === undefined || pen === '' || pen === '-') ? '' : String(Math.max(0, parseInt(pen, 10) || 0));
      if (p.rows[r].t || p.rows[r].p) any = true;
    }
    if (!any) continue;
    for (const k of (Array.isArray(c.dubbi) ? c.dubbi : [])) {
      const s = String(k).toLowerCase();
      if (s.startsWith('nome')) { p.dubbi.add('n'); continue; }
      const m = /^p\s*([1-6])\s*(tempo|penalit)/.exec(s);
      if (m) p.dubbi.add((Number(m[1]) - 1) + ':' + (m[2] === 'tempo' ? 't' : 'p'));
    }
    state.parts.push(p); lastAdded.push(p.id); n++;
  }
  const g = String(d && d.gara || '').toLowerCase();
  if (wasEmpty && n > 0) {
    if (g.includes('carroponte')) state.gara = 'carroponte';
    else if (g.includes('mulett')) state.gara = 'mulettisti';
    syncGara();
  }
  return n;
}

function setBusy(b){
  $('#busy').hidden = !b;
  ['#lblCam', '#lblGal'].forEach(id => { $(id).classList.toggle('off', b); $(id + ' input').disabled = b; });
  $('#btnRetry').hidden = b || lastBatch.length === 0;
}

async function readFiles(fileList){
  const files = Array.from(fileList || []).filter(f => /^image\//.test(f.type) || !f.type).slice(0, 6);
  if (!files.length || ctl) return;
  if (!store.get(KEY_API)) { showSetup(); return; }
  ctl = new AbortController();
  lastBatch = files;
  status('');
  setBusy(true);
  const t0 = Date.now();
  const tick = () => { $('#busyText').textContent = 'Lettura in corso... ' + Math.round((Date.now() - t0) / 1000) + ' s'; };
  tick(); timer = setInterval(tick, 1000);
  try {
    const shr = [];
    for (const f of files) shr.push(await shrink(f));
    const data = await callClaude(shr.map(x => x.b64), ctl.signal);
    const n = importData(data);
    if (n === 0) {
      status('Non ho trovato colonne compilate. Inquadra la scheda intera, dall\'alto e con buona luce.', 'err');
    } else {
      photos.forEach(ph => URL.revokeObjectURL(ph.url));
      photos = shr.map(x => ({ url: URL.createObjectURL(x.blob) }));
      renderThumbs(); renderCards(); save();
      const doubts = state.parts.reduce((a, p) => a + p.dubbi.size, 0);
      status('Letti ' + n + (n === 1 ? ' partecipante' : ' partecipanti') + (doubts ? '. ' + doubts + (doubts === 1 ? ' valore incerto' : ' valori incerti') + ' evidenziati in giallo.' : '. Nessun valore incerto.'), 'ok');
      const first = document.querySelector('#rankPanel:not([hidden])') || $('#cards');
      first.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  } catch (e) {
    if (e && e.name === 'AbortError') status('Lettura interrotta.');
    else status((e && e.msg) || 'Lettura non riuscita. Riprova.', 'err');
  } finally {
    clearInterval(timer); ctl = null; setBusy(false);
  }
}

// ===================== PDF sui modelli originali =====================
const tplCache = {};
async function template(g){
  if (!tplCache[g]) {
    const r = await fetch(GARE[g].file);
    if (!r.ok) throw new Error('tpl');
    tplCache[g] = new Uint8Array(await r.arrayBuffer());
  }
  return tplCache[g];
}
function fmtDate(iso){ const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? m[3] + '/' + m[2] + '/' + m[1] : ''; }

async function buildPdf(){
  const PL = window.PDFLib;
  if (!PL) throw new Error('lib');
  const { PDFDocument, StandardFonts, rgb } = PL;
  const tpl = await template(state.gara);
  const out = await PDFDocument.create();
  out.setTitle(GARE[state.gara].nome + ' ' + fmtDate(state.data));
  const bold = await out.embedFont(StandardFonts.HelveticaBold);
  const reg = await out.embedFont(StandardFonts.Helvetica);
  const obl = await out.embedFont(StandardFonts.HelveticaOblique);
  const color = rgb(0.06, 0.12, 0.5);
  const BASE = 2.3;
  const safe = (f, str) => { try { f.encodeText(str); return str; } catch (e) { return str.normalize('NFD').replace(/[^\x20-\x7E\xA0-\xFF]/g, ''); } };
  const pages = Math.max(1, Math.ceil(state.parts.length / 6));
  const src = await PDFDocument.load(tpl);
  for (let pi = 0; pi < pages; pi++) {
    const [page] = await out.copyPages(src, [0]);
    out.addPage(page);
    const H = page.getHeight();
    const put = (str, x, bottom, size, font, align) => {
      font = font || bold; str = safe(font, String(str)); if (!str) return;
      const w = font.widthOfTextAtSize(str, size);
      page.drawText(str, { x: align === 'l' ? x : x - w / 2, y: H - (bottom - BASE), size, font, color });
    };
    // Sostituisce il "20" stampato in "sec (∑n°x20)" con il valore della gara.
    if (state.pen !== 20) {
      LAYOUT.penLabel.forEach((L, g) => {
        const c = LAYOUT.colBg[g];
        page.drawRectangle({ x: L.x0 - 0.1, y: L.base - 2.3, width: L.x1 - L.x0 + 0.3, height: 9.4, color: rgb(c[0], c[1], c[2]) });
        const v = String(state.pen), w = obl.widthOfTextAtSize(v, 9.24);
        page.drawText(v, { x: (L.x0 + L.x1) / 2 - w / 2, y: L.base, size: 9.24, font: obl, color: rgb(0, 0, 0) });
      });
    }
    if (settings.stamp) {
      const line = [fmtDate(state.data), settings.corso.trim(), settings.sede.trim(), pages > 1 ? 'pagina ' + (pi + 1) + ' di ' + pages : ''].filter(Boolean).join('  -  ');
      if (line) put(line, 20, 30, 8.5, reg, 'l');
    }
    state.parts.slice(pi * 6, pi * 6 + 6).forEach((p, g) => {
      const nm = LAYOUT.names[g];
      let name = safe(bold, p.nome.trim()), size = 11;
      const maxW = nm[1] - nm[0] - 6;
      while (size > 7 && bold.widthOfTextAtSize(name, size) > maxW) size -= 0.5;
      while (name.length > 1 && bold.widthOfTextAtSize(name, size) > maxW) name = name.slice(0, -1);
      if (name) put(name, nm[0] + 3, nm[3], size, bold, 'l');
      const G = LAYOUT.rowG[g];
      p.rows.forEach((row, r) => {
        const bottom = LAYOUT.rowBottoms[r];
        const s = parseT(String(row.t == null ? '' : row.t).trim());
        if (s != null) {
          const mid = (G.t[0] + G.t[1]) / 2;
          put(pad(Math.floor(s / 60)), mid - 12.5, bottom, 11);
          put(pad(s % 60), mid + 12.5, bottom, 11);
        }
        const pv = String(row.p == null ? '' : row.p).trim(), k = parseInt(pv, 10);
        if (pv !== '' && Number.isFinite(k) && k >= 0) put(String(k), (G.p[0] + G.p[1]) / 2, bottom, 11);
      });
      const t = totals(p.rows, state.pen);
      if (t.part > 0 || t.pen > 0) {
        const P = LAYOUT.part.g[g], mid = (P.t[0] + P.t[1]) / 2;
        put(pad(Math.floor(t.part / 60)), mid - 13, LAYOUT.part.bottom, 11.5);
        put(pad(t.part % 60), mid + 13, LAYOUT.part.bottom, 11.5);
        put(String(t.penSec), (P.p[0] + P.p[1]) / 2, LAYOUT.part.pbottom, 11.5);
        const F = LAYOUT.final.g[g], f = t.final;
        [Math.floor(f / 3600), Math.floor(f % 3600 / 60), f % 60].forEach((v, i) => put(pad(v), (F[i][0] + F[i][1]) / 2, LAYOUT.final.bottom, 12));
      }
    });
  }
  return await out.save();
}
function pdfName(){ return GARE[state.gara].nome.replace(/\s+/g, '_') + '_' + (state.data || today()) + '.pdf'; }

async function makePdfFile(){
  try {
    const bytes = await buildPdf();
    return new File([bytes], pdfName(), { type: 'application/pdf' });
  } catch (e) {
    toast(e && e.message === 'lib' ? 'Generatore PDF non caricato: apri l\'app con internet almeno una volta.' : 'Impossibile creare il PDF.');
    return null;
  }
}
async function sharePdf(){
  const file = await makePdfFile(); if (!file) return;
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: file.name }); }
    catch (e) { if (e && e.name !== 'AbortError') downloadFile(file); }
  } else downloadFile(file);
}
async function savePdf(){ const file = await makePdfFile(); if (file) downloadFile(file); }
function downloadFile(file){
  const url = URL.createObjectURL(file);
  const a = h('a', { href: url, download: file.name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  toast('PDF salvato in Download.');
}

// ===================== Impostazioni e avvio =====================
function showSetup(){ $('#setup').hidden = false; $('#main').hidden = true; $('#bar').hidden = true; $('#btnSettings').hidden = true; }
function showMain(){ $('#setup').hidden = true; $('#main').hidden = false; $('#btnSettings').hidden = false; renderCards(); }
const keyLooksOk = k => /^sk-ant-[\w-]{20,}$/.test(k);

function openSettings(){
  $('#setModel').value = settings.model;
  $('#setKey').value = '';
  const k = store.get(KEY_API);
  $('#keyInfo').textContent = k ? 'Chiave salvata: ' + k.slice(0, 10) + '…' + k.slice(-4) : 'Nessuna chiave salvata.';
  $('#dlg').showModal();
}

function bind(){
  $('#btnSaveKey').addEventListener('click', () => {
    const k = $('#keyIn').value.trim();
    if (!keyLooksOk(k)) { $('#setupStatus').textContent = 'La chiave deve iniziare con sk-ant- . Copiala di nuovo dalla console.'; $('#setupStatus').className = 'status err'; return; }
    store.set(KEY_API, k); $('#keyIn').value = ''; showMain();
    toast('Chiave salvata. Ora fotografa la scheda.');
  });
  document.querySelectorAll('.seg button').forEach(b => b.addEventListener('click', () => { state.gara = b.dataset.g; syncGara(); save(); }));
  $('#data').addEventListener('input', e => { state.data = e.target.value; save(); });
  $('#corso').value = settings.corso; $('#sede').value = settings.sede; $('#stamp').checked = settings.stamp;
  $('#corso').addEventListener('input', e => { settings.corso = e.target.value; saveSettings(); });
  $('#sede').addEventListener('input', e => { settings.sede = e.target.value; saveSettings(); });
  $('#stamp').addEventListener('change', e => { settings.stamp = e.target.checked; saveSettings(); });
  const setPen = v => { state.pen = clampPen(v); $('#pen').value = state.pen; $('#penMinus').disabled = state.pen <= PEN_MIN; $('#penPlus').disabled = state.pen >= PEN_MAX; updateTotals(); save(); };
  $('#pen').addEventListener('change', e => setPen(e.target.value));
  $('#penMinus').addEventListener('click', () => setPen(state.pen - 5));
  $('#penPlus').addEventListener('click', () => setPen(state.pen + 5));
  setPen(state.pen);
  $('#inCam').addEventListener('change', e => { const f = e.target.files; readFiles(f).finally(() => { e.target.value = ''; }); });
  $('#inGal').addEventListener('change', e => { const f = e.target.files; readFiles(f).finally(() => { e.target.value = ''; }); });
  $('#btnRetry').addEventListener('click', () => {
    // Rilegge le ultime foto sostituendo i partecipanti letti l'ultima volta.
    state.parts = state.parts.filter(p => !lastAdded.includes(p.id)); renderCards(); save(); readFiles(lastBatch);
  });
  $('#btnStop').addEventListener('click', () => { if (ctl) ctl.abort(); });
  $('#btnShare').addEventListener('click', sharePdf);
  $('#btnSave').addEventListener('click', savePdf);
  $('#btnAdd').addEventListener('click', () => {
    state.parts.push(newPart('')); renderCards(); save();
    const el = document.getElementById('n-' + state.parts[state.parts.length - 1].id); if (el) { el.scrollIntoView({ block: 'center' }); el.focus(); }
  });
  let armed = false, armT = null;
  $('#btnNew').addEventListener('click', () => {
    const b = $('#btnNew');
    if (!armed) { armed = true; b.textContent = 'Tocca di nuovo per cancellare i dati'; armT = setTimeout(() => { armed = false; b.textContent = 'Nuova gara'; }, 3500); return; }
    clearTimeout(armT); armed = false; b.textContent = 'Nuova gara';
    state.parts = []; state.data = today(); $('#data').value = state.data;
    photos.forEach(ph => URL.revokeObjectURL(ph.url)); photos = []; lastBatch = [];
    renderThumbs(); renderCards(); save(); status(''); $('#btnRetry').hidden = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  $('#btnSettings').addEventListener('click', openSettings);
  $('#dlg').addEventListener('close', () => {
    settings.model = $('#setModel').value; saveSettings();
    const k = $('#setKey').value.trim();
    if (k) { if (keyLooksOk(k)) { store.set(KEY_API, k); toast('Chiave aggiornata.'); } else toast('Chiave non valida: non è stata cambiata.'); }
  });
  $('#btnDelKey').addEventListener('click', () => { store.del(KEY_API); $('#dlg').close(); showSetup(); });
  $('#btnCloseViewer').addEventListener('click', () => { $('#viewer').hidden = true; });
}

function init(){
  load(); bind(); syncGara();
  $('#data').value = state.data;
  if (store.get(KEY_API)) showMain(); else showSetup();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}
if (typeof document !== 'undefined' && !globalThis.__TEST__) init();
