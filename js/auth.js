import { auth, db } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const emailInput = document.getElementById("email");
const passInput = document.getElementById("password");
const errorEl = document.getElementById("error");

const ADMIN_EMAIL = "smidge+admin@garyjones.co.uk";

function generateCallsign(uid) {
  const prefixPool = ["TKN", "HAV", "UCN", "XO", "OPS", "ENG"];
  const prefix = prefixPool[Math.floor(Math.random() * prefixPool.length)];
  const numeric = uid.replace(/[^a-zA-Z0-9]/g, "").slice(0, 4).toUpperCase();
  const number = parseInt(numeric, 36) % 9000;
  return `${prefix}-${1000 + number}`;
}

async function ensureUserDocument(user) {
  const userRef = doc(db, "users", user.uid);
  const snapshot = await getDoc(userRef);

  if (!snapshot.exists()) {
    const callsign = generateCallsign(user.uid);
    const isAdmin = user.email === ADMIN_EMAIL;

    await setDoc(userRef, {
      profile: {
        displayName: "",
        callsign: callsign,
        rank: "Ensign",
        currentShipId: "",
        role: isAdmin ? "admin" : "user",
        email: user.email
      },
      personnel: {
        serviceNumber: callsign,
        biography: "",
        photo: "",
        medals: [],
        previousAssignments: []
      },
      settings: {
        theme: "ucn",
        debug: true
      },
      statistics: {
        missions: 0,
        hoursServed: 0
      },
      meta: {
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp()
      },
      permissions: {
        admin: isAdmin
      },
      account: {
        banned: false
      }
    });
  } else {
    const data = snapshot.data();
    const isAdmin = user.email === ADMIN_EMAIL;

    const updates = {
      "meta.lastLogin": serverTimestamp(),
      "profile.email": user.email
    };

    if (isAdmin && !data.permissions?.admin) {
      updates["permissions.admin"] = true;
    }

    await updateDoc(userRef, updates);
  }
}

async function checkBanned(user) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (snap.exists() && snap.data().account?.banned) {
    await signOut(auth);
    return true;
  }
  return false;
}

let checkingError = false;

window.login = async () => {
  if (checkingError) return;
  checkingError = true;
  errorEl.textContent = "";
  errorEl.classList.remove("glow-red");

  try {
    const credential = await signInWithEmailAndPassword(auth, emailInput.value, passInput.value);

    const banned = await checkBanned(credential.user);
    if (banned) {
      showError("FLEET ACCESS SUSPENDED — Contact Fleet Command.");
      checkingError = false;
      return;
    }

    await ensureUserDocument(credential.user);
    window.location.href = "boot.html";
  } catch (err) {
    console.error(err);
    showError(err.message);
  }

  checkingError = false;
};

window.register = async () => {
  if (checkingError) return;
  checkingError = true;
  errorEl.textContent = "";
  errorEl.classList.remove("glow-red");

  try {
    const credential = await createUserWithEmailAndPassword(auth, emailInput.value, passInput.value);
    await ensureUserDocument(credential.user);
    window.location.href = "boot.html";
  } catch (err) {
    console.error(err);
    showError(err.message);
  }

  checkingError = false;
};

function showError(message) {
  errorEl.textContent = message;
  errorEl.classList.add("glow-red");
}

window.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  if (params.get("error") === "suspended") {
    showError("FLEET ACCESS SUSPENDED — Contact Fleet Command.");
  }
});
