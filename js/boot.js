import { auth, db } from "./firebase.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const statusEl = document.getElementById("status");
const logEl = document.getElementById("log");


function log(text) {
  logEl.textContent += text + "\n";
}


function wait(ms) {
  return new Promise(res => setTimeout(res, ms));
}


// -----------------------------
// BOOT PROCESS
// -----------------------------
async function startBoot() {

  const user = auth.currentUser;

  if (!user) {
    window.location.href = "auth.html";
    return;
  }

  log("UCN BOOT SEQUENCE INITIATED...");
  await wait(800);

  log("CHECKING NETWORK LINK... OK");
  await wait(400);

  log("AUTHENTICATION TOKEN VERIFIED");
  await wait(400);

  log("LOADING PERSONNEL DATABASE...");
  await wait(600);

  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    log("ERROR: USER PROFILE MISSING");
    window.location.href = "auth.html";
    return;
  }

  const data = snap.data();

  log("PROFILE LOADED");
  await wait(400);

  log("VALIDATING IDENTITY...");
  await wait(500);


  // -----------------------------
  // IDENTITY CHECK (YOUR RULE B)
  // -----------------------------
  const missingIdentity =
    !data.profile?.displayName ||
    !data.profile?.callsign;


  if (missingIdentity) {

    log("IDENTITY INCOMPLETE");
    log("REDIRECTING TO PERSONNEL SETUP...");

    await wait(1200);

    window.location.href = "home.html#setup";
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


startBoot();
