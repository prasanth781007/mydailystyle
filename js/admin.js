// ============================================================
//  admin.js – MyDailyStyle Admin Dashboard Logic
// ============================================================

// List of allowed administrators
const ADMIN_EMAILS = [
  "prasanth.kum22@gmail.com"
];

// Helper to check admin status
async function checkAdmin(user) {
  if (ADMIN_EMAILS.includes(user.email)) {
    return true;
  }
  return false;
}

// Global Modal Closer
window.onclick = (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
  }
};

requireAuth(async user => {
  const isAdmin = await checkAdmin(user);
  
  if (!isAdmin) {
    document.getElementById('adminContent').style.display = 'none';
    document.getElementById('accessDenied').style.display = 'block';
    return;
  }

  // Load Admin Data
  await loadAdminData();
});

async function loadAdminData() {
  const tableBody = document.getElementById('userTableBody');
  const userSnap  = await db.collection('users').get();
  
  let totalUsers      = userSnap.size;
  let totalStoreItems = 0;
  let totalPlanned    = 0;
  
  tableBody.innerHTML = '';
  
  for (const doc of userSnap.docs) {
    const userData = doc.data();
    const uid      = doc.id;
    
    // Fetch user's counts
    const storeItemsSnap = await db.collection('users').doc(uid).collection('store').get();
    const scheduleSnap   = await db.collection('users').doc(uid).collection('schedule').get();
    
    totalStoreItems += storeItemsSnap.size;
    totalPlanned    += scheduleSnap.size;

    // Fallback for name: Use email prefix if name is missing or "Anonymous"
    let displayName = userData.name || 'Anonymous';
    if (!userData.name || userData.name.toLowerCase() === 'anonymous') {
      displayName = userData.email ? userData.email.split('@')[0] : 'Anonymous';
    }

    // Build Table Row
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:30px;height:30px;background:#7c3aed;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:700;">
            ${(displayName).charAt(0).toUpperCase()}
          </div>
          <span style="font-weight:500;">${displayName}</span>
        </div>
      </td>
      <td>${userData.email}</td>
      <td><strong>${storeItemsSnap.size}</strong></td>
      <td><strong>${scheduleSnap.size}</strong></td>
      <td>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-secondary btn-sm" onclick="viewUserStore('${uid}', '${userData.name}')" title="View Store">
            <i class="fa-solid fa-shirt"></i>
          </button>
          <button class="btn btn-secondary btn-sm" onclick="viewUserPlanner('${uid}', '${userData.name}')" title="View Planner">
            <i class="fa-regular fa-calendar"></i>
          </button>
        </div>
      </td>
      <td style="color:var(--text-muted);font-size:0.75rem;">${userData.createdAt ? userData.createdAt.toDate().toLocaleDateString() : 'N/A'}</td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="deleteUserData('${uid}', '${userData.email}')" style="color:var(--error);border-color:rgba(239,68,68,0.2);">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </td>
    `;
    tableBody.appendChild(row);
  }

  // Update Stats Counters
  document.getElementById('totalUsers').textContent   = totalUsers;
  document.getElementById('totalItems').textContent   = totalStoreItems;
  document.getElementById('totalPlanned').textContent = totalPlanned;
}

// ── View User Store ──────────────────────────────────────────
async function viewUserStore(uid, name) {
  const grid = document.getElementById('userStoreGrid');
  document.getElementById('storeModalTitle').textContent = `${name}'s Wardrobe`;
  grid.innerHTML = '<div style="padding:40px;text-align:center;"><div class="spinner"></div></div>';
  document.getElementById('viewStoreModal').classList.add('open');

  try {
    const snap = await db.collection('users').doc(uid).collection('store').get();
    if (snap.empty) {
      grid.innerHTML = '<p style="padding:40px;color:var(--text-muted);text-align:center;">Store is empty.</p>';
      return;
    }
    grid.innerHTML = snap.docs.map(doc => {
      const item = doc.data();
      return `
        <div class="user-store-item">
          ${item.imageUrl ? `<img src="${item.imageUrl}" alt="${item.name}">` : '<div style="height:140px;display:flex;align-items:center;justify-content:center;font-size:2rem;color:var(--text-muted);"><i class="fa-solid fa-shirt"></i></div>'}
          <div style="font-size:0.75rem;font-weight:600;margin-top:5px;">${item.name}</div>
        </div>`;
    }).join('');
  } catch (err) {
    grid.innerHTML = '<p style="color:red;padding:20px;">Error loading store.</p>';
  }
}

// ── View User Planner ────────────────────────────────────────
async function viewUserPlanner(uid, name) {
  const list = document.getElementById('userPlannerList');
  document.getElementById('plannerModalTitle').textContent = `${name}'s Planner`;
  list.innerHTML = '<div style="padding:40px;text-align:center;"><div class="spinner"></div></div>';
  document.getElementById('viewPlannerModal').classList.add('open');

  try {
    const allItemsSnap = await db.collection('users').doc(uid).collection('store').get();
    const allItems     = allItemsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    const schedSnap = await db.collection('users').doc(uid).collection('schedule').get();
    if (schedSnap.empty) {
      list.innerHTML = '<p style="padding:40px;color:var(--text-muted);text-align:center;">No outfits planned.</p>';
      return;
    }

    list.innerHTML = schedSnap.docs.map(doc => {
      const data = doc.data();
      const ids  = [data.top_id, data.bottom_id, data.shoes_id, data.accessories_id].filter(Boolean);
      const items= ids.map(id => allItems.find(it => it.id === id)).filter(Boolean);
      
      return `
        <div class="planner-row">
          <div class="planner-date">${doc.id}</div>
          <div class="planner-thumbs">
            ${items.map(it => it.imageUrl ? `<img src="${it.imageUrl}" class="planner-thumb" title="${it.name}">` : `<div class="planner-thumb" style="display:flex;align-items:center;justify-content:center;background:#222;font-size:0.5rem;"><i class="fa-solid fa-shirt"></i></div>`).join('')}
          </div>
          <div style="font-size:0.7rem;color:var(--text-muted);">${items.map(it => it.name).join(', ')}</div>
        </div>`;
    }).join('');
  } catch (err) {
    console.error(err);
    list.innerHTML = '<p style="color:red;padding:20px;">Error loading planner.</p>';
  }
}

// ── Admin Action: Wipe User Data ──────────────────────────────
async function deleteUserData(targetUid, targetEmail) {
  const pwd = prompt(`🚨 DANGER ZONE 🚨\n\nYou are about to DELETE all data for: ${targetEmail}\n\nPlease enter the Admin Password to confirm:`);
  
  if (pwd === null) return; // Cancelled
  if (pwd !== 'prasanth') {
    alert('Incorrect password. Action denied.');
    return;
  }

  try {
    // 1. Delete all items in user's Store
    const storeSnapshot = await db.collection('users').doc(targetUid).collection('store').get();
    const storePromises = storeSnapshot.docs.map(doc => doc.ref.delete());
    await Promise.all(storePromises);

    // 2. Delete all items in user's Schedule
    const scheduleSnapshot = await db.collection('users').doc(targetUid).collection('schedule').get();
    const schedulePromises = scheduleSnapshot.docs.map(doc => doc.ref.delete());
    await Promise.all(schedulePromises);

    // 3. Delete the main User document
    await db.collection('users').doc(targetUid).delete();

    alert(`Success: Data for ${targetEmail} has been completely removed.`);
    loadAdminData(); // Refresh the list
  } catch (err) {
    console.error(err);
    alert('Critical Error: Failed to delete user data.');
  }
}
