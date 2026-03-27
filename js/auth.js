// ============================================================
//  auth.js – MyDailyStyle Authentication Logic
// ============================================================

// ── Toast helper ──────────────────────────────────────────
function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icons = { success: 'fa-circle-check', error: 'fa-circle-xmark', info: 'fa-circle-info' };
  toast.innerHTML = `<i class="fa-solid ${icons[type]}"></i><span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.4s ease forwards';
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

// ── Toggle password visibility ─────────────────────────────
function setupPwdToggle(iconId, inputId) {
  const icon  = document.getElementById(iconId);
  const input = document.getElementById(inputId);
  if (!icon || !input) return;
  icon.addEventListener('click', () => {
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    icon.classList.toggle('fa-eye',      !show);
    icon.classList.toggle('fa-eye-slash', show);
  });
}
setupPwdToggle('toggleLoginPwd',  'loginPassword');
setupPwdToggle('toggleRegPwd',    'regPassword');

// ── Tab Switcher ───────────────────────────────────────────
const tabs   = document.querySelectorAll('.auth-tab');
const panels = document.querySelectorAll('.auth-panel');

function switchTab(name) {
  tabs.forEach(t => t.classList.toggle('active',   t.dataset.tab === name));
  panels.forEach(p => {
    const match = p.id === `panel${name.charAt(0).toUpperCase() + name.slice(1)}`;
    p.classList.toggle('active', match);
  });
}

tabs.forEach(tab => tab.addEventListener('click', () => switchTab(tab.dataset.tab)));

// Forgot / back links
document.getElementById('showForgot').addEventListener('click', () => {
  panels.forEach(p => p.classList.remove('active'));
  tabs.forEach(t => t.classList.remove('active'));
  document.getElementById('panelForgot').classList.add('active');
});
document.getElementById('backToLogin').addEventListener('click', () => switchTab('login'));

// ── Utility: setLoading on button ─────────────────────────
function setLoading(btn, loading, original) {
  btn.disabled = loading;
  btn.innerHTML = loading
    ? '<i class="fa-solid fa-spinner fa-spin"></i> Please wait…'
    : original;
}

// ── Login Form ─────────────────────────────────────────────
const loginForm = document.getElementById('loginForm');
loginForm.addEventListener('submit', async e => {
  e.preventDefault();
  const errEl   = document.getElementById('loginError');
  const btn     = document.getElementById('loginBtn');
  const email   = document.getElementById('loginEmail').value.trim();
  const password= document.getElementById('loginPassword').value;
  const remember= document.getElementById('rememberMe').checked;

  errEl.textContent = '';
  if (!email || !password) { errEl.textContent = 'Please fill in all fields.'; return; }

  const orig = btn.innerHTML;
  setLoading(btn, true, orig);

  try {
    const persistence = remember
      ? firebase.auth.Auth.Persistence.LOCAL
      : firebase.auth.Auth.Persistence.SESSION;
    await auth.setPersistence(persistence);
    await auth.signInWithEmailAndPassword(email, password);
    showToast('Welcome back! Redirecting…', 'success');
    setTimeout(() => window.location.href = 'dashboard.html', 1000);
  } catch (err) {
    errEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${getFriendlyError(err.code)}`;
    setLoading(btn, false, orig);
  }
});

// ── Register Form ──────────────────────────────────────────
const registerForm = document.getElementById('registerForm');
registerForm.addEventListener('submit', async e => {
  e.preventDefault();
  const errEl    = document.getElementById('registerError');
  const btn      = document.getElementById('registerBtn');
  const name     = document.getElementById('regName').value.trim();
  const email    = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const confirm  = document.getElementById('regConfirm').value;

  errEl.textContent = '';
  if (!name || !email || !password || !confirm) { errEl.textContent = 'All fields are required.'; return; }
  if (password.length < 8) { errEl.textContent = 'Password must be at least 8 characters.'; return; }
  if (password !== confirm) { errEl.textContent = 'Passwords do not match.'; return; }

  const orig = btn.innerHTML;
  setLoading(btn, true, orig);

  try {
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    await cred.user.updateProfile({ displayName: name });
    // Create user doc in Firestore
    await db.collection('users').doc(cred.user.uid).set({
      name,
      email,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    showToast('Account created! Redirecting…', 'success');
    setTimeout(() => window.location.href = 'dashboard.html', 1200);
  } catch (err) {
    errEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${getFriendlyError(err.code)}`;
    setLoading(btn, false, orig);
  }
});

// ── Forgot Password Form ───────────────────────────────────
const forgotForm = document.getElementById('forgotForm');
forgotForm.addEventListener('submit', async e => {
  e.preventDefault();
  const msgEl = document.getElementById('forgotMsg');
  const btn   = document.getElementById('forgotBtn');
  const email = document.getElementById('forgotEmail').value.trim();

  msgEl.className = 'auth-message';
  msgEl.textContent = '';

  if (!email) { msgEl.className = 'auth-message error'; msgEl.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> Enter your email.'; return; }

  const orig = btn.innerHTML;
  setLoading(btn, true, orig);

  try {
    await auth.sendPasswordResetEmail(email);
    msgEl.className = 'auth-message success';
    msgEl.innerHTML = '<i class="fa-solid fa-circle-check"></i> Reset link sent! Check your inbox.';
  } catch (err) {
    msgEl.className = 'auth-message error';
    msgEl.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> ${getFriendlyError(err.code)}`;
  } finally {
    setLoading(btn, false, orig);
  }
});

// ── Google Sign-In ─────────────────────────────────────────
async function googleAuth() {
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    const result = await auth.signInWithPopup(provider);
    const user   = result.user;
    // Upsert user doc
    await db.collection('users').doc(user.uid).set({
      name : user.displayName,
      email: user.email,
      photo: user.photoURL,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    showToast('Signed in with Google!', 'success');
    setTimeout(() => window.location.href = 'dashboard.html', 1000);
  } catch (err) {
    showToast(getFriendlyError(err.code), 'error');
  }
}
document.getElementById('googleSignIn').addEventListener('click', googleAuth);
document.getElementById('googleSignUp').addEventListener('click', googleAuth);

// ── Error messages ─────────────────────────────────────────
function getFriendlyError(code) {
  const map = {
    'auth/user-not-found'        : 'No account found with this email.',
    'auth/wrong-password'        : 'Incorrect password.',
    'auth/invalid-email'         : 'Invalid email address.',
    'auth/email-already-in-use'  : 'This email is already registered.',
    'auth/weak-password'         : 'Password is too weak.',
    'auth/too-many-requests'     : 'Too many attempts. Please try later.',
    'auth/popup-closed-by-user'  : 'Google sign-in was cancelled.',
    'auth/network-request-failed': 'Network error. Check your connection.',
    'auth/invalid-credential'    : 'Invalid credentials. Please try again.',
  };
  return map[code] || 'Something went wrong. Please try again.';
}

// ── Redirect if already logged in ─────────────────────────
auth.onAuthStateChanged(user => {
  if (user) window.location.href = 'dashboard.html';
});
