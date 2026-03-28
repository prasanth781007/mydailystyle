// ============================================================
//  store.js – MyDailyStyle Store (Inventory) Logic
// ============================================================

// Toast helper
function showToast(msg, type='info') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  const icons = { success:'fa-circle-check', error:'fa-circle-xmark', info:'fa-circle-info' };
  t.innerHTML = `<i class="fa-solid ${icons[type]}"></i><span>${msg}</span>`;
  c.appendChild(t);
  setTimeout(() => { t.style.animation='fadeOut 0.4s ease forwards'; setTimeout(()=>t.remove(),400); }, 3500);
}

// ── State ─────────────────────────────────────────────────
let allItems    = [];
let customCats  = [];     // [{ id, name, base }]
let activeFilter= 'all';
let searchQuery = '';
let pendingFile = null;
let uid         = null;
let pendingDeleteId = null;

const BASE_CATS = ['top','bottom','shoes','accessories'];
const CAT_ICONS = { top:'fa-shirt', bottom:'fa-person-dress', shoes:'fa-shoe-prints', accessories:'fa-gem' };
const CAT_LABELS= { top:'Top',     bottom:'Bottom',          shoes:'Shoes',          accessories:'Accessories' };
const CAT_BADGE = { top:'cat-top', bottom:'cat-bottom',      shoes:'cat-shoes',      accessories:'cat-accessories' };

// ── Auth Guard ─────────────────────────────────────────────
requireAuth(async user => {
  uid = user.uid;

  // Set avatar
  const initials = (user.displayName || user.email || 'U').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
  document.getElementById('userAvatar').textContent = initials;

  // Load everything
  await Promise.all([loadCategories(), loadStore()]);
  setupListeners();
});

// ── Categories Logic ───────────────────────────────────────
async function loadCategories() {
  try {
    const snap = await db.collection('users').doc(uid).collection('categories').get();
    customCats = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderCategoryUI();
  } catch (err) {
    console.error("Error loading categories:", err);
  }
}

function renderCategoryUI() {
  // 1. Render Manage Modal List
  const list = document.getElementById('customCatsList');
  if (customCats.length === 0) {
    list.innerHTML = '<p style="text-align:center;color:var(--text-muted);font-size:0.8rem;padding:20px;">No custom categories yet.</p>';
  } else {
    list.innerHTML = customCats.map(c => `
      <div style="display:flex;align-items:center;justify-content:space-between;background:var(--bg-glass);padding:10px 15px;border-radius:10px;border:1px solid var(--border-glass);">
        <div>
          <span style="font-weight:600;font-size:0.9rem;">${c.name}</span>
          <small style="color:var(--text-muted);margin-left:8px;">(in ${CAT_LABELS[c.base]})</small>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="deleteCategory('${c.id}')" style="padding:5px 10px;color:var(--error);"><i class="fa-solid fa-trash-can"></i></button>
      </div>
    `).join('');
  }

  // 2. Render Add Item Form Selector
  const selector = document.getElementById('catSelector');
  let html = '';
  
  // Add Base Cats
  BASE_CATS.forEach(c => {
    html += `
      <label class="cat-pick-btn" data-cat="${c}">
        <input type="radio" name="category" value="${c}" style="display:none;" required />
        <i class="fa-solid ${CAT_ICONS[c]}"></i>
        <span>${CAT_LABELS[c]}</span>
        <small>Primary ${CAT_LABELS[c]}</small>
      </label>`;
  });

  // Add Custom Cats
  customCats.forEach(c => {
    html += `
      <label class="cat-pick-btn" data-cat="${c.id}">
        <input type="radio" name="category" value="${c.id}" style="display:none;" />
        <i class="fa-solid ${CAT_ICONS[c.base]}"></i>
        <span>${c.name}</span>
        <small>${CAT_LABELS[c.base]} Type</small>
      </label>`;
  });
  selector.innerHTML = html;

  // Re-attach listeners to new radio buttons
  selector.querySelectorAll('.cat-pick-btn').forEach(lbl => {
    lbl.addEventListener('click', () => {
      selector.querySelectorAll('.cat-pick-btn').forEach(l => l.classList.remove('selected'));
      lbl.classList.add('selected');
      lbl.querySelector('input').checked = true;
    });
  });

  // 3. Render Filter Tabs
  const filters = document.getElementById('filterTabs');
  let filterHtml = '<button class="filter-tab active" data-cat="all">All</button>';
  BASE_CATS.forEach(c => {
    filterHtml += `<button class="filter-tab" data-cat="${c}">${CAT_LABELS[c]}s</button>`;
  });
  customCats.forEach(c => {
    filterHtml += `<button class="filter-tab" data-cat="${c.id}">${c.name}</button>`;
  });
  filters.innerHTML = filterHtml;

  // Re-attach listeners to new filter tabs
  filters.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      filters.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeFilter = tab.dataset.cat;
      renderStore();
    });
  });
}

async function deleteCategory(id) {
  if (!confirm("Are you sure? Items in this category will still exist but will be un-categorized.")) return;
  try {
    await db.collection('users').doc(uid).collection('categories').doc(id).delete();
    showToast("Category removed.", "info");
    await loadCategories();
  } catch (err) {
    showToast("Failed to delete category.", "error");
  }
}

// ── Load + Render Store ────────────────────────────────────
async function loadStore() {
  const grid = document.getElementById('storeGrid');
  grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;"><div class="spinner"></div></div>';
  try {
    const snap = await db.collection('users').doc(uid).collection('store').orderBy('createdAt','desc').get();
    allItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    document.getElementById('storeCountLabel').textContent = allItems.length;
    renderStore();
  } catch (err) {
    grid.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:40px;">Failed to load store.</p>';
  }
}

function renderStore() {
  const grid  = document.getElementById('storeGrid');
  let filtered = allItems.filter(item => {
    // Check if match specific category OR if filter is a base category, check if item's category maps to it
    if (activeFilter === 'all') return item.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    const isBaseFilter = BASE_CATS.includes(activeFilter);
    let matchCat = false;
    
    if (isBaseFilter) {
      // If item is base cat, match directly. If item is custom cat, check if its base matches the filter.
      if (item.category === activeFilter) matchCat = true;
      else {
        const custom = customCats.find(c => c.id === item.category);
        if (custom && custom.base === activeFilter) matchCat = true;
      }
    } else {
      // It's a custom filter
      matchCat = (item.category === activeFilter);
    }
    
    return matchCat && item.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="empty-state"><i class="fa-solid fa-shirt"></i><h3>No items found</h3><p>Add your first item to get started!</p></div>`;
    return;
  }

  grid.innerHTML = filtered.map(item => {
    const isCustom = !BASE_CATS.includes(item.category);
    const catObj   = isCustom ? (customCats.find(c => c.id === item.category) || { name:'Custom', base:'top' }) : null;
    const baseIcon = isCustom ? CAT_ICONS[catObj.base] : CAT_ICONS[item.category];
    const badgeLabel = isCustom ? catObj.name : CAT_LABELS[item.category];
    const badgeClass = isCustom ? CAT_BADGE[catObj.base] : CAT_BADGE[item.category];

    return `
    <div class="item-card" data-id="${item.id}">
      ${item.imageUrl
        ? `<img src="${item.imageUrl}" alt="${item.name}" class="item-card-img" />`
        : `<div class="item-card-img-placeholder"><i class="fa-solid ${baseIcon}"></i></div>`
      }
      <div class="item-card-body">
        <div class="item-card-name">${item.name}</div>
        <span class="category-badge ${badgeClass}">${badgeLabel}</span>
      </div>
      <div class="item-card-actions">
        <button class="item-card-btn item-card-btn-del" data-id="${item.id}" title="Delete"><i class="fa-solid fa-trash-can"></i></button>
      </div>
    </div>`;
  }).join('');

  grid.querySelectorAll('.item-card-btn-del').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      pendingDeleteId = btn.dataset.id;
      document.getElementById('confirmDeleteOverlay').classList.add('open');
    });
  });
}

// ── Listeners ──────────────────────────────────────────────
function setupListeners() {
  document.getElementById('storeSearch').addEventListener('input', e => { searchQuery = e.target.value; renderStore(); });

  document.getElementById('openAddModal').addEventListener('click', () => openModal());
  document.getElementById('closeAddModal').addEventListener('click', closeModal);
  document.getElementById('cancelAdd').addEventListener('click', closeModal);
  document.getElementById('addModal').addEventListener('click', e => { if (e.target.id === 'addModal') closeModal(); });

  // Manage Cats Modal
  document.getElementById('openManageCats').addEventListener('click', () => document.getElementById('manageCatsModal').classList.add('open'));
  document.getElementById('closeManageCats').addEventListener('click', () => document.getElementById('manageCatsModal').classList.remove('open'));

  // Add Category
  document.getElementById('addCatForm').addEventListener('submit', async e => {
    e.preventDefault();
    const name = document.getElementById('newCatName').value.trim();
    const base = document.getElementById('newCatBase').value;
    const btn  = document.getElementById('saveCatBtn');
    if (!name) return;

    btn.disabled = true;
    try {
      await db.collection('users').doc(uid).collection('categories').add({ name, base, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      document.getElementById('addCatForm').reset();
      showToast("Category added!", "success");
      await loadCategories();
    } catch (err) {
      showToast("Error adding category.", "error");
    } finally {
      btn.disabled = false;
    }
  });

  // Image helpers
  function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    pendingFile = file;
    const reader = new FileReader();
    reader.onload = e => { document.getElementById('previewImg').src = e.target.result; document.getElementById('previewWrap').style.display = 'block'; };
    reader.readAsDataURL(file);
  }
  ['itemImageGallery','itemImageCamera','itemImageGallery2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', e => handleFile(e.target.files[0]));
  });

  // Auto-categorize (updated to suggest based on keywords)
  document.getElementById('itemName').addEventListener('input', e => {
    const name = e.target.value.toLowerCase();
    const keywords = {
      top: ['shirt', 'top', 'hoodie', 'jacket', 't-shirt', 'kurta'],
      bottom: ['pant', 'jeans', 'shorts', 'skirt', 'joggers'],
      shoes: ['shoe', 'sneaker', 'boot', 'sandal'],
      accessories: ['watch', 'belt', 'hat', 'bag', 'jewelry']
    };
    let guess = null;
    for (const [cat, words] of Object.entries(keywords)) { if (words.some(w => name.includes(w))) { guess = cat; break; } }
    
    if (guess) {
      document.getElementById('catGuessHint').style.display = 'inline';
      // Highlight the first match found in selector
      const lbl = document.querySelector(`#catSelector .cat-pick-btn[data-cat="${guess}"]`);
      if (lbl) {
        document.querySelectorAll('#catSelector .cat-pick-btn').forEach(l => l.classList.remove('selected'));
        lbl.classList.add('selected');
        lbl.querySelector('input').checked = true;
      }
    } else {
      document.getElementById('catGuessHint').style.display = 'none';
    }
  });

  const zone = document.getElementById('uploadZone');
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.style.borderColor='var(--accent-2)'; });
  zone.addEventListener('dragleave', () => { zone.style.borderColor=''; });
  zone.addEventListener('drop', e => { e.preventDefault(); zone.style.borderColor=''; handleFile(e.dataTransfer.files[0]); });

  document.getElementById('removePreview').addEventListener('click', () => {
    pendingFile = null;
    document.getElementById('previewWrap').style.display = 'none';
    ['itemImageGallery','itemImageCamera','itemImageGallery2'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  });

  document.getElementById('addItemForm').addEventListener('submit', saveItem);
  document.getElementById('cancelDelete').addEventListener('click', () => { pendingDeleteId = null; document.getElementById('confirmDeleteOverlay').classList.remove('open'); });
  document.getElementById('confirmDelete').addEventListener('click', deleteItem);
}

function openModal() {
  document.getElementById('addItemForm').reset();
  document.getElementById('addItemError').textContent = '';
  document.getElementById('previewWrap').style.display = 'none';
  document.getElementById('uploadProgress').style.display = 'none';
  document.getElementById('catGuessHint').style.display = 'none';
  document.querySelectorAll('#catSelector .cat-pick-btn').forEach(l => l.classList.remove('selected'));
  pendingFile = null;
  document.getElementById('addModal').classList.add('open');
}
function closeModal() { document.getElementById('addModal').classList.remove('open'); }

async function saveItem(e) {
  e.preventDefault();
  const errEl   = document.getElementById('addItemError');
  const btn     = document.getElementById('saveItemBtn');
  const catInput= document.querySelector('#catSelector input[name="category"]:checked');
  const name    = document.getElementById('itemName').value.trim();

  if (!catInput) { errEl.textContent = 'Please select a category.'; return; }
  if (!name)     { errEl.textContent = 'Item name is required.'; return; }

  const orig = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving…';

  let imageUrl = '';
  if (pendingFile) {
    try {
      document.getElementById('uploadProgress').style.display = 'block';
      imageUrl = await uploadToCloudinary(pendingFile);
    } catch (err) {
      errEl.textContent = "Image upload failed.";
      btn.disabled = false; btn.innerHTML = orig; return;
    }
  }

  try {
    await db.collection('users').doc(uid).collection('store').add({
      name, category: catInput.value, imageUrl, createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    showToast(`"${name}" saved!`, 'success');
    closeModal();
    await loadStore();
  } catch (err) {
    errEl.textContent = 'Error: ' + err.message;
  } finally {
    btn.disabled = false; btn.innerHTML = orig;
  }
}

async function deleteItem() {
  if (!pendingDeleteId) return;
  document.getElementById('confirmDeleteOverlay').classList.remove('open');
  try {
    await db.collection('users').doc(uid).collection('store').doc(pendingDeleteId).delete();
    showToast('Item deleted.', 'info');
    await loadStore();
  } catch (err) {
    showToast('Failed to delete.', 'error');
  }
}
