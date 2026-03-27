// ============================================================
//  dashboard.js – MyDailyStyle Dashboard Logic
// ============================================================

const CATS = ['top','bottom','shoes','accessories'];
const CAT_ICONS = { top:'fa-shirt', bottom:'fa-person-dress', shoes:'fa-shoe-prints', accessories:'fa-gem' };
const CAT_LABELS= { top:'Top', bottom:'Bottom', shoes:'Shoes', accessories:'Accessories' };

// Toast Helper
function showToast(msg, type='info'){
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  const icons = { success:'fa-circle-check', error:'fa-circle-xmark', info:'fa-circle-info' };
  t.innerHTML = `<i class="fa-solid ${icons[type]}"></i><span>${msg}</span>`;
  c.appendChild(t);
  setTimeout(()=>{ t.style.animation='fadeOut 0.4s ease forwards'; setTimeout(()=>t.remove(),400); }, 3500);
}

// Today's date string yyyy-mm-dd
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// Friendly date display
function friendlyDate(dateStr) {
  const [y,m,d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m-1, d);
  return dt.toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
}
function shortDate(dateStr) {
  const [y,m,d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m-1, d);
  return dt.toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short' });
}

// Time-based greeting
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Morning';
  if (h < 17) return 'Afternoon';
  return 'Evening';
}

// Render a single outfit slot
function renderSlot(cat, item) {
  if (item) {
    return `
      <div class="outfit-slot filled">
        ${item.imageUrl
          ? `<img src="${item.imageUrl}" alt="${item.name}" class="outfit-slot-img loading-img" />`
          : `<div class="outfit-slot-img-placeholder"><i class="fa-solid ${CAT_ICONS[cat]}" style="font-size:2.5rem;color:var(--text-muted)"></i></div>`
        }
        <div class="outfit-slot-footer">
          <div class="outfit-slot-label">${CAT_LABELS[cat]}</div>
          <div class="outfit-slot-name">${item.name}</div>
        </div>
      </div>`;
  }
  return `
    <div class="outfit-slot">
      <div class="outfit-slot-empty">
        <i class="fa-solid ${CAT_ICONS[cat]}"></i>
        <span>${CAT_LABELS[cat]}</span>
      </div>
    </div>`;
}

// Fetch item details by ID
async function fetchItem(uid, itemId) {
  if (!itemId) return null;
  try {
    const snap = await db.collection('users').doc(uid).collection('store').doc(itemId).get();
    return snap.exists ? { id: snap.id, ...snap.data() } : null;
  } catch { return null; }
}

// main
requireAuth(async user => {

  // ── UI setup ────────────────────────────────────────────
  document.getElementById('timeGreeting').textContent = getGreeting();
  document.getElementById('dashUserName').textContent = user.displayName
    ? `${user.displayName.split(' ')[0]}'s Wardrobe`
    : 'Your Wardrobe';
  document.getElementById('dashDate').textContent = friendlyDate(todayStr());

  const initials = (user.displayName || user.email || 'U')
    .split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2);
  document.getElementById('userAvatar').textContent = initials;

  // ── Admin Check ───────────────────────────────────────
  const ADMIN_EMAILS = [
    "prasanth.kum22@gmail.com"
  ];
  if (ADMIN_EMAILS.includes(user.email)) {
    const nav = document.querySelector('.navbar-nav');
    if (nav) {
      const li = document.createElement('li');
      li.innerHTML = `<a href="admin.html" class="nav-link" style="color:var(--accent-gold)"><i class="fa-solid fa-shield-halved"></i> Admin</a>`;
      nav.appendChild(li);
    }
  }

  const uid = user.uid;

  // ── Fetch today's schedule ─────────────────────────────
  const today = todayStr();

  try {
    const schedSnap = await db.collection('users').doc(uid)
      .collection('schedule').doc(today).get();

    const outfitDiv = document.getElementById('todayOutfit');
    const actDiv    = document.getElementById('dashActions');

    if (schedSnap.exists) {
      const sched = schedSnap.data();
      // Fetch all 4 items in parallel
      const [top, bottom, shoes, acc] = await Promise.all([
        fetchItem(uid, sched.top_id),
        fetchItem(uid, sched.bottom_id),
        fetchItem(uid, sched.shoes_id),
        fetchItem(uid, sched.accessories_id)
      ]);
      outfitDiv.innerHTML =
        renderSlot('top',         top)       +
        renderSlot('bottom',      bottom)    +
        renderSlot('shoes',       shoes)     +
        renderSlot('accessories', acc);

      // Change action buttons if outfit is set
      actDiv.innerHTML = `
        <a href="planner.html?date=${today}" class="btn btn-secondary">
          <i class="fa-solid fa-pen-to-square"></i> Edit Today's Outfit
        </a>
        <a href="store.html" class="btn btn-secondary btn-sm">
          <i class="fa-solid fa-store"></i> Manage Store
        </a>`;
    } else {
      outfitDiv.innerHTML = `
        <div class="no-outfit-state" style="grid-column:1/-1">
          <i class="fa-solid fa-shirt"></i>
          <h3>No outfit planned for today</h3>
          <p>Head to the Planner to set today's look!</p>
        </div>`;
    }
  } catch (err) {
    console.error(err);
  }

  // ── Stats ──────────────────────────────────────────────
  try {
    const [storeSnap, schedSnap] = await Promise.all([
      db.collection('users').doc(uid).collection('store').get(),
      db.collection('users').doc(uid).collection('schedule').get()
    ]);
    document.getElementById('statItems').textContent   = storeSnap.size;
    const futureSched = schedSnap.docs.filter(d => d.id >= today);
    const pastSched   = schedSnap.docs.filter(d => d.id <  today);
    document.getElementById('statPlanned').textContent = futureSched.length;
    document.getElementById('statHistory').textContent = pastSched.length;
  } catch {}

  // ── Upcoming (next 7 days, excluding today) ────────────
  const upcomingEl = document.getElementById('upcomingList');
  try {
    const nextDays = [];
    for (let i = 1; i <= 7; i++) {
      const d = new Date(); d.setDate(d.getDate() + i);
      nextDays.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
    }
    const snaps = await Promise.all(
      nextDays.map(date => db.collection('users').doc(uid).collection('schedule').doc(date).get())
    );
    const upcoming = snaps.filter(s => s.exists).map(s => ({ date: s.id, ...s.data() }));

    if (upcoming.length === 0) {
      upcomingEl.innerHTML = `<div class="empty-state"><i class="fa-regular fa-calendar-xmark"></i><h3>Nothing planned yet</h3><p><a href="planner.html" style="color:var(--accent-3)">Open the Planner</a> to schedule your week.</p></div>`;
    } else {
      upcomingEl.innerHTML = '';
      for (const sched of upcoming) {
        const [top, bottom, shoes, acc] = await Promise.all([
          fetchItem(uid, sched.top_id),
          fetchItem(uid, sched.bottom_id),
          fetchItem(uid, sched.shoes_id),
          fetchItem(uid, sched.accessories_id)
        ]);
        const items = [top, bottom, shoes, acc].filter(Boolean);
        const thumbsHtml = items.map(it =>
          it.imageUrl
            ? `<img src="${it.imageUrl}" alt="${it.name}" class="history-thumb" />`
            : `<div class="history-thumb-placeholder"><i class="fa-solid ${CAT_ICONS[it.category]}"></i></div>`
        ).join('');
        const names = items.map(it => it.name).join(' · ');
        upcomingEl.innerHTML += `
          <a href="planner.html?date=${sched.date}" class="history-item" style="text-decoration:none;color:inherit;">
            <div class="history-thumbs">${thumbsHtml}</div>
            <div class="history-info">
              <div class="history-date"><i class="fa-regular fa-calendar"></i> ${shortDate(sched.date)}</div>
              <div class="history-names">${names || 'No items set'}</div>
            </div>
            <i class="fa-solid fa-chevron-right" style="color:var(--text-muted);font-size:0.8rem;"></i>
          </a>`;
      }
    }
  } catch (err) { upcomingEl.innerHTML = '<p style="color:var(--text-muted)">Could not load upcoming outfits.</p>'; }

  // ── History (past dates) ───────────────────────────────
  const histEl = document.getElementById('historyList');
  try {
    const allSched = await db.collection('users').doc(uid).collection('schedule')
      .orderBy(firebase.firestore.FieldPath.documentId(), 'desc').get();
    const past = allSched.docs.filter(d => d.id < today).slice(0, 15);

    if (past.length === 0) {
      histEl.innerHTML = `<div class="empty-state"><i class="fa-regular fa-clock"></i><h3>No history yet</h3><p>Past outfits will appear here after days go by.</p></div>`;
    } else {
      histEl.innerHTML = '';
      for (const doc of past) {
        const sched = doc.data();
        const [top, bottom, shoes, acc] = await Promise.all([
          fetchItem(uid, sched.top_id),
          fetchItem(uid, sched.bottom_id),
          fetchItem(uid, sched.shoes_id),
          fetchItem(uid, sched.accessories_id)
        ]);
        const items = [top, bottom, shoes, acc].filter(Boolean);
        const thumbsHtml = items.map(it =>
          it.imageUrl
            ? `<img src="${it.imageUrl}" alt="${it.name}" class="history-thumb" style="opacity:0.7;" />`
            : `<div class="history-thumb-placeholder"><i class="fa-solid ${CAT_ICONS[it.category]}"></i></div>`
        ).join('');
        const names = items.map(it => it.name).join(' · ');
        histEl.innerHTML += `
          <div class="history-item">
            <div class="history-thumbs">${thumbsHtml}</div>
            <div class="history-info">
              <div class="history-date"><i class="fa-solid fa-clock-rotate-left"></i> ${shortDate(doc.id)}</div>
              <div class="history-names">${names || 'Archived'}</div>
            </div>
            <span class="category-badge cat-top" style="font-size:0.65rem;">Past</span>
          </div>`;
      }
    }
  } catch { histEl.innerHTML = '<p style="color:var(--text-muted)">Could not load history.</p>'; }

  // ── Midnight auto-refresh ──────────────────────────────
  function scheduleMidnightRefresh() {
    const now  = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate()+1, 0, 0, 5);
    const msUntil = next - now;
    setTimeout(() => { location.reload(); }, msUntil);
  }
  scheduleMidnightRefresh();
});
