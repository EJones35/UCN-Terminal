import { auth } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js");
}

onAuthStateChanged(auth, (user) => {
  if (user) {
    window.location.href = "boot.html";
  } else {
    window.location.href = "auth.html";
  }
});
