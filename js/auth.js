import { auth, db } from "./firebase.js";

import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword
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


// -----------------------------
// UCN CALLSIGN GENERATOR
// -----------------------------
function generateCallsign(uid) {
    const prefixPool = ["TKN", "HAV", "UCN", "XO", "OPS", "ENG"];

    const prefix = prefixPool[Math.floor(Math.random() * prefixPool.length)];

    const numeric = uid
        .replace(/[^a-zA-Z0-9]/g, "")
        .slice(0, 4)
        .toUpperCase();

    const number = parseInt(numeric, 36) % 9000;

    return `${prefix}-${1000 + number}`;
}


// -----------------------------
// USER BOOTSTRAP
// -----------------------------
async function ensureUserDocument(user) {

    const userRef = doc(db, "users", user.uid);
    const snapshot = await getDoc(userRef);

    if (!snapshot.exists()) {

        const callsign = generateCallsign(user.uid);

        await setDoc(userRef, {

            profile: {
                displayName: "",
                callsign: callsign,
                rank: "Ensign",
                currentShipId: "",
                role: "user"
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
            }

        });

    } else {

        await updateDoc(userRef, {
            "meta.lastLogin": serverTimestamp()
        });

    }
}


// -----------------------------
// LOGIN
// -----------------------------
window.login = async () => {

    try {

        const credential = await signInWithEmailAndPassword(
            auth,
            emailInput.value,
            passInput.value
        );

        await ensureUserDocument(credential.user);

        window.location.href = "home.html";

    } catch (err) {

        console.error(err);
        showError(err.message);

    }

};


// -----------------------------
// REGISTER
// -----------------------------
window.register = async () => {

    try {

        const credential = await createUserWithEmailAndPassword(
            auth,
            emailInput.value,
            passInput.value
        );

        await ensureUserDocument(credential.user);

        window.location.href = "home.html";

    } catch (err) {

        console.error(err);
        showError(err.message);

    }

};


function showError(message) {
    const el = document.getElementById("error");
    el.textContent = message;
    el.classList.add("glow-red");
}
