import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

export function initNav(currentPage) {
  const navEl = document.getElementById("nav");
  if (!navEl) return;

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      navEl.innerHTML = "";
      return;
    }

    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);
    const data = snap.exists() ? snap.data() : {};
    const p = data.profile || {};
    const perms = data.permissions || {};
    const isAdmin = perms.admin || p.role === "admin";

    const pages = [
      { id: "home", label: "TERMINAL", href: "home.html" },
      { id: "profile", label: "SERVICE RECORD", href: "profile.html" }
    ];

    if (isAdmin) {
      pages.push({ id: "admin", label: "ADMIN", href: "admin.html" });
    }

    navEl.innerHTML = `
      <div class="nav-inner">
        <span class="nav-brand">UCN TERMINAL</span>
        <div class="nav-links">
          ${pages.map(pg => `
            <a href="${pg.href}" class="nav-link ${pg.id === currentPage ? "nav-active" : ""}">${pg.label}</a>
          `).join("")}
        </div>
        <div class="nav-user">
          <span class="nav-callsign">${p.rank || ""} ${p.callsign || ""}</span>
          <button class="nav-logout" id="navLogout">LOGOUT</button>
        </div>
      </div>
    `;

    document.getElementById("navLogout")?.addEventListener("click", async () => {
      await signOut(auth);
      window.location.href = "auth.html";
    });
  });
}
