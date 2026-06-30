import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import { initNav } from "./nav.js";

initNav("home");

onAuthStateChanged(auth, async (user) => {
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
  const profile = data.profile || {};
  const stats = data.statistics || {};
  const permissions = data.permissions || {};

  const profileEl = document.getElementById("profile");
  profileEl.innerHTML = `
    <p><strong>${profile.rank || "UNKNOWN"}</strong> ${profile.callsign || "---"}</p>
    <p>${profile.displayName || "Unidentified Personnel"}</p>
    <p>Missions: ${stats.missions || 0} | Hours Served: ${stats.hoursServed || 0}</p>
  `;
});
