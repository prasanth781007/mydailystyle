// ============================================================
//  profile.js – MyDailyStyle Profile Management Logic
// ============================================================

let uid = null;
let userEmail = null;

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

// ── Auth Guard ─────────────────────────────────────────────
requireAuth(async user => {
  uid = user.uid;
  userEmail = user.email;

  // Set avatar & labels
  const initials = (user.displayName || user.email || 'U').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
  document.getElementById('userAvatar').textContent = initials;
  document.getElementById('profileBigAvatar').textContent = initials;
  document.getElementById('userEmailLabel').textContent   = userEmail;
  document.getElementById('profileEmail').value           = userEmail;
  
  // Fill form
  document.getElementById('profileName').value = user.displayName || '';
  
  setupListeners();
});

function setupListeners() {
  const profileForm = document.getElementById('profileForm');
  const saveBtn     = document.getElementById('saveProfileBtn');
  const deleteBtn   = document.getElementById('deleteAccountBtn');
  const finalDelBtn = document.getElementById('finalDeleteBtn');
  const closeDelBtn = document.getElementById('closeDeleteModal');

  // 1. Update Profile
  profileForm.addEventListener('submit', async e => {
    e.preventDefault();
    const name = document.getElementById('profileName').value.trim();
    if (!name) return;

    const orig = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving…';

    try {
      const user = auth.currentUser;
      
      // Update Firebase Auth Profile
      await user.updateProfile({ displayName: name });
      
      // Update Firestore User Doc
      await db.collection('users').doc(uid).set({
        name: name,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      showToast('Profile updated successfully!', 'success');
      
      // Refresh UI avatar
      const initials = name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
      document.getElementById('userAvatar').textContent = initials;
      document.getElementById('profileBigAvatar').textContent = initials;

    } catch (err) {
      console.error(err);
      showToast('Failed to update profile: ' + err.message, 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = orig;
    }
  });

  // 2. Account Deletion Modal
  deleteBtn.addEventListener('click', () => {
    document.getElementById('confirmDeleteModal').classList.add('open');
  });
  closeDelBtn.addEventListener('click', () => {
    document.getElementById('confirmDeleteModal').classList.remove('open');
  });

  // 3. Final Deletion (Requires Re-authentication)
  finalDelBtn.addEventListener('click', async () => {
    const pwd = document.getElementById('deletePassword').value;
    const msg = document.getElementById('deleteMsg');
    if (!pwd) { msg.textContent = 'Please enter your password.'; return; }

    finalDelBtn.disabled = true;
    finalDelBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Deleting…';

    try {
      const user = auth.currentUser;
      const credential = firebase.auth.EmailAuthProvider.credential(user.email, pwd);
      
      // Re-authenticate user before critical action (Firebase Auth Requirement)
      await user.reauthenticateWithCredential(credential);
      
      // Wipe User Data in parallel
      await Promise.all([
        // Store
        wipeCollection(`users/${uid}/store`),
        // Schedule
        wipeCollection(`users/${uid}/schedule`),
        // Main Doc
        db.collection('users').doc(uid).delete()
      ]);

      // Finally delete the user account
      await user.delete();

      showToast('Account deleted successfully. Goodbye!', 'error');
      setTimeout(() => window.location.href = 'index.html', 1500);

    } catch (err) {
      console.error(err);
      msg.textContent = (err.code === 'auth/wrong-password') 
        ? 'Incorrect password.' 
        : 'Error: ' + err.message;
      finalDelBtn.disabled = false;
      finalDelBtn.innerHTML = 'Delete Permanently';
    }
  });
}

// Helper to wipe a collection
async function wipeCollection(path) {
  const snap = await db.collection(path).get();
  const batch = db.batch();
  snap.forEach(doc => batch.delete(doc.ref));
  return batch.commit();
}
