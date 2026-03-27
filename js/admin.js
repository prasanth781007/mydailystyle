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

    // Build Table Row
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:30px;height:30px;background:#7c3aed;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:700;">
            ${(userData.name || 'U').charAt(0)}
          </div>
          <span>${userData.name || 'Anonymous'}</span>
        </div>
      </td>
      <td>${userData.email}</td>
      <td><strong>${storeItemsSnap.size}</strong></td>
      <td><strong>${scheduleSnap.size}</strong></td>
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

// ── Admin Action: Wipe User Data ──────────────────────────────
async function deleteUserData(targetUid, targetEmail) {
  const confirmMsg = `⚠️ WARNING: ARE YOU SURE?\n\nThis will permanently DELETE all wardrobe items and settings for: ${targetEmail}.\n\nThis cannot be undone.`;
  
  if (!confirm(confirmMsg)) return;

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
    alert('Critical Error: Failed to delete user data. Check Firestore rules.');
  }
}
