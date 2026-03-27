// ============================================================
//  planner.js – MyDailyStyle Outfit Planner Logic
// ============================================================

const CATS       = ['top','bottom','shoes','accessories'];
const CAT_ICONS  = { top:'fa-shirt', bottom:'fa-person-dress', shoes:'fa-shoe-prints', accessories:'fa-gem' };
const CAT_LABELS = { top:'Top',      bottom:'Bottom',          shoes:'Shoes',          accessories:'Accessories' };
const CAT_COLORS = { top:'var(--accent-3)', bottom:'#60a5fa', shoes:'#f472b6', accessories:'#fbbf24' };

// Toast helper
function showToast(msg, type='info'){
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  const icons = { success:'fa-circle-check', error:'fa-circle-xmark', info:'fa-circle-info' };
  t.innerHTML = `<i class="fa-solid ${icons[type]}"></i><span>${msg}</span>`;
  c.appendChild(t);
  setTimeout(()=>{ t.style.animation='fadeOut 0.4s ease forwards'; setTimeout(()=>t.remove(),400); }, 3500);
}

// ── State ──────────────────────────────────────────────────
let uid           = null;
let allStoreItems = [];      // All items from Firestore store
let allSchedules  = {};      // { 'yyyy-mm-dd': { top_id, bottom_id, shoes_id, accessories_id } }
let selectedDate  = null;    // Currently chosen date string
let selections    = { top: null, bottom: null, shoes: null, accessories: null };

// Calendar state
let calYear  = null;
let calMonth = null;

const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS   = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// Date string helpers
function todayStr(){
  const d=new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function dateStr(y,m,d){ return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; }
function friendlyDate(s){
  const [y,m,d]=s.split('-').map(Number);
  return new Date(y,m-1,d).toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
}

// ── Auth Guard ─────────────────────────────────────────────
requireAuth(async user => {
  uid = user.uid;
  const initials = (user.displayName||user.email||'U').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
  document.getElementById('userAvatar').textContent = initials;

  // Init calendar to today's month
  const now = new Date();
  calYear  = now.getFullYear();
  calMonth = now.getMonth();

  // Load data in parallel
  await Promise.all([ loadStore(), loadAllSchedules() ]);

  buildCalendar();

  // Check for ?date= param (link from dashboard)
  const params = new URLSearchParams(window.location.search);
  const preDate = params.get('date');
  if (preDate) selectDate(preDate);

  setupCalNavListeners();
});

// ── Load Store Items ───────────────────────────────────────
async function loadStore(){
  const snap = await db.collection('users').doc(uid).collection('store').orderBy('createdAt','desc').get();
  allStoreItems = snap.docs.map(d=>({ id:d.id, ...d.data() }));
}

// ── Load All Schedules ─────────────────────────────────────
async function loadAllSchedules(){
  const snap = await db.collection('users').doc(uid).collection('schedule').get();
  allSchedules = {};
  snap.docs.forEach(d => { allSchedules[d.id] = d.data(); });
  updatePlannedCount();
}
function updatePlannedCount(){
  const today = todayStr();
  const future = Object.keys(allSchedules).filter(k => k >= today).length;
  document.getElementById('pillPlanned').textContent = future;
}

// ── Calendar ───────────────────────────────────────────────
function buildCalendar(){
  document.getElementById('calMonthLabel').textContent = `${MONTHS[calMonth]} ${calYear}`;

  const grid = document.getElementById('calGrid');
  grid.innerHTML = '';

  // Day headers
  WEEKDAYS.forEach(d => {
    const h = document.createElement('div');
    h.className = 'calendar-day-header';
    h.textContent = d;
    grid.appendChild(h);
  });

  const firstDay  = new Date(calYear, calMonth, 1).getDay();
  const daysInMon = new Date(calYear, calMonth+1, 0).getDate();
  const today     = todayStr();

  // Blank cells before first day
  for (let i=0; i<firstDay; i++){
    const prev   = new Date(calYear, calMonth, -firstDay+1+i);
    const cell   = makeCalCell(prev.getFullYear(), prev.getMonth(), prev.getDate(), true);
    grid.appendChild(cell);
  }

  // Month days
  for (let d=1; d<=daysInMon; d++){
    const cell = makeCalCell(calYear, calMonth, d, false);
    grid.appendChild(cell);
  }

  // Fill remaining cells
  const total = firstDay + daysInMon;
  const remainder = (7 - (total % 7)) % 7;
  for (let d=1; d<=remainder; d++){
    const next = new Date(calYear, calMonth+1, d);
    const cell = makeCalCell(next.getFullYear(), next.getMonth(), next.getDate(), true);
    grid.appendChild(cell);
  }
}

function makeCalCell(y, m, d, otherMonth){
  const ds   = dateStr(y, m, d);
  const div  = document.createElement('div');
  div.className = 'calendar-day';
  div.dataset.date = ds;

  const today = todayStr();
  if (ds === today) div.classList.add('today');
  if (otherMonth)   div.classList.add('other-month');
  if (ds === selectedDate) div.classList.add('selected');
  if (allSchedules[ds])    div.classList.add('has-outfit');

  div.innerHTML = `<span class="calendar-day-num">${d}</span>`;

  // Thumbnails from schedule
  if (allSchedules[ds]) {
    const sched = allSchedules[ds];
    const ids = [sched.top_id, sched.bottom_id, sched.shoes_id, sched.accessories_id].filter(Boolean).slice(0,2);
    const items = ids.map(id => allStoreItems.find(it=>it.id===id)).filter(Boolean);
    if (items.length > 0) {
      const row = document.createElement('div');
      row.className = 'calendar-thumb-row';
      items.forEach(it => {
        if (it.imageUrl) {
          const img = document.createElement('img');
          img.src = it.imageUrl; img.className = 'calendar-thumb';
          img.alt = it.name;
          row.appendChild(img);
        }
      });
      div.appendChild(row);
    }
  }

  div.addEventListener('click', () => selectDate(ds));
  return div;
}

function setupCalNavListeners(){
  document.getElementById('prevMonth').addEventListener('click', ()=>{
    calMonth--;
    if (calMonth < 0){ calMonth=11; calYear--; }
    buildCalendar();
  });
  document.getElementById('nextMonth').addEventListener('click', ()=>{
    calMonth++;
    if (calMonth > 11){ calMonth=0; calYear++; }
    buildCalendar();
  });
}

// ── Select Date ────────────────────────────────────────────
function selectDate(ds){
  selectedDate = ds;

  // Update calendar highlighting
  document.querySelectorAll('.calendar-day').forEach(el => {
    el.classList.toggle('selected', el.dataset.date === ds);
  });

  // Update builder
  document.getElementById('noDateMsg').style.display     = 'none';
  document.getElementById('builderContent').style.display= 'block';
  document.getElementById('builderDateLabel').textContent = friendlyDate(ds);

  // Load existing schedule or default to empty
  const existing = allSchedules[ds] || {};
  selections = {
    top         : existing.top_id          || null,
    bottom      : existing.bottom_id       || null,
    shoes       : existing.shoes_id        || null,
    accessories : existing.accessories_id  || null
  };

  // Show / hide clear button
  const hasSched = !!allSchedules[ds];
  document.getElementById('clearOutfitBtn').style.display = hasSched ? 'inline-flex' : 'none';

  renderCatSections();
  renderMiniPreview();
}

// ── Render Category Sections ───────────────────────────────
function renderCatSections(){
  const wrap = document.getElementById('catSections');
  wrap.innerHTML = '';
  CATS.forEach(cat => {
    const items = allStoreItems.filter(it => it.category === cat);
    const section = document.createElement('div');
    section.className = 'cat-builder-section';
    section.id = `cat-sect-${cat}`;

    section.innerHTML = `
      <div class="cat-builder-head">
        <div class="cat-builder-label" style="color:${CAT_COLORS[cat]}">
          <i class="fa-solid ${CAT_ICONS[cat]}"></i>
          <span>${CAT_LABELS[cat]}</span>
          <span id="sel-label-${cat}" style="font-size:0.75rem;color:var(--text-muted);font-weight:400;"></span>
        </div>
        ${items.length > 3 ? `
        <div class="cat-search-wrap">
          <i class="fa-solid fa-magnifying-glass"></i>
          <input type="text" class="cat-builder-search" id="cat-search-${cat}" placeholder="Search ${CAT_LABELS[cat]}…" />
        </div>` : ''}
      </div>
      <div class="cat-items-scroll" id="cat-items-${cat}"></div>`;

    wrap.appendChild(section);

    renderCatItems(cat, items, '');

    // Search listener
    const srch = document.getElementById(`cat-search-${cat}`);
    if (srch) {
      srch.addEventListener('input', e => {
        const q = e.target.value.toLowerCase();
        const filtered = allStoreItems.filter(it => it.category===cat && it.name.toLowerCase().includes(q));
        renderCatItems(cat, filtered, q);
      });
    }
  });
}

function renderCatItems(cat, items, query){
  const row = document.getElementById(`cat-items-${cat}`);
  row.innerHTML = '';

  // "None" card to clear selection
  const noneCard = document.createElement('div');
  noneCard.className = 'none-card';
  noneCard.innerHTML = '<i class="fa-solid fa-xmark"></i><span>None</span>';
  noneCard.addEventListener('click', () => {
    selections[cat] = null;
    renderCatItems(cat, allStoreItems.filter(it=>it.category===cat), '');
    updateSelLabel(cat, null);
    renderMiniPreview();
  });
  row.appendChild(noneCard);

  if (items.length === 0) {
    const emp = document.createElement('div');
    emp.style.cssText = 'padding:14px 10px;color:var(--text-muted);font-size:0.8rem;';
    emp.textContent = query ? 'No matches.' : 'No items in this category. Add some in the Store!';
    row.appendChild(emp);
    return;
  }

  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'cat-item-card' + (selections[cat]===item.id ? ' selected' : '');
    card.innerHTML = `
      <div class="cat-item-check"><i class="fa-solid fa-check"></i></div>
      ${item.imageUrl
        ? `<img src="${item.imageUrl}" alt="${item.name}" loading="lazy" />`
        : `<div class="cat-item-placeholder"><i class="fa-solid ${CAT_ICONS[cat]}"></i></div>`
      }
      <div class="cat-item-name">${item.name}</div>`;

    card.addEventListener('click', () => {
      // Toggle selection
      if (selections[cat] === item.id) {
        selections[cat] = null;
      } else {
        selections[cat] = item.id;
      }
      document.querySelectorAll(`#cat-items-${cat} .cat-item-card`).forEach(c => {
        c.classList.toggle('selected', c === card && selections[cat] === item.id);
        c.querySelector('.cat-item-check').style.display = (c === card && selections[cat] === item.id) ? 'flex' : 'none';
      });
      if (selections[cat] === null) card.classList.remove('selected');
      updateSelLabel(cat, selections[cat] ? item.name : null);
      renderMiniPreview();
    });
    row.appendChild(card);
  });

  updateSelLabel(cat, selections[cat] ? (allStoreItems.find(it=>it.id===selections[cat]) || {}).name : null);
}

function updateSelLabel(cat, name){
  const el = document.getElementById(`sel-label-${cat}`);
  if (el) el.textContent = name ? `· ${name}` : '';
}

// ── Mini Preview ───────────────────────────────────────────
function renderMiniPreview(){
  const wrap = document.getElementById('outfitPreviewMini');
  wrap.innerHTML = '';
  CATS.forEach(cat => {
    const item = selections[cat] ? allStoreItems.find(it=>it.id===selections[cat]) : null;
    if (item && item.imageUrl) {
      wrap.innerHTML += `<img src="${item.imageUrl}" class="outfit-mini-thumb" title="${item.name}" />`;
    } else {
      wrap.innerHTML += `<div class="outfit-mini-placeholder" title="${CAT_LABELS[cat]}"><i class="fa-solid ${CAT_ICONS[cat]}"></i></div>`;
    }
  });
}

// ── Save Outfit ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('saveOutfitBtn').addEventListener('click', saveOutfit);
  document.getElementById('clearOutfitBtn').addEventListener('click', clearOutfit);
});

async function saveOutfit(){
  if (!selectedDate) return;
  const btn  = document.getElementById('saveOutfitBtn');
  const orig = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving…';

  try {
    const data = {
      top_id         : selections.top          || null,
      bottom_id      : selections.bottom       || null,
      shoes_id       : selections.shoes        || null,
      accessories_id : selections.accessories  || null,
      updatedAt      : firebase.firestore.FieldValue.serverTimestamp()
    };
    await db.collection('users').doc(uid).collection('schedule').doc(selectedDate).set(data, { merge: true });
    allSchedules[selectedDate] = data;
    updatePlannedCount();
    buildCalendar();           // Refresh calendar dots & thumbs
    // Restore selection highlight
    document.querySelectorAll('.calendar-day').forEach(el=>{
      el.classList.toggle('selected', el.dataset.date===selectedDate);
    });
    document.getElementById('clearOutfitBtn').style.display = 'inline-flex';
    showToast('Outfit saved for ' + friendlyDate(selectedDate), 'success');
  } catch (err) {
    console.error(err);
    showToast('Failed to save outfit.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = orig;
  }
}

async function clearOutfit(){
  if (!selectedDate) return;
  if (!confirm(`Clear the outfit for ${friendlyDate(selectedDate)}?`)) return;
  try {
    await db.collection('users').doc(uid).collection('schedule').doc(selectedDate).delete();
    delete allSchedules[selectedDate];
    selections = { top:null, bottom:null, shoes:null, accessories:null };
    updatePlannedCount();
    buildCalendar();
    document.querySelectorAll('.calendar-day').forEach(el=>{
      el.classList.toggle('selected', el.dataset.date===selectedDate);
    });
    document.getElementById('clearOutfitBtn').style.display = 'none';
    renderCatSections();
    renderMiniPreview();
    showToast('Outfit cleared.', 'info');
  } catch (err) {
    showToast('Failed to clear outfit.', 'error');
  }
}
