import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, setLogLevel } from "firebase/firestore";
setLogLevel("silent");

export const firebaseConfig = {
  projectId: "gen-lang-client-0300801049",
  appId: "1:818963985156:web:e3641ec4a1e56b0167d651",
  apiKey: "AIzaSyBit3Kmc2OBoZoH1pguncUKpnkT9F3zhuk",
  authDomain: "gen-lang-client-0300801049.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-3467babe-2776-4f26-a8fd-61fd0c77f54f",
  storageBucket: "gen-lang-client-0300801049.firebasestorage.app",
  messagingSenderId: "818963985156"
};

const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export default app;
