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
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import { initNav } from "./nav.js";

initNav("missions");

const MISSION_TYPES = [
  "Military", "Exploration", "Diplomacy", "Intrigue", "Frontline"
];

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
let campaigns = [];
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
    await Promise.all([loadMissions(), loadCampaigns()]);
  } catch (e) {
    document.getElementById("mission-list").innerHTML =
      `<p style="color:#ff4a4a;">Failed to load data. Check Firestore rules for the <code>missions</code> and <code>campaigns</code> collections.</p>`;
  }
});

async function loadMissions() {
  const q = query(collection(db, "missions"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  missions = [];
  snap.forEach(d => missions.push({ id: d.id, ...d.data() }));
  render();
}

async function loadCampaigns() {
  const q = query(collection(db, "campaigns"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  campaigns = [];
  snap.forEach(d => campaigns.push({ id: d.id, ...d.data() }));
  render();
}

function formatDate(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function render() {
  const uid = auth.currentUser?.uid;
  const data = currentUserData || {};
  const perms = data.permissions || {};
  const p2 = data.profile || {};
  const isAdmin = perms.admin || p2.role === "admin";
  renderCampaigns(uid);
  renderMissions(uid, isAdmin);
}

function renderCampaigns(uid) {
  const container = document.getElementById("campaign-list");
  let html = "";

  for (const c of campaigns) {
    const completedInCampaign = missions.filter(m => m.campaignId === c.id && m.status === "completed").length;
    const totalInCampaign = missions.filter(m => m.campaignId === c.id).length;
    const pct = totalInCampaign ? Math.round(completedInCampaign / totalInCampaign * 100) : 0;
    const isCreator = c.createdByUid === uid;
    const canClose = c.status !== "completed" && isCreator && totalInCampaign >= 5;

    html += `
      <div class="campaign-card">
        <div style="display:flex;justify-content:space-between;align-items:start;">
          <div>
            <strong>${escapeHtml(c.name)}</strong>
            <span style="font-size:11px;opacity:0.5;margin-left:8px;">${c.status === "completed" ? "COMPLETED" : "ACTIVE"}</span>
          </div>
          <span style="font-size:12px;">${completedInCampaign}/${totalInCampaign} missions</span>
        </div>
        ${c.description ? `<p style="font-size:12px;opacity:0.6;margin:4px 0;">${escapeHtml(c.description)}</p>` : ""}
        <div class="campaign-track"><div class="campaign-fill" style="width:${pct}%"></div></div>
        <div style="font-size:10px;opacity:0.4;margin-top:4px;">Created ${c.createdAt ? formatDate(c.createdAt) : ""}</div>
        ${canClose ? `<button onclick="closeCampaign('${c.id}')" style="background:#ffcc00;color:#000;margin-top:6px;">CLOSE CAMPAIGN</button>` : ""}
        ${c.completedAt ? `<div style="font-size:10px;opacity:0.4;margin-top:2px;">Closed ${formatDate(c.completedAt)}</div>` : ""}
      </div>`;
  }

  container.innerHTML = html || "<p style='opacity:0.4;'>No campaigns yet.</p>";
}

function renderMissions(uid, isAdmin) {
  const filtered = missions.filter(m => filter === "all" || m.status === filter);

  let html = `<div style="display:flex;gap:10px;margin-bottom:15px;">
    <button onclick="showCreateCampaign()">+ NEW CAMPAIGN</button>
    <button onclick="showCreateMission()">+ NEW MISSION</button>
  </div>
  <div style="display:flex;flex-direction:column;gap:10px;">`;

  for (const m of filtered) {
    const isCreator = m.createdByUid === uid;
    const isCompleted = m.status === "completed";
    const canComplete = !isCompleted;
    const campaignName = campaigns.find(c => c.id === m.campaignId)?.name;
    const displayDate = m.completedDate || (m.completedAt ? formatDate(m.completedAt) : "");

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
          ${campaignName ? `<span>CAMPAIGN: ${campaignName}</span>` : ""}
          ${isAdmin ? `<span>CREATED BY: ${m.createdBy || "---"}</span>` : ""}
          ${m.role ? `<span>ROLE: ${m.role}</span>` : ""}
          ${m.ship ? `<span>SHIP: ${m.ship}</span>` : ""}
          ${isAdmin && m.completedBy ? `<span>COMPLETED BY: ${m.completedBy}</span>` : ""}
          ${displayDate ? `<span>DATE: ${displayDate}</span>` : ""}
        </div>
        ${canComplete ? `<button onclick="showCompleteMission('${m.id}')" style="background:#4aff4a;color:#000;margin-top:8px;">COMPLETE</button>` : ""}
        ${isAdmin && !isCompleted ? `<button onclick="deleteMission('${m.id}')" style="background:#ff4a4a;margin-top:8px;margin-left:6px;">DELETE</button>` : ""}
      </div>`;
  }

  html += "</div>";
  document.getElementById("mission-list").innerHTML = html;
}

window.showCreateCampaign = () => {
  const modalArea = document.getElementById("modal-area");
  modalArea.innerHTML = `
    <div class="overlay" onclick="closeModal(event)">
      <div class="modal" onclick="event.stopPropagation()">
        <h3>CREATE CAMPAIGN</h3>
        <label>Campaign Name</label>
        <input id="cName">
        <label>Description</label>
        <textarea id="cDesc" rows="3"></textarea>
        <div class="btn-row">
          <button onclick="document.getElementById('modal-area').innerHTML=''" style="background:#333;">CANCEL</button>
          <button id="createCampaignBtn">CREATE</button>
        </div>
      </div>
    </div>`;

  document.getElementById("createCampaignBtn").onclick = async () => {
    const name = document.getElementById("cName").value.trim();
    const desc = document.getElementById("cDesc").value.trim();
    if (!name) return;
    const profile = currentUserData.profile || {};

    await addDoc(collection(db, "campaigns"), {
      name,
      description: desc,
      status: "active",
      createdBy: profile.callsign || "Unknown",
      createdByUid: auth.currentUser.uid,
      createdAt: serverTimestamp(),
      completedAt: null
    });

    document.getElementById("modal-area").innerHTML = "";
    await loadCampaigns();
  };
};

window.closeCampaign = async (id) => {
  await updateDoc(doc(db, "campaigns", id), {
    status: "completed",
    completedAt: serverTimestamp()
  });
  await loadCampaigns();
};

window.showCreateMission = () => {
  const modalArea = document.getElementById("modal-area");
  const activeCampaigns = campaigns.filter(c => c.status !== "completed");

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
          ${MISSION_TYPES.map(t => `<option value="${t.toLowerCase()}">${t}</option>`).join("")}
        </select>
        <label>Campaign (optional)</label>
        <select id="mCampaign">
          <option value="">-- None --</option>
          ${activeCampaigns.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("")}
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
    const campaignId = document.getElementById("mCampaign").value;
    if (!name) return;
    const profile = currentUserData.profile || {};

    const missionData = {
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
    };
    if (campaignId) missionData.campaignId = campaignId;

    await addDoc(collection(db, "missions"), missionData);
    document.getElementById("modal-area").innerHTML = "";
    await loadMissions();
  };
};

window.showCompleteMission = (id) => {
  const today = new Date().toISOString().slice(0, 10);
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
        <label>Date</label>
        <input type="date" id="completeDate" value="${today}">
        <div class="btn-row">
          <button onclick="document.getElementById('modal-area').innerHTML=''" style="background:#333;">CANCEL</button>
          <button id="confirmCompleteBtn">CONFIRM</button>
        </div>
      </div>
    </div>`;

  document.getElementById("confirmCompleteBtn").onclick = () => {
    const role = document.getElementById("completeRole").value;
    const ship = document.getElementById("completeShip").value;
    const date = document.getElementById("completeDate").value;
    document.getElementById("modal-area").innerHTML = "";
    completeMission(id, role, ship, date);
  };
};

async function completeMission(id, role, ship, date) {
  const m = missions.find(x => x.id === id);
  if (!m) return;
  const profile = currentUserData.profile || {};
  const stats = currentUserData.statistics || {};
  const deps = stats.deploymentTypes || {};
  const pers = currentUserData.personnel || {};
  const existingSubteams = pers.subteams || [];

  const depKey = m.type;
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
    completedDate: date,
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
