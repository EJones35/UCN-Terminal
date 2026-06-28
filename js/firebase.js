import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { 
  getAuth,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCP57X_6iOxam8QyHMJG_8l2xbEuh38oxk",
  authDomain: "ucn-terminal.firebaseapp.com",
  projectId: "ucn-terminal",
  appId: "1:871960027081:web:f9287fd87fb7309888d218"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// SESSION PERSISTENCE (critical)
setPersistence(auth, browserLocalPersistence);
