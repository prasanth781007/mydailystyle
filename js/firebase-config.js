// ============================================================
//  MyDailyStyle – Firebase & Cloudinary Configuration
//  ⚠️  Replace ALL placeholder values before going live.
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyCqasI6sF_tz_Dzvqwhidm__w84RT2h9Pk",
  authDomain: "mydailystyle.firebaseapp.com",
  projectId: "mydailystyle",
  storageBucket: "mydailystyle.firebasestorage.app",
  messagingSenderId: "194021125058",
  appId: "1:194021125058:web:0008098ae5cd41fa47445b"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Cloudinary configuration (Corrected)
const CLOUDINARY_CONFIG = {
  cloudName   : "dekkfy637",      // ✅ Cloud name
  uploadPreset: "mydailystyle1"   // ✅ Upload preset
};

// Helper – upload to Cloudinary and return the secure URL
async function uploadToCloudinary(file) {
  const formData = new FormData();
  formData.append("upload_preset", CLOUDINARY_CONFIG.uploadPreset); // Append preset first
  formData.append("file",          file);
  formData.append("folder",        "mydailystyle");

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`,
    { method: "POST", body: formData }
  );
  
  const data = await res.json();
  if (!res.ok || data.error) {
    const msg = data.error ? data.error.message : `HTTP ${res.status}`;
    console.error("[Cloudinary Error]", msg);
    throw new Error(msg);
  }
  return data.secure_url;
}

// Guard – redirect to login if not authenticated
function requireAuth(callback) {
  auth.onAuthStateChanged(user => {
    if (!user) {
      window.location.href = "index.html";
    } else {
      callback(user);
    }
  });
}

// Logout helper
async function logoutUser() {
  await auth.signOut();
  window.location.href = "index.html";
}
