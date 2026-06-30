import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import { initNav } from "./nav.js";

initNav("missions");

const ROLE_SUBTEAMS = {
  "Captain": "command",
  "XO": "command",
  "Helm": "operations",
  "Weapons": "operations",
  "Shuttle Helm": "operations",
  "Shuttle Generalist": "operations",
  "Radar": "science",
  "Navigation": "science",
  "Comms": "science",
  "D&D": "engineering",
  "Manual Engineer": "engineering",
  "Chief Engineer": "engineering",
  "Shuttle Engineer": "engineering"
};

const ALL_MISSION_ROLES = Object.keys(ROLE_SUBTEAMS);
const SHIPS = ["Havock", "Takanami"];

let filter = "active";
let missions = [];
let currentUserData = null;

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = "auth.html"; return; }

  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists()) { window.location.href = "auth.html"; return; }
  currentUserData = snap.data();

  document.getElementById("showActive").onclick = () => { filter = "active"; render(); };
  document.getElementById("showCompleted").onclick = () => { filter = "completed"; render(); };
  document.getElementById("showAll").onclick = () => { filter = "all"; render(); };

  try {
    await loadMissions();
  } catch (e) {
    document.getElementById("mission-list").innerHTML =
      `<p style="color:#ff4a4a;">Failed to load missions. Check Firestore rules for the <code>missions</code> collection.</p>`;
  }
});

async function loadMissions() {
  const q = query(collection(db, "missions"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  missions = [];
  snap.forEach(d => missions.push({ id: d.id, ...d.data() }));
  render();
}

function render() {
  const filtered = missions.filter(m => filter === "all" || m.status === filter);

  let html = `<button onclick="showCreateMission()" style="margin-bottom:15px;">+ NEW MISSION</button>
    <div style="display:flex;flex-direction:column;gap:10px;">`;

  for (const m of filtered) {
    const uid = auth.currentUser?.uid;
    const isCreator = m.createdByUid === uid;
    const isCompleted = m.status === "completed";
    const canComplete = !isCompleted && m.createdByUid !== uid;

    html += `
      <div class="panel mission-card" style="margin:0;">
        <div style="display:flex;justify-content:space-between;align-items:start;">
          <div>
            <strong>${escapeHtml(m.name)}</strong>
            <span class="mission-type">${m.type || "---"}</span>
          </div>
          <span class="mission-status ${m.status}">${m.status.toUpperCase()}</span>
        </div>
        <p style="font-size:13px;opacity:0.7;margin:6px 0;">${escapeHtml(m.description || "")}</p>
        <div style="font-size:11px;opacity:0.5;display:flex;gap:15px;flex-wrap:wrap;">
          <span>CREATED BY: ${m.createdBy || "---"}</span>
          ${m.role ? `<span>ROLE: ${m.role}</span>` : ""}
          ${m.ship ? `<span>SHIP: ${m.ship}</span>` : ""}
          ${m.completedBy ? `<span>COMPLETED BY: ${m.completedBy}</span>` : ""}
        </div>
        ${canComplete ? `<button onclick="showCompleteMission('${m.id}')" style="background:#4aff4a;color:#000;margin-top:8px;">COMPLETE</button>` : ""}
        ${isCreator && !isCompleted ? `<button onclick="deleteMission('${m.id}')" style="background:#ff4a4a;margin-top:8px;margin-left:6px;">DELETE</button>` : ""}
      </div>`;
  }

  html += "</div>";
  document.getElementById("mission-list").innerHTML = html;
}

window.showCreateMission = () => {
  const modalArea = document.getElementById("modal-area");
  modalArea.innerHTML = `
    <div class="overlay" onclick="closeModal(event)">
      <div class="modal" onclick="event.stopPropagation()">
        <h3>CREATE MISSION</h3>
        <label>Mission Name</label>
        <input id="mName">
        <label>Description</label>
        <textarea id="mDesc" rows="3"></textarea>
        <label>Type</label>
        <select id="mType">
          <option value="military">MILITARY</option>
          <option value="formation">FORMATION</option>
          <option value="exploration">EXPLORATION</option>
          <option value="cartography">CARTOGRAPHY</option>
          <option value="other">OTHER</option>
        </select>
        <div class="btn-row">
          <button onclick="document.getElementById('modal-area').innerHTML=''" style="background:#333;">CANCEL</button>
          <button id="createMissionBtn">CREATE</button>
        </div>
      </div>
    </div>`;

  document.getElementById("createMissionBtn").onclick = async () => {
    const name = document.getElementById("mName").value.trim();
    const desc = document.getElementById("mDesc").value.trim();
    const type = document.getElementById("mType").value;
    if (!name) return;
    const profile = currentUserData.profile || {};

    await addDoc(collection(db, "missions"), {
      name,
      description: desc,
      type,
      status: "active",
      createdBy: profile.callsign || "Unknown",
      createdByUid: auth.currentUser.uid,
      createdAt: serverTimestamp(),
      completedBy: "",
      completedByUid: "",
      completedAt: null
    });

    document.getElementById("modal-area").innerHTML = "";
    await loadMissions();
  };
};

window.showCompleteMission = (id) => {
  const modalArea = document.getElementById("modal-area");
  modalArea.innerHTML = `
    <div class="overlay" onclick="closeModal(event)">
      <div class="modal" onclick="event.stopPropagation()">
        <h3>COMPLETE MISSION</h3>
        <label>Role Performed</label>
        <select id="completeRole">
          ${ALL_MISSION_ROLES.map(r => `<option value="${r}">${r}</option>`).join("")}
        </select>
        <label>Ship</label>
        <select id="completeShip">
          ${SHIPS.map(s => `<option value="${s}">${s}</option>`).join("")}
        </select>
        <div class="btn-row">
          <button onclick="document.getElementById('modal-area').innerHTML=''" style="background:#333;">CANCEL</button>
          <button id="confirmCompleteBtn">CONFIRM</button>
        </div>
      </div>
    </div>`;

  document.getElementById("confirmCompleteBtn").onclick = () => {
    const role = document.getElementById("completeRole").value;
    const ship = document.getElementById("completeShip").value;
    document.getElementById("modal-area").innerHTML = "";
    completeMission(id, role, ship);
  };
};

async function completeMission(id, role, ship) {
  const m = missions.find(x => x.id === id);
  if (!m) return;
  const profile = currentUserData.profile || {};
  const stats = currentUserData.statistics || {};
  const deps = stats.deploymentTypes || {};
  const pers = currentUserData.personnel || {};
  const existingRoles = pers.roles || {};
  const existingSubteams = pers.subteams || [];

  const depKey = m.type || "other";
  const shipKey = "ship" + ship.charAt(0).toUpperCase() + ship.slice(1);

  const subteam = ROLE_SUBTEAMS[role];
  const newSubteams = existingSubteams.includes(subteam) ? existingSubteams : [...existingSubteams, subteam];

  const updateFields = {
    "statistics.missions": (stats.missions || 0) + 1,
    [`statistics.deploymentTypes.${depKey}`]: (deps[depKey] || 0) + 1,
    [`statistics.${shipKey}`]: (stats[shipKey] || 0) + 1,
    [`personnel.roles.${role}`]: true,
    "personnel.subteams": newSubteams
  };

  await updateDoc(doc(db, "users", auth.currentUser.uid), updateFields);

  await updateDoc(doc(db, "missions", id), {
    status: "completed",
    role,
    ship,
    completedBy: profile.callsign || "Unknown",
    completedByUid: auth.currentUser.uid,
    completedAt: serverTimestamp()
  });

  currentUserData = (await getDoc(doc(db, "users", auth.currentUser.uid))).data();
  await loadMissions();
}

window.deleteMission = async (id) => {
  await deleteDoc(doc(db, "missions", id));
  await loadMissions();
};

window.closeModal = (e) => {
  if (e && e.target !== e.currentTarget) return;
  document.getElementById("modal-area").innerHTML = "";
};

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
