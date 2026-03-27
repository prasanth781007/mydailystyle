// ============================================================
//  store.js – MyDailyStyle Store (Inventory) Logic
// ============================================================

const CATS  = ['top','bottom','shoes','accessories'];
const CAT_ICONS = { top:'fa-shirt', bottom:'fa-person-dress', shoes:'fa-shoe-prints', accessories:'fa-gem' };
const CAT_LABELS= { top:'Top',     bottom:'Bottom',          shoes:'Shoes',          accessories:'Accessories' };
const CAT_BADGE = { top:'cat-top', bottom:'cat-bottom',      shoes:'cat-shoes',      accessories:'cat-accessories' };

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
let activeFilter= 'all';
let searchQuery = '';
let pendingFile = null;   // File object for upload
let uid         = null;
let pendingDeleteId = null;

// ── Auth Guard ─────────────────────────────────────────────
requireAuth(async user => {
  uid = user.uid;

  // Set avatar
  const initials = (user.displayName || user.email || 'U')
    .split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
  document.getElementById('userAvatar').textContent = initials;

  // Load store items
  await loadStore();
  setupListeners();
});

// ── Load + Render Store ────────────────────────────────────
async function loadStore() {
  const grid = document.getElementById('storeGrid');
  grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;"><div class="spinner"></div></div>';
  try {
    const snap = await db.collection('users').doc(uid).collection('store')
      .orderBy('createdAt','desc').get();
    allItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    document.getElementById('storeCountLabel').textContent = allItems.length;
    renderStore();
  } catch (err) {
    grid.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:40px;">Failed to load store.</p>';
    console.error(err);
  }
}

function renderStore() {
  const grid  = document.getElementById('storeGrid');
  let filtered = allItems.filter(item => {
    const matchCat  = activeFilter === 'all' || item.category === activeFilter;
    const matchName = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchName;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-shirt"></i>
        <h3>No items found</h3>
        <p>${allItems.length === 0 ? 'Add your first item to get started!' : 'Try a different filter or search term.'}</p>
      </div>`;
    return;
  }

  grid.innerHTML = filtered.map(item => `
    <div class="item-card" data-id="${item.id}">
      ${item.imageUrl
        ? `<img src="${item.imageUrl}" alt="${item.name}" class="item-card-img" loading="lazy" />`
        : `<div class="item-card-img-placeholder"><i class="fa-solid ${CAT_ICONS[item.category]}"></i></div>`
      }
      <div class="item-card-body">
        <div class="item-card-name">${item.name}</div>
        <span class="category-badge ${CAT_BADGE[item.category]}">${CAT_LABELS[item.category]}</span>
      </div>
      <div class="item-card-actions">
        <button class="item-card-btn item-card-btn-del" data-id="${item.id}" title="Delete">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
    </div>`
  ).join('');

  // Attach delete listeners
  grid.querySelectorAll('.item-card-btn-del').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      pendingDeleteId = btn.dataset.id;
      document.getElementById('confirmDeleteOverlay').classList.add('open');
    });
  });
}

// ── Setup Listeners ────────────────────────────────────────
function setupListeners() {

  // Search
  document.getElementById('storeSearch').addEventListener('input', e => {
    searchQuery = e.target.value;
    renderStore();
  });

  // Filter tabs
  document.querySelectorAll('#filterTabs .filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#filterTabs .filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeFilter = tab.dataset.cat;
      renderStore();
    });
  });

  // Add modal open / close
  document.getElementById('openAddModal').addEventListener('click', () => openModal());
  document.getElementById('closeAddModal').addEventListener('click', closeModal);
  document.getElementById('cancelAdd').addEventListener('click', closeModal);
  document.getElementById('addModal').addEventListener('click', e => {
    if (e.target === document.getElementById('addModal')) closeModal();
  });

  // Category picker
  document.querySelectorAll('#catSelector .cat-pick-btn').forEach(lbl => {
    lbl.addEventListener('click', () => {
      document.querySelectorAll('#catSelector .cat-pick-btn').forEach(l => l.classList.remove('selected'));
      lbl.classList.add('selected');
      lbl.querySelector('input').checked = true;
    });
  });

  // Image preview via gallery / drag & drop / camera
  function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    pendingFile = file;
    const reader = new FileReader();
    reader.onload = e => {
      document.getElementById('previewImg').src = e.target.result;
      document.getElementById('previewWrap').style.display = 'block';
    };
    reader.readAsDataURL(file);
  }

  ['itemImageGallery','itemImageCamera','itemImageGallery2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', e => handleFile(e.target.files[0]));
  });

  // Drag-and-drop on upload zone
  const zone = document.getElementById('uploadZone');
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.style.borderColor='var(--accent-2)'; });
  zone.addEventListener('dragleave', () => { zone.style.borderColor=''; });
  zone.addEventListener('drop', e => {
    e.preventDefault(); zone.style.borderColor='';
    handleFile(e.dataTransfer.files[0]);
  });

  // Remove preview
  document.getElementById('removePreview').addEventListener('click', () => {
    pendingFile = null;
    document.getElementById('previewWrap').style.display = 'none';
    document.getElementById('previewImg').src = '';
    ['itemImageGallery','itemImageCamera','itemImageGallery2'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
  });

  // Save item form
  document.getElementById('addItemForm').addEventListener('submit', saveItem);

  // Confirm delete
  document.getElementById('cancelDelete').addEventListener('click', () => {
    pendingDeleteId = null;
    document.getElementById('confirmDeleteOverlay').classList.remove('open');
  });
  document.getElementById('confirmDelete').addEventListener('click', deleteItem);
}

// ── Modal helpers ──────────────────────────────────────────
function openModal() {
  document.getElementById('addItemForm').reset();
  document.getElementById('addItemError').textContent = '';
  document.getElementById('previewWrap').style.display = 'none';
  document.getElementById('previewImg').src = '';
  document.getElementById('uploadProgress').style.display = 'none';
  document.querySelectorAll('#catSelector .cat-pick-btn').forEach(l => l.classList.remove('selected'));
  pendingFile = null;
  document.getElementById('addModal').classList.add('open');
}
function closeModal() {
  document.getElementById('addModal').classList.remove('open');
}

// ── Save Item ──────────────────────────────────────────────
async function saveItem(e) {
  e.preventDefault();
  const errEl   = document.getElementById('addItemError');
  const btn     = document.getElementById('saveItemBtn');
  const catInput= document.querySelector('#catSelector input[name="category"]:checked');
  const name    = document.getElementById('itemName').value.trim();

  errEl.innerHTML = '';
  if (!catInput) { errEl.textContent = 'Please select a category.'; return; }
  if (!name)     { errEl.textContent = 'Item name is required.'; return; }

  const orig = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving…';

  let imageUrl = '';

  // ── Step 1: Try Cloudinary upload ─────────────────────────
  if (pendingFile) {
    try {
      document.getElementById('uploadProgress').style.display = 'block';
      setProgress(20, 'Uploading image…');
      imageUrl = await uploadToCloudinary(pendingFile);
      setProgress(100, 'Upload complete!');
    } catch (uploadErr) {
      // Show exact Cloudinary error and offer to continue without image
      document.getElementById('uploadProgress').style.display = 'none';
      const cloudinaryMsg = uploadErr.message || 'Unknown upload error';
      errEl.innerHTML = `
        <div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:10px;padding:12px;margin-bottom:10px;">
          <div style="display:flex;align-items:center;gap:6px;color:#f87171;font-weight:600;margin-bottom:6px;">
            <i class="fa-solid fa-triangle-exclamation"></i> Image upload failed
          </div>
          <div style="color:#fca5a5;font-size:0.8rem;margin-bottom:10px;">
            Cloudinary error: <strong>${cloudinaryMsg}</strong>
          </div>
          <div style="font-size:0.78rem;color:#94a3b8;margin-bottom:10px;">
            ⚠️ Make sure your preset <code style="color:#f472b6;background:rgba(244,114,182,0.1);padding:1px 6px;border-radius:4px;">${CLOUDINARY_CONFIG.uploadPreset}</code>
            is set to <strong>Unsigned</strong> mode in your Cloudinary dashboard.
          </div>
          <button type="button" id="saveWithoutImgBtn" class="btn btn-secondary btn-sm" style="width:100%;">
            <i class="fa-solid fa-floppy-disk"></i> Save item without image anyway
          </button>
        </div>`;

      // Bind the fallback button
      document.getElementById('saveWithoutImgBtn').addEventListener('click', async () => {
        errEl.innerHTML = '';
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving…';
        try {
          await db.collection('users').doc(uid).collection('store').add({
            name,
            category: catInput.value,
            imageUrl: '',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          showToast(`"${name}" saved (no image). Fix Cloudinary preset to upload photos.`, 'info');
          closeModal();
          await loadStore();
        } catch (dbErr) {
          errEl.textContent = 'Firestore save also failed: ' + dbErr.message;
        } finally {
          btn.disabled = false;
          btn.innerHTML = orig;
        }
      });

      btn.disabled = false;
      btn.innerHTML = orig;
      return; // Stop here – let user decide
    }
  }

  // ── Step 2: Save to Firestore ──────────────────────────────
  try {
    await db.collection('users').doc(uid).collection('store').add({
      name,
      category : catInput.value,
      imageUrl,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    showToast(`"${name}" added to your Store!`, 'success');
    closeModal();
    await loadStore();
  } catch (dbErr) {
    console.error(dbErr);
    errEl.textContent = 'Firestore error: ' + dbErr.message;
  } finally {
    btn.disabled = false;
    btn.innerHTML = orig;
    document.getElementById('uploadProgress').style.display = 'none';
  }
}

function setProgress(pct, text) {
  document.getElementById('progressBar').style.width  = pct + '%';
  document.getElementById('progressText').textContent = text;
}

// ── Delete Item ────────────────────────────────────────────
async function deleteItem() {
  if (!pendingDeleteId) return;
  document.getElementById('confirmDeleteOverlay').classList.remove('open');
  try {
    await db.collection('users').doc(uid).collection('store').doc(pendingDeleteId).delete();
    showToast('Item deleted from Store.', 'info');
    allItems = allItems.filter(it => it.id !== pendingDeleteId);
    document.getElementById('storeCountLabel').textContent = allItems.length;
    renderStore();
  } catch (err) {
    showToast('Failed to delete item.', 'error');
  } finally {
    pendingDeleteId = null;
  }
}
