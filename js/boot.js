import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const logEl = document.getElementById("log");

function log(text) {
  if (logEl) logEl.textContent += text + "\n";
}

function wait(ms) {
  return new Promise(res => setTimeout(res, ms));
}

let bootRunning = false;

onAuthStateChanged(auth, async (user) => {
  if (bootRunning) return;
  bootRunning = true;

  if (!user) {
    window.location.href = "auth.html";
    return;
  }

  await startBoot(user);
});

async function startBoot(user) {
  log("UCN BOOT SEQUENCE INITIATED...");
  await wait(800);

  log("CHECKING NETWORK LINK... OK");
  await wait(400);

  log("AUTHENTICATION VERIFIED");
  await wait(400);

  log("LOADING PERSONNEL DATABASE...");
  await wait(600);

  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    log("ERROR: USER PROFILE MISSING");
    await wait(1000);
    window.location.href = "auth.html";
    return;
  }

  const data = snap.data();

  if (data.account?.banned) {
    log("ERROR: ACCOUNT SUSPENDED");
    await wait(1000);
    await signOut(auth);
    window.location.href = "auth.html?error=suspended";
    return;
  }

  log("PROFILE LOADED");
  await wait(400);

  log("VALIDATING IDENTITY...");
  await wait(500);

  const missingIdentity =
    !data.profile?.displayName ||
    !data.profile?.callsign;

  if (missingIdentity) {
    log("IDENTITY INCOMPLETE");
    log("REDIRECTING TO PERSONNEL SETUP...");
    await wait(1200);
    window.location.href = "setup.html";
    return;
  }

  log("IDENTITY VERIFIED");
  await wait(400);

  log(`WELCOME, ${data.profile.rank} ${data.profile.callsign}`);
  await wait(800);

  log("INITIALISING TERMINAL INTERFACE...");
  await wait(600);

  window.location.href = "home.html";
}
