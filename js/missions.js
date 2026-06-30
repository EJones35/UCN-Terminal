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

const ALL_MISSION_ROLES = [
  "Captain", "XO", "Helm", "Weapons", "Shuttle Helm", "Shuttle Generalist",
  "Radar", "Navigation", "Comms", "D&D", "Manual Engineer", "Chief Engineer", "Shuttle Engineer"
];

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
          <span>ROLE: ${m.role || "---"}</span>
          <span>CREATED BY: ${m.createdBy || "---"}</span>
          ${m.completedBy ? `<span>COMPLETED BY: ${m.completedBy}</span>` : ""}
        </div>
        ${canComplete ? `<button onclick="completeMission('${m.id}')" style="background:#4aff4a;color:#000;margin-top:8px;">MARK COMPLETE</button>` : ""}
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
        <label>Required Role</label>
        <select id="mRole">
          ${ALL_MISSION_ROLES.map(r => `<option value="${r}">${r}</option>`).join("")}
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
    const role = document.getElementById("mRole").value;
    if (!name) return;
    const profile = currentUserData.profile || {};

    await addDoc(collection(db, "missions"), {
      name,
      description: desc,
      type,
      role,
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

window.completeMission = async (id) => {
  const m = missions.find(x => x.id === id);
  if (!m) return;
  const profile = currentUserData.profile || {};
  const stats = currentUserData.statistics || {};
  const deps = stats.deploymentTypes || {};
  const roles = (currentUserData.personnel || {}).roles || {};

  await updateDoc(doc(db, "missions", id), {
    status: "completed",
    completedBy: profile.callsign || "Unknown",
    completedByUid: auth.currentUser.uid,
    completedAt: serverTimestamp()
  });

  const depKey = m.type || "other";
  const depCount = (deps[depKey] || 0) + 1;

  const roleKey = m.role;
  const roleUpdate = roleKey ? { [`personnel.roles.${roleKey}`]: true } : {};

  await updateDoc(doc(db, "users", auth.currentUser.uid), {
    "statistics.missions": (stats.missions || 0) + 1,
    [`statistics.deploymentTypes.${depKey}`]: depCount,
    ...roleUpdate
  });

  currentUserData = (await getDoc(doc(db, "users", auth.currentUser.uid))).data();
  await loadMissions();
};

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
