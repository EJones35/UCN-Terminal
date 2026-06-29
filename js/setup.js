import { auth, db } from "./firebase.js";

import {
  doc,
  getDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";


const displayNameInput = document.getElementById("displayName");
const callsignInput = document.getElementById("callsign");
const status = document.getElementById("status");


async function loadExisting() {

  const user = auth.currentUser;
  if (!user) {
    window.location.href = "auth.html";
    return;
  }

  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    window.location.href = "auth.html";
    return;
  }

  const data = snap.data();

  // preload callsign if it exists
  if (data.profile?.callsign) {
    callsignInput.value = data.profile.callsign;
  }

}


window.saveIdentity = async () => {

  const user = auth.currentUser;

  if (!user) {
    window.location.href = "auth.html";
    return;
  }

  const displayName = displayNameInput.value.trim();
  const callsign = callsignInput.value.trim();

  if (!displayName || !callsign) {
    status.textContent = "BOTH FIELDS REQUIRED";
    return;
  }

  const ref = doc(db, "users", user.uid);

  await updateDoc(ref, {
    "profile.displayName": displayName,
    "profile.callsign": callsign
  });

  status.textContent = "IDENTITY CONFIRMED";

  setTimeout(() => {
    window.location.href = "boot.html";
  }, 1000);

};


loadExisting();
