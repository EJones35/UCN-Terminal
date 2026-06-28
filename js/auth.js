import { auth } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

const emailInput = document.getElementById("email");
const passInput = document.getElementById("password");

window.login = async () => {
  try {
    await signInWithEmailAndPassword(auth, emailInput.value, passInput.value);
  } catch (err) {
    showError("ACCESS DENIED");
  }
};

window.register = async () => {
  try {
    await createUserWithEmailAndPassword(auth, emailInput.value, passInput.value);
  } catch (err) {
    showError("REGISTRATION FAILED");
  }
};

function showError(msg) {
  const el = document.getElementById("error");
  el.innerText = msg;
  el.classList.add("glow-red");
}
