import { auth } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

const go = (page) => window.location.href = page;

onAuthStateChanged(auth, (user) => {
  if (user) {
    go("home.html");
  } else {
    go("auth.html");
  }
});
