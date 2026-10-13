/* Tiny Fighter Arena — vanilla JS, no build step, no framework.
 * Text + image via Pollinations gen API. Bring your own Pollen key (localStorage only).
 */
'use strict';

const TEXT_ENDPOINT  = 'https://gen.pollinations.ai/v1/chat/completions';
const IMAGE_ENDPOINT = 'https://gen.pollinations.ai/image/';
const TEXT_MODEL     = 'openai';
const IMAGE_MODEL    = 'z-image';

const LS_KEY      = 'tfa_pollen_key';
const LS_PROGRESS = 'tfa_progress';

const CHALLENGERS = [
  { name:'Rustbot the Scrap Heap', title:'Recycling-yard brawler',
    style:'clumsy junk-brawler', look:'a dented tin robot welded from scrap, one wobbly wheel',
    stats:{power:2,speed:2,cunning:1,grit:3}, abilities:['Rusty Headbutt','Loose Bolt Spray'] },
  { name:'Madame Vex', title:'Courtyard duelist',
    style:'precise rapier duelist', look:'a sly duelist in a plum coat with a rapier umbrella',
    stats:{power:3,speed:4,cunning:4,grit:2}, abilities:['Parry Riposte','Silk Feint'] },
  { name:'Grukk Ironjaw', title:'Pit brute',
    style:'overwhelming wall of muscle', look:'a massive green brute with an iron jaw and a chain-fist',
    stats:{power:5,speed:2,cunning:1,grit:5}, abilities:['Chain Slam','Unbreakable Bellow'] },
  { name:'Sister Kilowatt', title:'Spark monk',
    style:'lightning-fast ascetic', look:'a calm nun crackling with blue static, crackling knuckles',
    stats:{power:4,speed:5,cunning:3,grit:3}, abilities:['Thunder Palm','Static Veil'] },
  { name:'The Hollow Prince', title:'Shadow swordsman',
    style:'unreadable shadow fencer', look:'a pale noble wreathed in drifting mist, two thin blades',
    stats:{power:5,speed:5,cunning:5,grit:4}, abilities:['Mist Step','Hollow Cut'] },
  { name:'Warden Apocalypse', title:'Champion of the Arena',
    style:'towering armored champion', look:'a colossal armored titan with a cracked halo and a meteor hammer',
    stats:{power:7,speed:6,cunning:6,grit:7}, abilities:['Meteor Hammer','Final Judgment'] },
];

const BOSS_TITLES = ['the Unbeaten','the Devourer','of the Last Bell','the Doom Bell','the Red Mirror'];
const CANNED = [
  '{a} lunges and {d} barely twists away, the air snapping where a skull used to be.',
  '{d} reads the feint, but {a} already pivoted — the blow lands with a wet thud.',
  'A blur of motion; {d} staggers back, tasting copper.',
  '{a} presses the advantage, every strike aimed at a memory of pain.',
  '{d} grits their teeth and answers with a counter that rattles {a}.',
  'The crowd howls as {a} carves a line across the arena floor.',
];

/* ---------- tiny utils ---------- */
const $ = (id) => document.getElementById(id);
const clamp = (n,l,h) => Math.max(l, Math.min(h, n));
const b64e = (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const b64d = (s) => decodeURIComponent(escape(atob(s.replace(/-/g,'+').replace(/_/g,'/'))));
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function makeRng(seed){ const r = mulberry32(seed>>>0); return { f:r, int:(a,b)=>a+Math.floor(r()*(b-a+1)), pick:(arr)=>arr[Math.floor(r()*arr.length)] }; }
function todaySeed(){ const d = new Date(); return Number('' + d.getFullYear() + String(d.getMonth()+1).padStart(2,'0') + String(d.getDate()).padStart(2,'0')); }

/* ---------- key ---------- */
const getKey  = () => { try { return localStorage.getItem(LS_KEY) || ''; } catch { return ''; } };
const setKey  = (k) => { try { k ? localStorage.setItem(LS_KEY,k) : localStorage.removeItem(LS_KEY); } catch {} };

/* ---------- progress ---------- */
function loadProgress(){ try { const p = JSON.parse(localStorage.getItem(LS_PROGRESS)); return { unlocked: p && p.unlocked||0, beaten: (p&&p.beaten)||{} }; } catch { return { unlocked:0, beaten:{} }; } }
function saveProgress(p){ try { localStorage.setItem(LS_PROGRESS, JSON.stringify(p)); } catch {} }

/* ---------- API ---------- */
async function apiChat(messages, { max_tokens = 700, temperature = 0.9, json = false } = {}) {
  const key = getKey();
  const headers = { 'Content-Type':'application/json' };
  if (key) headers['Authorization'] = 'Bearer ' + key;
  const body = { model: TEXT_MODEL, messages, max_tokens, temperature };
  if (json) body.response_format = { type: 'json_object' };
  let res;
  try {
    res = await fetch(TEXT_ENDPOINT, { method:'POST', headers, body: JSON.stringify(body) });
  } catch (e) {
    throw new ApiError('Network error reaching Pollinations. Check your connection.', e);
  }
  if (!res.ok) {
    const detail = await safeText(res);
    throw new ApiError(describeHttp(res.status, detail), null, res.status);
  }
  const data = await res.json().catch(() => null);
  const text = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (!text) throw new ApiError('Empty response from the text model.', null, 0, data);
  return text;
}

async function safeText(res){ try { return (await res.text()).slice(0, 300); } catch { return ''; } }

class ApiError extends Error {
  constructor(msg, cause, status, payload){ super(msg); this.cause = cause; this.status = status; this.payload = payload; }
}

function describeHttp(status, detail){
  if (status === 401 || status === 403) return 'Unauthorized — your Pollen key looks missing or invalid. Open 🔑 Pollen key and paste a valid key.';
  if (status === 402) return 'Not enough Pollen balance on your key. Top up your account and try again.';
  if (status === 429) return 'Rate limited by Pollinations. Wait a few seconds, then try again.';
  if (status >= 500) return 'Pollinations had a server error (' + status + '). Try again shortly.';
  return 'Request failed (' + status + '). ' + (detail ? detail.slice(0,140) : '');
}

/* extract the first JSON object from a lenient model reply */
function parseLooseJSON(text){
  if (!text) return null;
  let s = String(text).trim();
  s = s.replace(/^```(?:json)?/i,'').replace(/```$/,'').trim();
  try { return JSON.parse(s); } catch {}
  const start = s.indexOf('{'); const end = s.lastIndexOf('}');
  if (start !== -1 && end > start) {
    const slice = s.slice(start, end+1);
    try { return JSON.parse(slice); } catch {
      try { return JSON.parse(slice.replace(/,\s*([}\]])/g,'$1')); } catch {}
    }
  }
  return null;
}

/* ---------- fighter design ---------- */
const DESIGN_SYSTEM =
  'You are LOREKEEPER, a fighting-game designer for "Tiny Fighter Arena". ' +
  'Given a one-line fighter description you output STRICT JSON ONLY (no markdown, no prose) with this exact shape:\n' +
  '{"name":string,"title":string,"look":string,"style":string,' +
  '"stats":{"power":1-10,"speed":1-10,"cunning":1-10,"grit":1-10},' +
  '"abilities":[{"name":string,"effect":string}],"quirks":[string,string],' +
  '"portrait":string,"taunt":string}\n' +
  'RULES: Reward creativity, specificity and clever concepts with HIGHER stats (aim 6-9); ' +
  'generic or vague descriptions get LOW stats (2-4). A truly brilliant, inventive description earns a 10. ' +
  'stats.power=raw damage, speed=initiative/dodging, cunning=crits & dirty tricks, grit=hit points & toughness. ' +
  'Provide exactly 3 abilities and 2 quirks. "portrait" must be a vivid single-subject image prompt ending with ' +
  '"dramatic arena lighting, digital painting, centered portrait". "taunt" is one short in-character line.';

async function designFighter(description){
  const raw = await apiChat(
    [{ role:'system', content: DESIGN_SYSTEM },
     { role:'user', content: 'Fighter description: "' + description + '"\nDesign this fighter now. JSON only.' }],
    { max_tokens: 800, temperature: 0.95, json: true }
  );
  const j = parseLooseJSON(raw);
  if (!j) throw new ApiError('The model returned something that was not valid JSON. Try again.');
  return normalizeFighter(j, description);
}

function num(v, d){ const n = Math.round(Number(v)); return Number.isFinite(n) ? clamp(n,1,10) : d; }

function normalizeFighter(j, description){
  const s = j.stats || {};
  const abilities = Array.isArray(j.abilities) ? j.abilities.slice(0,4).map(a =>
      (typeof a === 'string') ? { name:a, effect:'' } : { name:String(a.name||'Ability'), effect:String(a.effect||'') })
    : [];
  while (abilities.length < 3) abilities.push({ name:'Desperate Swing', effect:'A wild last-ditch strike.' });
  const quirks = Array.isArray(j.quirks) ? j.quirks.slice(0,4).map(String)
    : [String(j.quirks||'Fights with reckless heart.')];
  return {
    name: String(j.name || 'The Nameless').slice(0,60),
    title: String(j.title || 'arena hopeful').slice(0,60),
    look: String(j.look || description).slice(0,300),
    style: String(j.style || 'improvised brawler').slice(0,140),
    stats: { power:num(s.power,5), speed:num(s.speed,5), cunning:num(s.cunning,5), grit:num(s.grit,5) },
    abilities, quirks,
    portrait: String(j.portrait || ('portrait of ' + description + ', dramatic arena lighting, digital painting, centered portrait')).slice(0,400),
    taunt: String(j.taunt || 'You picked the wrong arena.').slice(0,140),
  };
}

function challengerToFighter(c, seed){
  const ab = (c.abilities||[]).map(a => ({ name:a, effect:'' }));
  return {
    name:c.name, title:c.title, look:c.look, style:c.style, stats:{...c.stats},
    abilities:ab, quirks:[], portrait:c.look + ', full body challenger, dramatic arena lighting, digital painting, centered portrait',
    taunt: c.champion ? 'Kneel, or be remembered.' : 'Come and find out.',
    isChallenger:true,
  };
}

function dailyBoss(base, seed){
  const rng = makeRng(seed);
  const b = challengerToFighter(base, seed);
  b.name = '👑 ' + b.name + ' ' + rng.pick(BOSS_TITLES);
  b.stats = { power:clamp(base.stats.power+2,1,10), speed:clamp(base.stats.speed+2,1,10),
              cunning:clamp(base.stats.cunning+2,1,10), grit:clamp(base.stats.grit+2,1,10) };
  b.title = 'Daily Boss';
  b.champion = true;
  return b;
}

/* ---------- battle math ---------- */
function hpOf(f){ return 30 + f.stats.grit * 7; }

function exchange(att, def, rng){
  const crit = rng.f() < (att.stats.cunning * 0.045);
  const dodge = !crit && rng.f() < (def.stats.speed * 0.035);
  if (dodge) return { dmg:0, crit:false, dodge:true };
  let dmg = att.stats.power * 1.6 + att.stats.speed * 0.7 + rng.int(1,6) + (crit ? att.stats.cunning * 1.4 : 0);
  dmg -= def.stats.grit * 0.8;
  dmg = Math.max(1, Math.round(dmg));
  return { dmg, crit, dodge:false };
}

/* ---------- commentary ---------- */
async function commentate(a, d, ex, round, aHp, dHp){
  const move = ex.crit ? ('a critical ' + (a.abilities[0] && a.abilities[0].name || 'strike'))
                       : (a.abilities[round % Math.max(1,a.abilities.length)] || {name:'strike'}).name;
  try {
    const txt = await apiChat([
      { role:'system', content:'You are a hype arena commentator. Reply with ONE vivid sentence, max 28 words, no markdown, no quotes.' },
      { role:'user', content:
        'Round ' + round + '. ' + a.name + ' (' + aHp + ' hp) vs ' + d.name + ' (' + dHp + ' hp). ' +
        a.name + ' uses "' + move + '"' + (ex.dodge ? ', but ' + d.name + ' slips aside for no damage.' : ', dealing ' + ex.dmg + ' damage' + (ex.crit ? ' — a critical hit!' : '.')) }
    ], { max_tokens: 90, temperature: 1.0 });
    return String(txt).trim().replace(/^["']|["']$/g,'');
  } catch (e) {
    return cannedLine(a.name, d.name, ex);
  }
}
function cannedLine(a, d, ex){
  if (ex.dodge) return d + ' reads it perfectly and slips away — nothing lands.';
  let line = CANNED[Math.floor(Math.random()*CANNED.length)].replace('{a}', a).replace('{d}', d);
  return ex.crit ? 'CRITICAL! ' + line : line;
}

/* ---------- portraits ---------- */
function portraitUrl(prompt, seed){
  const q = new URLSearchParams({ model: IMAGE_MODEL, width:'512', height:'512', seed:String(seed), nologo:'true' });
  return IMAGE_ENDPOINT + encodeURIComponent(prompt) + '?' + q.toString();
}
async function loadPortrait(imgEl, prompt, seed){
  const url = portraitUrl(prompt, seed);
  const key = getKey();
  imgEl.classList.remove('ready');
  // Try authenticated blob first (works with a Pollen key, bypasses hotlink quirks).
  if (key) {
    try {
      const res = await fetch(url, { headers:{ Authorization:'Bearer ' + key } });
      if (res.ok) {
        const blob = await res.blob();
        imgEl.onload = () => imgEl.classList.add('ready');
        imgEl.src = URL.createObjectURL(blob);
        return;
      }
    } catch {}
  }
  imgEl.onload = () => imgEl.classList.add('ready');
  imgEl.src = url;
}

/* ---------- DOM state ---------- */
const state = {
  player:null, enemy:null, seed:1, idx:0, boss:false,
  hp:{p:0,e:0}, maxHp:{p:0,e:0}, round:1, over:false, busy:false, auto:false,
};

function show(id, on=true){ $(id).classList.toggle('hidden', !on); }
function setStatus(id, msg, kind){ const el=$(id); el.textContent = msg||''; el.className = 'status' + (kind?' '+kind:''); }

function statList(f){
  const s = f.stats;
  return '<div><span>PWR</span><b>'+s.power+'</b></div>' +
         '<div><span>SPD</span><b>'+s.speed+'</b></div>' +
         '<div><span>CUN</span><b>'+s.cunning+'</b></div>' +
         '<div><span>GRT</span><b>'+s.grit+'</b></div>';
}
function renderFighter(prefix, f, hp, maxHp){
  $(prefix+'Name').textContent = f.name;
  $(prefix+'Title').textContent = f.title || '';
  $(prefix+'Stats').innerHTML = statList(f);
  $(prefix+'Style').textContent = f.style || '';
  $(prefix+'Abilities').innerHTML = (f.abilities||[]).map(a => '<li title="'+esc(a.effect)+'">'+esc(a.name)+'</li>').join('');
  setHp(prefix, hp, maxHp);
}
function setHp(prefix, hp, maxHp){
  const pct = clamp(hp / maxHp * 100, 0, 100);
  const bar = $(prefix+'Hp');
  bar.style.width = pct + '%';
  bar.classList.toggle('low', pct <= 30);
  $(prefix+'HpText').textContent = Math.max(0,hp) + ' / ' + maxHp;
}
function log(cls, html){ const el = $('battleLog'); const d = document.createElement('div'); d.className = cls; d.innerHTML = html; el.appendChild(d); el.scrollTop = el.scrollHeight; }
function clearLog(){ $('battleLog').innerHTML = ''; }

/* ---------- ladder UI ---------- */
function renderLadder(){
  const p = loadProgress();
  const ol = $('ladderList'); ol.innerHTML = '';
  CHALLENGERS.forEach((c, i) => {
    const locked = i > p.unlocked;
    const beaten = !!p.beaten[i];
    const li = document.createElement('li');
    li.innerHTML =
      '<div><span class="idx">#'+(i+1)+'</span> <b>'+esc(c.name)+'</b> — <span class="muted">'+esc(c.style)+'</span>' +
      '<div class="meta"><span>PWR '+c.stats.power+'</span><span>SPD '+c.stats.speed+'</span><span>CUN '+c.stats.cunning+'</span><span>GRT '+c.stats.grit+'</span></div></div>' +
      '<div>' + (beaten ? '<span class="done">✔ defeated</span>' : locked ? '<span class="lock">🔒 locked</span>' : '<span class="muted">ready</span>') + '</div>';
    li.dataset.idx = i;
    li.style.cursor = locked ? 'not-allowed' : 'pointer';
    li.style.opacity = locked ? .6 : 1;
    li.addEventListener('click', () => {
      if (locked) return;
      $('challengerSelect').value = String(i);
      $('descInput').scrollIntoView({ behavior:'smooth', block:'center' });
      $('descInput').focus();
    });
    ol.appendChild(li);
  });
  const select = $('challengerSelect');
  select.innerHTML = CHALLENGERS.map((c,i) => '<option value="'+i+'"'+(i>p.unlocked?' disabled':'')+'>'+esc(c.name)+(i>p.unlocked?' 🔒':'')+'</option>').join('');
  if (p.unlocked < CHALLENGERS.length) select.value = String(p.unlocked);
}

/* ---------- forge & fight flow ---------- */
function readSetup(){
  const desc = $('descInput').value.trim();
  const idx = Number($('challengerSelect').value || 0);
  const seed = clamp(Number($('seedInput').value) || 1, 1, 999999999);
  return { desc, idx, seed };
}

async function forgeAndFight(opts){
  if (state.busy) return;
  const { desc, idx, seed } = opts || readSetup();
  if (!desc || desc.length < 3) { setStatus('forgeStatus','Write a one-line fighter description first.','error'); return; }
  if (!getKey()) { pendingStart = { desc, idx, seed }; openKeyPanel('Add your Pollen key to forge fighters.'); return; }

  state.busy = true;
  show('arenaPanel', false);
  setStatus('forgeStatus','Forging "'+desc.slice(0,60)+'"…');
  $('forgeBtn').disabled = true; $('rollSeed').disabled = true;

  try {
    const player = await designFighter(desc);
    state.player = player;
    state.idx = idx; state.seed = seed; state.boss = !!opts && !!opts.boss;
    state.enemy = state.boss ? dailyBoss(CHALLENGERS[CHALLENGERS.length-1], seed) : challengerToFighter(CHALLENGERS[idx], seed);

    const seedNum = makeRng(seed).int(1, 999999);
    state.maxHp.p = hpOf(player); state.hp.p = state.maxHp.p;
    state.maxHp.e = hpOf(state.enemy); state.hp.e = state.maxHp.e;
    state.round = 1; state.over = false; state.auto = false;

    renderFighter('player', player, state.hp.p, state.maxHp.p);
    renderFighter('enemy', state.enemy, state.hp.e, state.maxHp.e);
    loadPortrait($('playerPortrait'), player.portrait, seedNum);
    loadPortrait($('enemyPortrait'), state.enemy.portrait, seedNum + 7);

    clearLog();
    log('sys','⚔️ ' + esc(player.name) + ' steps into the arena against ' + esc(state.enemy.name) + '.');
    log('e','"' + esc(state.enemy.taunt) + '"');
    log('p','"' + esc(player.taunt) + '"');

    show('arenaPanel', true);
    show('nextRoundBtn', true); show('autoBtn', true);
    show('rematchBtn', false); show('newFighterBtn', false);
    $('playerCard').className = 'card fighter-card';
    $('enemyCard').className = 'card fighter-card';
    setStatus('forgeStatus','');
    show('shareBtn', true);
    $('arenaPanel').scrollIntoView({ behavior:'smooth', block:'start' });
  } catch (e) {
    setStatus('forgeStatus', errMsg(e), 'error');
  } finally {
    state.busy = false;
    $('forgeBtn').disabled = false; $('rollSeed').disabled = false;
  }
}

async function nextRound(){
  if (state.busy || state.over) return;
  state.busy = true;
  $('nextRoundBtn').disabled = true; $('autoBtn').disabled = true;
  setStatus('arenaStatus','');

  const rng = makeRng((state.seed * 7919) + state.round * 104729 + (state.boss ? 13 : 0));
  const p = state.player, e = state.enemy;
  log('round','— ROUND ' + state.round + ' —');

  try {
    const pFirst = (p.stats.speed + rng.int(1,6)) >= (e.stats.speed + rng.int(1,6));
    const order = pFirst ? [[p,e,'p'],[e,p,'e']] : [[e,p,'e'],[p,e,'p']];
    let ended = false;

    for (const [att, def, who] of order) {
      if (state.hp.p <= 0 || state.hp.e <= 0) break;
      const ex = exchange(att, def, rng);
      const defHpBefore = who === 'p' ? state.hp.e : state.hp.p;
      if (ex.dmg > 0) { if (who === 'p') state.hp.e -= ex.dmg; else state.hp.p -= ex.dmg; }
      const defHpAfter = who === 'p' ? state.hp.e : state.hp.p;

      // show the mechanical hit immediately
      const cls = who === 'p' ? 'p' : 'e';
      log(cls, '<b>' + esc(att.name) + '</b> ' + (ex.dodge ? 'attacks — <i>dodged!</i>' : 'hits for <b>' + ex.dmg + '</b>' + (ex.crit ? ' (CRITICAL)' : '')));

      // AI commentary (awaited so turns feel deliberate; falls back on error)
      const line = await commentate(att, def, ex, state.round, state.hp.p, state.hp.e);
      log('sys','“' + esc(line) + '”');

      if (who === 'p') setHp('enemy', state.hp.e, state.maxHp.e); else setHp('player', state.hp.p, state.maxHp.p);

      if (defHpAfter <= 0) {
        ended = true;
        log('ko','💥 ' + esc(def.name) + ' is down! ' + esc(att.name) + ' wins.');
        finishFight(who === 'p');
        break;
      }
    }
    if (!ended) state.round++;
    if (!ended && state.round > 12) { // safety cap: decide by hp
      const playerWins = state.hp.p >= state.hp.e;
      log('ko','⏱️ The bell rings — judges award it to ' + esc(playerWins ? p.name : e.name) + '.');
      finishFight(playerWins);
    }
  } catch (e) {
    setStatus('arenaStatus', errMsg(e), 'error');
  } finally {
    state.busy = false;
    $('nextRoundBtn').disabled = false; $('autoBtn').disabled = false;
    if (!state.over) { show('nextRoundBtn', true); show('autoBtn', true); }
    if (state.auto && !state.over) setTimeout(() => { if (state.auto) nextRound(); }, 350);
  }
}

function finishFight(playerWins){
  state.over = true; state.auto = false;
  show('nextRoundBtn', false); show('autoBtn', false);
  show('rematchBtn', true); show('newFighterBtn', true);
  $('playerCard').classList.add(playerWins ? 'win' : 'lose');
  $('enemyCard').classList.add(playerWins ? 'lose' : 'win');

  if (playerWins && !state.boss) {
    const p = loadProgress();
    if (state.idx === p.unlocked && p.unlocked < CHALLENGERS.length - 1) p.unlocked = state.idx + 1;
    p.beaten[state.idx] = true;
    saveProgress(p);
    renderLadder();
  }
}

function errMsg(e){
  if (e instanceof ApiError) return '⚠️ ' + e.message;
  return '⚠️ ' + (e && e.message ? e.message : 'Something went wrong. Try again.');
}

/* ---------- share links ---------- */
function buildShareLink(){
  const { desc, idx, seed } = readSetup();
  const hash = 'f=' + b64e(desc) + '&c=' + idx + '&s=' + seed + (state.boss ? '&boss=1' : '');
  return location.origin + location.pathname + '#' + hash;
}
async function copyShare(){
  try { await navigator.clipboard.writeText(buildShareLink()); setStatus('forgeStatus','🔗 Share link copied — it replays this exact fight seed.','ok'); }
  catch { setStatus('forgeStatus', buildShareLink(), 'ok'); }
}
function readHash(){
  const h = location.hash.replace(/^#/,'');
  if (!h) return null;
  const q = new URLSearchParams(h);
  if (!q.get('f')) return null;
  try {
    return { desc: b64d(q.get('f')), idx: clamp(Number(q.get('c')||0),0,CHALLENGERS.length-1), seed: clamp(Number(q.get('s')||1),1,999999999), boss: q.get('boss') === '1' };
  } catch { return null; }
}

/* ---------- key panel ---------- */
let pendingStart = null;
function openKeyPanel(msg){
  show('keyPanel', true);
  setStatus('keyStatus', msg || (getKey() ? 'A key is stored in this browser.' : 'No key stored yet.'));
  $('keyPanel').scrollIntoView({ behavior:'smooth', block:'start' });
  $('keyInput').focus();
}
function initKeyPanel(){
  const k = getKey();
  setStatus('keyStatus', k ? '🔑 A key is stored in this browser (hidden).' : 'No key stored yet.');
}

/* ---------- wiring ---------- */
function newSeed(){ $('seedInput').value = String(Math.floor(Math.random()*999999998)+1); }

function init(){
  $('seedInput').value = String(Math.floor(Math.random()*999999998)+1);
  renderLadder();
  initKeyPanel();

  $('keyBtn').addEventListener('click', () => { $('keyPanel').classList.contains('hidden') ? openKeyPanel() : show('keyPanel', false); });
  $('keySave').addEventListener('click', () => {
    const v = $('keyInput').value.trim();
    if (!v) { setStatus('keyStatus','Paste a key first.','error'); return; }
    setKey(v); $('keyInput').value = '';
    setStatus('keyStatus','🔑 Key saved locally. It is only sent to gen.pollinations.ai.','ok');
    if (pendingStart) { const p = pendingStart; pendingStart = null; forgeAndFight(p); }
  });
  $('keyClear').addEventListener('click', () => { setKey(''); setStatus('keyStatus','Key removed from this browser.','ok'); });

  $('rollSeed').addEventListener('click', newSeed);
  $('forgeBtn').addEventListener('click', () => forgeAndFight());
  $('shareBtn').addEventListener('click', copyShare);

  $('nextRoundBtn').addEventListener('click', nextRound);
  $('autoBtn').addEventListener('click', () => { state.auto = true; show('autoBtn', false); show('nextRoundBtn', false); nextRound(); });
  $('rematchBtn').addEventListener('click', () => forgeAndFight({ desc: readSetup().desc, idx: state.idx, seed: state.seed, boss: state.boss }));
  $('newFighterBtn').addEventListener('click', () => { show('arenaPanel', false); show('shareBtn', false); $('descInput').scrollIntoView({behavior:'smooth',block:'center'}); $('descInput').focus(); });

  $('dailyBossBtn').addEventListener('click', () => {
    const desc = $('descInput').value.trim();
    if (!desc) { setStatus('forgeStatus','Describe your fighter above, then fight the daily boss.','error'); $('descInput').scrollIntoView({behavior:'smooth',block:'center'}); return; }
    newSeed();
    forgeAndFight({ desc, idx: CHALLENGERS.length-1, seed: todaySeed(), boss: true });
  });
  $('resetProgress').addEventListener('click', () => { saveProgress({ unlocked:0, beaten:{} }); renderLadder(); });

  // handle share link
  const shared = readHash();
  if (shared) {
    $('descInput').value = shared.desc;
    if (!shared.boss) { const p = loadProgress(); if (shared.idx <= p.unlocked) $('challengerSelect').value = String(shared.idx); }
    $('seedInput').value = String(shared.seed);
    setStatus('forgeStatus','📥 Loaded a shared fighter. ' + (getKey() ? 'Fight!' : 'Add your Pollen key to run it.'), 'ok');
    if (getKey()) forgeAndFight(shared); else pendingStart = shared;
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
