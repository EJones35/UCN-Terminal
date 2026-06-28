import { auth, db } from "./firebase.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

function generateInviteCode() {
  return "UCN-" + Math.random().toString(36).substring(2, 8).toUpperCase();
}

async function findUserByInviteCode(code) {
  const snap = await getDoc(doc(db, "inviteCodes", code));
  return snap.exists() ? snap.data().uid : null;
}

async function createProfile(uid, email, invitedBy = null) {
  const inviteCode = generateInviteCode();

  await setDoc(doc(db, "users", uid), {
    profile: {
      email,
      displayName: "New Officer",
      callsign: "UNASSIGNED",
      rank: "Ensign",
      role: "user",
      inviteCode,
      invitedBy,
      successfulInvites: 0,
      createdAt: Date.now()
    }
  });

  // store invite lookup table
  await setDoc(doc(db, "inviteCodes", inviteCode), {
    uid
  });
}

window.register = async () => {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const invite = document.getElementById("invite")?.value || null;

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);

    let inviterUid = null;

    if (invite) {
      inviterUid = await findUserByInviteCode(invite);

      if (inviterUid) {
        const inviterRef = doc(db, "users", inviterUid);
        const inviterSnap = await getDoc(inviterRef);

        const data = inviterSnap.data();

        await updateDoc(inviterRef, {
          "profile.successfulInvites": (data.profile.successfulInvites || 0) + 1
        });
      }
    }

    await createProfile(cred.user.uid, email, inviterUid);

    window.location.href = "home.html";

  } catch (err) {
    showError(err.message);
  }
};

window.login = async () => {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    window.location.href = "home.html";
  } catch (err) {
    showError("ACCESS DENIED");
  }
};

function showError(msg) {
  const el = document.getElementById("error");
  el.innerText = msg;
  el.classList.add("glow-red");
}