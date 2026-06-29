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

async function ensureUserDocument(user) {

    const userRef = doc(db, "users", user.uid);
    const snapshot = await getDoc(userRef);

    if (!snapshot.exists()) {

        await setDoc(userRef, {

            displayName: "",
            callsign: "",
            rank: "Ensign",

            currentShipId: "",

            role: "user",

            createdAt: serverTimestamp(),
            lastLogin: serverTimestamp(),

            settings: {
                debug: true,
                theme: "ucn"
            }

        });

    } else {

        await updateDoc(userRef, {
            lastLogin: serverTimestamp()
        });

    }

}

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
