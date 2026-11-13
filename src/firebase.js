import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

const firebaseConfig = {
  apiKey: "AIzaSyBqEHh0BeIRVVdlVqv4Ttqm8APz2Y7emuQ",
  authDomain: "tamil-kavithai-f5cd8.firebaseapp.com",
  projectId: "tamil-kavithai-f5cd8",
  storageBucket: "tamil-kavithai-f5cd8.firebasestorage.app",
  messagingSenderId: "265543116629",
  appId: "1:265543116629:web:eae8d15ad45825e460b1dc",
  measurementId: "G-2FSMNCMZL0"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);

// ── Firebase App Check (Anti-Abuse Client Attestation) ──
let appCheck = null;
if (typeof window !== "undefined") {
  // Support debug token in local development if configured
  if (import.meta.env.DEV && import.meta.env.VITE_APPCHECK_DEBUG_TOKEN) {
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = import.meta.env.VITE_APPCHECK_DEBUG_TOKEN;
  }

  const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
  if (siteKey) {
    try {
      appCheck = initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(siteKey),
        isTokenAutoRefreshEnabled: true
      });
    } catch (err) {
      console.warn("Firebase App Check initialization notice:", err.message);
    }
  }
}

export { appCheck };
