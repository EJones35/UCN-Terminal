import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  orderBy,
  limit,
  where
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import { initNav } from "./nav.js";

initNav("profile");

const DEPLOYMENT_TYPES = [
  { key: "military", label: "MILITARY", color: "#ff4a4a" },
  { key: "formation", label: "FORMATION", color: "#4a9eff" },
  { key: "exploration", label: "EXPLORATION", color: "#4aff4a" },
  { key: "cartography", label: "CARTOGRAPHY", color: "#ffcc00" },
  { key: "other", label: "OTHER DUTIES", color: "#aa66ff" }
];

const DIVISIONS = [
  { name: "COMMAND", roles: ["Captain", "XO"] },
  { name: "OPERATIONS", roles: ["Helm", "Weapons", "Shuttle Helm", "Shuttle Generalist"] },
  { name: "SCIENCE", roles: ["Radar", "Navigation", "Comms"] },
  { name: "ENGINEERING", roles: ["D&D", "Manual Engineer", "Chief Engineer", "Shuttle Engineer"] }
];

let currentData = null;

function el(id) { return document.getElementById(id); }

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = "auth.html"; return; }

  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) { window.location.href = "auth.html"; return; }

  currentData = snap.data();
  renderProfile(currentData, user);
});

function renderProfile(data, user) {
  const p = data.profile || {};
  const pers = data.personnel || {};
  const stats = data.statistics || {};
  const roles = pers.roles || {};

  el("pfServiceNumber").textContent = pers.serviceNumber || "---";
  el("pfDisplayName").textContent = p.displayName || "---";
  el("pfCallsign").textContent = p.callsign || "---";
  el("pfPronouns").textContent = p.pronouns || "Not set";
  el("pfBiography").textContent = pers.biography || "No biography recorded.";
  el("pfRank").textContent = p.rank || "ENSIGN";
  el("pfEnlistment").textContent = p.enlistmentDate || "---";
  el("pfMissions").textContent = stats.missions || 0;
  el("pfHours").textContent = stats.hoursServed || 0;

  const medals = pers.medals || [];
  el("pfMedals").textContent = medals.length ? medals.join(", ") : "None recorded.";

  el("shipHavock").style.width = (stats.shipHavock || 100) + "%";
  el("shipTakanami").style.width = (stats.shipTakanami || 0) + "%";

  const subteams = pers.subteams || ["command", "science"];
  el("subCommand").classList.toggle("active", subteams.includes("command"));
  el("subScience").classList.toggle("active", subteams.includes("science"));

  const rolesGrid = el("rolesGrid");
  rolesGrid.innerHTML = DIVISIONS.map(div => `
    <div class="division-group">
      <div class="division-title">${div.name}</div>
      <div class="division-roles">
        ${div.roles.map(r => `
          <div class="role-item ${roles[r] ? "role-done" : ""}">${r}</div>
        `).join("")}
      </div>
    </div>
  `).join("");

  const deps = stats.deploymentTypes || { military: 50, formation: 20, exploration: 10, cartography: 10, other: 10 };
  renderPieChart(deps);

  loadRecentMissions(user.uid);

  document.getElementById("editCallsign").onclick = () => editField("callsign", p.callsign || "");
  document.getElementById("editPronouns").onclick = () => editField("pronouns", p.pronouns || "");
  document.getElementById("editBio").onclick = () => editField("biography", pers.biography || "", true);
}

async function loadRecentMissions(uid) {
  const q = query(
    collection(db, "missions"),
    where("completedByUid", "==", uid),
    orderBy("completedAt", "desc"),
    limit(10)
  );
  const snap = await getDocs(q);
  const el = document.getElementById("recent-missions");
  if (snap.empty) {
    el.innerHTML = "<p style='opacity:0.5;'>No completed missions.</p>";
    return;
  }
  let html = "<div style='display:flex;flex-direction:column;gap:6px;'>";
  snap.forEach(d => {
    const m = d.data();
    html += `<div style="font-size:13px;padding:6px 10px;background:rgba(255,255,255,0.04);border-left:3px solid #4a9eff;">
      <strong>${escapeHtml(m.name)}</strong>
      <span style="opacity:0.5;margin-left:10px;">${m.type || ""}</span>
    </div>`;
  });
  html += "</div>";
  el.innerHTML = html;
}

function editField(field, current, multiline = false) {
  const modalArea = document.getElementById("modal-area");
  const input = multiline
    ? `<textarea id="editInput" rows="6">${escapeHtml(current)}</textarea>`
    : `<input id="editInput" value="${escapeHtml(current)}">`;

  modalArea.innerHTML = `
    <div class="overlay" onclick="document.getElementById('modal-area').innerHTML=''">
      <div class="modal" onclick="event.stopPropagation()">
        <h3>EDIT ${field.toUpperCase()}</h3>
        ${input}
        <div class="btn-row">
          <button onclick="document.getElementById('modal-area').innerHTML=''" style="background:#333;">CANCEL</button>
          <button id="saveFieldBtn">SAVE</button>
        </div>
      </div>
    </div>`;

  document.getElementById("saveFieldBtn").onclick = async () => {
    const val = document.getElementById("editInput").value.trim();
    const path = field === "biography" ? "personnel.biography" : `profile.${field}`;
    await updateDoc(doc(db, "users", auth.currentUser.uid), { [path]: val });
    document.getElementById("modal-area").innerHTML = "";

    const ref = doc(db, "users", auth.currentUser.uid);
    const snap = await getDoc(ref);
    currentData = snap.data();
    renderProfile(currentData, auth.currentUser);
  };
}

function renderPieChart(deps) {
  const total = Object.values(deps).reduce((a, b) => a + b, 0) || 1;
  let conic = [];
  let deg = 0;
  const legend = [];

  DEPLOYMENT_TYPES.forEach((dt, i) => {
    const pct = ((deps[dt.key] || 0) / total) * 100;
    if (pct > 0) {
      const start = deg;
      deg += (pct / 100) * 360;
      conic.push(`${dt.color} ${start}deg ${deg}deg`);
      legend.push(`<div class="legend-item"><span class="legend-dot" style="background:${dt.color}"></span>${dt.label} ${Math.round(pct)}%</div>`);
    }
  });

  el("pieChart").style.background = `conic-gradient(${conic.join(", ")})`;
  el("chartLegend").innerHTML = legend.join("");
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
