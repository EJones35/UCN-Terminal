import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  doc,
  getDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const displayNameInput = document.getElementById("displayName");
const callsignInput = document.getElementById("callsign");
const status = document.getElementById("status");

let currentUser = null;

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "auth.html";
    return;
  }

  currentUser = user;

  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    window.location.href = "auth.html";
    return;
  }

  const data = snap.data();

  if (data.profile?.callsign) {
    callsignInput.value = data.profile.callsign;
  }
});

window.saveIdentity = async () => {
  if (!currentUser) {
    window.location.href = "auth.html";
    return;
  }

  const displayName = displayNameInput.value.trim();
  const callsign = callsignInput.value.trim();

  if (!displayName || !callsign) {
    status.textContent = "BOTH FIELDS REQUIRED";
    return;
  }

  const ref = doc(db, "users", currentUser.uid);

  await updateDoc(ref, {
    "profile.displayName": displayName,
    "profile.callsign": callsign
  });

  status.textContent = "IDENTITY CONFIRMED";

  setTimeout(() => {
    window.location.href = "boot.html";
  }, 1000);
};
