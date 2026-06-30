import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import { initNav } from "./nav.js";

initNav("admin");
const loadingEl = document.getElementById("loading");
const tableEl = document.getElementById("user-table");
const statusEl = document.getElementById("status");

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "auth.html";
    return;
  }

  const selfRef = doc(db, "users", user.uid);
  const selfSnap = await getDoc(selfRef);

  if (!selfSnap.exists()) {
    window.location.href = "home.html";
    return;
  }

  const selfData = selfSnap.data();
  const selfProfile = selfData.profile || {};
  if (!(selfData.permissions?.admin || selfProfile.role === "admin")) {
    window.location.href = "home.html";
    return;
  }

  await loadAllUsers();
});

async function loadAllUsers() {
  const querySnap = await getDocs(collection(db, "users"));
  const users = [];
  querySnap.forEach(d => users.push({ uid: d.id, ...d.data() }));

  loadingEl.style.display = "none";
  tableEl.style.display = "block";

  let html = `<table>
    <tr>
      <th>CALLSIGN</th>
      <th>NAME</th>
      <th>RANK</th>
      <th>ROLE</th>
      <th>EMAIL</th>
      <th>STATUS</th>
      <th>ACTIONS</th>
    </tr>`;

  for (const u of users) {
    const p = u.profile || {};
    const acc = u.account || {};
    const banned = acc.banned ? '<span class="banned">BANNED</span>' : '<span class="active">ACTIVE</span>';
    const isAdmin = u.permissions?.admin || p.role === "admin";
    const adminBadge = isAdmin ? '<span class="badge-admin">[ADMIN]</span>' : '';

    html += `<tr>
      <td>${p.callsign || "---"}${adminBadge}</td>
      <td>${p.displayName || "---"}</td>
      <td>${p.rank || "---"}</td>
      <td>${p.role || "---"}</td>
      <td style="font-size:12px;">${p.email || "---"}</td>
      <td>${banned}</td>
      <td>
        <button onclick="editUser('${u.uid}')">EDIT</button>
        <button onclick="${acc.banned ? `unbanUser('${u.uid}')` : `banUser('${u.uid}')`}" style="${acc.banned ? 'background:#4aff4a;color:#000;' : 'background:#ff4a4a;'}">
          ${acc.banned ? "UNBAN" : "BAN"}
        </button>
        <button onclick="confirmDelete('${u.uid}')" style="background:#ff4a4a;">DELETE</button>
      </td>
    </tr>`;
  }

  html += "</table>";
  tableEl.innerHTML = html;
}

window.banUser = async (uid) => {
  await updateDoc(doc(db, "users", uid), { "account.banned": true });
  statusEl.textContent = "USER BANNED";
  await loadAllUsers();
};

window.unbanUser = async (uid) => {
  await updateDoc(doc(db, "users", uid), { "account.banned": false });
  statusEl.textContent = "USER UNBANNED";
  await loadAllUsers();
};

window.confirmDelete = async (uid) => {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return;
  const data = snap.data();
  const p = data.profile || {};

  const modalArea = document.getElementById("modal-area");
  modalArea.innerHTML = `
    <div class="overlay" onclick="closeModal(event)">
      <div class="modal" onclick="event.stopPropagation()" style="text-align:center;">
        <h3 style="color:#ff4a4a;">PERMANENTLY DELETE PERSONNEL?</h3>
        <p>${escapeHtml(p.callsign || "---")} — ${escapeHtml(p.displayName || "Unidentified")}</p>
        <p style="font-size:12px;color:#ff4a4a;">This cannot be undone. Their Firestore record will be erased.</p>
        <div class="btn-row" style="justify-content:center;">
          <button onclick="closeModal()" style="background:#333;">CANCEL</button>
          <button onclick="deleteUser('${uid}')" style="background:#ff4a4a;">DELETE PERMANENTLY</button>
        </div>
      </div>
    </div>`;
};

window.deleteUser = async (uid) => {
  await deleteDoc(doc(db, "users", uid));
  closeModal();
  statusEl.textContent = "PERSONNEL RECORD DELETED";
  await loadAllUsers();
};

window.editUser = async (uid) => {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return;
  const data = snap.data();
  const p = data.profile || {};

  const modalArea = document.getElementById("modal-area");
  modalArea.innerHTML = `
    <div class="overlay" onclick="closeModal(event)">
      <div class="modal" onclick="event.stopPropagation()">
        <h3>EDIT PERSONNEL — ${p.callsign || uid}</h3>
        <label>Display Name</label>
        <input id="edit-name" value="${escapeHtml(p.displayName || "")}">
        <label>Callsign</label>
        <input id="edit-callsign" value="${escapeHtml(p.callsign || "")}">
        <label>Rank</label>
        <input id="edit-rank" value="${escapeHtml(p.rank || "")}">
        <label>Role</label>
        <select id="edit-role">
          <option value="user" ${p.role === "user" ? "selected" : ""}>User</option>
          <option value="admin" ${p.role === "admin" ? "selected" : ""}>Admin</option>
        </select>
        <label>Contact Email</label>
        <input id="edit-email" value="${escapeHtml(p.email || "")}">
        <div class="btn-row">
          <button onclick="closeModal()" style="background:#333;">CANCEL</button>
          <button onclick="saveEdit('${uid}')">SAVE</button>
        </div>
      </div>
    </div>`;
};

window.saveEdit = async (uid) => {
  const name = document.getElementById("edit-name").value.trim();
  const callsign = document.getElementById("edit-callsign").value.trim();
  const rank = document.getElementById("edit-rank").value.trim();
  const role = document.getElementById("edit-role").value;
  const email = document.getElementById("edit-email").value.trim();

  await updateDoc(doc(db, "users", uid), {
    "profile.displayName": name,
    "profile.callsign": callsign,
    "profile.rank": rank,
    "profile.role": role,
    "profile.email": email,
    "permissions.admin": role === "admin"
  });

  closeModal();
  statusEl.textContent = "PERSONNEL UPDATED";
  await loadAllUsers();
};

window.closeModal = (e) => {
  if (e && e.target !== e.currentTarget) return;
  document.getElementById("modal-area").innerHTML = "";
};

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
