import {
  initAuth,
  signInWithGoogle,
  signInWithEmail,
  logout,
} from "./auth.js";
import {
  db,
  storage,
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteObject,
  storageRef,
  uploadBytesResumable,
  getDownloadURL,
  onSnapshot,
  orderBy,
  query,
  limit,
  serverTimestamp,
  getDoc,
  getDocs,
  httpsCallable,
  functions,
} from "./firebase.js";
import { formatTimestamp, formatCurrency } from "../utils/helpers.js";

const adminToastContainer = document.getElementById("admin-toast");

const adminToast = (message, type = "info") => {
  if (!adminToastContainer) return;
  const div = document.createElement("div");
  div.className = `toast ${type === "success" ? "toast-success" : ""} ${type === "error" ? "toast-error" : ""}`;
  div.textContent = message;
  adminToastContainer.appendChild(div);
  setTimeout(() => div.remove(), 4000);
};

const views = document.querySelectorAll(".admin-view");
const navButtons = document.querySelectorAll(".admin-nav-btn");
const adminAuthStatus = document.getElementById("admin-auth-status");
const adminSignout = document.getElementById("admin-signout");
const videoUploadInput = document.getElementById("video-upload");
const videoLibrary = document.getElementById("video-library");
const tournamentList = document.getElementById("tournament-list");
const questionBank = document.getElementById("question-bank");
const teamTemplates = document.getElementById("team-templates");
const cheatAlerts = document.getElementById("cheat-alerts");
const focusViolations = document.getElementById("focus-violations");
const paymentStats = document.getElementById("payment-stats");
const paymentHistory = document.getElementById("payment-history");
const systemHealth = document.getElementById("system-health");
const dashboardLiveMatches = document.getElementById("dashboard-live-matches");
const dashboardActiveUsers = document.getElementById("dashboard-active-users");
const dashboardPremiumRate = document.getElementById("dashboard-premium-rate");
const runMaintenanceBtn = document.getElementById("run-maintenance");
const broadcastUpdateBtn = document.getElementById("broadcast-update");
const createTournamentBtn = document.getElementById("create-tournament");
const addQuestionBtn = document.getElementById("add-question");
const addTeamTemplateBtn = document.getElementById("add-team-template");
const refreshPaymentsBtn = document.getElementById("refresh-payments");
const saveSettingsBtn = document.getElementById("save-settings");
const razorpayKeyInput = document.getElementById("setting-razorpay-key");
const supportEmailInput = document.getElementById("setting-support-email");
const maintenanceToggle = document.getElementById("toggle-maintenance");

const adminFunctions = {
  broadcast: httpsCallable(functions, "broadcastSystemMessage"),
  runMaintenance: httpsCallable(functions, "runMaintenance"),
};

let activeAdmin = null;
let unsubscribers = [];

const switchView = (name) => {
  views.forEach((view) => view.classList.add("hidden"));
  document.getElementById(`view-${name}`)?.classList.remove("hidden");
  navButtons.forEach((btn) => btn.classList.toggle("bg-slate-900", btn.dataset.view === name));
};

const ensureAdmin = (user) => {
  if (!user?.roles?.admin) {
    adminAuthStatus.textContent = "Admin access required.";
    switchView("dashboard");
    adminToast("You need admin privileges to view this console.", "error");
    return false;
  }
  adminAuthStatus.textContent = `Signed in as ${user.displayName ?? user.email}`;
  return true;
};

const startListeners = () => {
  unsubscribers.forEach((fn) => fn?.());
  unsubscribers = [];

  unsubscribers.push(
    onSnapshot(collection(db, "snaps"), (snapshot) => {
      const snaps = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      videoLibrary.innerHTML = snaps
        .map(
          (snap) => `
        <div class="rounded-3xl bg-slate-900 border border-slate-800 p-4 space-y-3">
          <video src="${snap.url}" controls class="w-full rounded-2xl"></video>
          <div class="space-y-1">
            <div class="text-sm font-semibold">${snap.title}</div>
            <div class="text-xs text-slate-500">${snap.topic}</div>
          </div>
          <button data-delete="${snap.id}" data-path="${snap.storagePath}" class="text-xs text-rose-400 hover:text-rose-300">Delete</button>
        </div>
      `
        )
        .join("");
    })
  );

  unsubscribers.push(
    onSnapshot(collection(db, "tournaments"), (snapshot) => {
      const tournaments = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      dashboardLiveMatches.textContent = tournaments.filter((t) => t.status === "live").length;
      tournamentList.innerHTML = tournaments
        .map(
          (t) => `
        <div class="rounded-3xl bg-slate-900 border border-slate-800 p-5 space-y-3">
          <div class="flex items-center justify-between">
            <div>
              <div class="text-lg font-semibold">${t.name}</div>
              <div class="text-xs uppercase tracking-widest text-slate-500">${t.status}</div>
            </div>
            <div class="text-right text-sm text-slate-400">
              Starts ${formatTimestamp(t.startTime)}
            </div>
          </div>
          <p class="text-sm text-slate-400">${t.description ?? "No description"}</p>
          <div class="flex gap-2 text-xs text-slate-500">
            <span class="badge">${t.subjectFocus ?? "Mixed"}</span>
            <span class="badge">${t.matchFormat ?? "Blitz"}</span>
          </div>
          <div class="flex items-center gap-3">
            <button data-status="${t.id}" class="text-xs text-violet-400 hover:text-violet-300">Toggle Status</button>
            <button data-sync="${t.id}" class="text-xs text-emerald-400 hover:text-emerald-300">Sync Scoreboard</button>
          </div>
        </div>
      `
        )
        .join("");
    })
  );

  const questionQuery = query(collection(db, "questions"), orderBy("createdAt", "desc"), limit(20));
  unsubscribers.push(
    onSnapshot(questionQuery, (snapshot) => {
      questionBank.innerHTML = snapshot.docs
        .map(
          (docSnap) => `
        <div class="rounded-3xl bg-slate-900 border border-slate-800 p-4 space-y-2">
          <div class="text-sm font-semibold">${docSnap.data().prompt}</div>
          <ul class="text-xs text-slate-400 space-y-1">
            ${(docSnap.data().options ?? []).map((option, idx) => `<li>${idx + 1}. ${option}</li>`).join("")}
          </ul>
          <div class="text-[10px] uppercase tracking-widest text-emerald-400">Correct: Option ${
            docSnap.data().correctOption + 1
          }</div>
        </div>
      `
        )
        .join("");
    })
  );

  unsubscribers.push(
    onSnapshot(collection(db, "teamTemplates"), (snapshot) => {
      teamTemplates.innerHTML = snapshot.docs
        .map(
          (docSnap) => `
        <div class="rounded-3xl bg-slate-900 border border-slate-800 p-4 space-y-2">
          <div class="text-sm font-semibold">${docSnap.data().name}</div>
          <div class="text-xs text-slate-400">${docSnap.data().description}</div>
          <div class="text-xs text-slate-500">${docSnap.data().roster.length} players</div>
        </div>
      `
        )
        .join("");
    })
  );

  const alertsQuery = query(collection(db, "antiCheatEvents"), orderBy("createdAt", "desc"), limit(20));
  unsubscribers.push(
    onSnapshot(alertsQuery, (snapshot) => {
      const events = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      cheatAlerts.innerHTML = events
        .filter((event) => event.type !== "blur")
        .map(
          (event) => `
        <div class="rounded-2xl bg-slate-900 border border-slate-800 p-3">
          <div class="text-xs text-slate-400">${formatTimestamp(event.createdAt)}</div>
          <div class="text-sm text-slate-200">${event.type} — ${event.meta?.combo ?? ""}</div>
        </div>
      `
        )
        .join("");
      focusViolations.innerHTML = events
        .filter((event) => event.type === "blur" || event.type === "tabSwitch")
        .map(
          (event) => `
        <div class="rounded-2xl bg-slate-900 border border-slate-800 p-3">
          <div class="text-xs text-slate-400">${formatTimestamp(event.createdAt)}</div>
          <div class="text-sm text-slate-200">${event.type}</div>
        </div>
      `
        )
        .join("");
    })
  );

  const paymentsQuery = query(collection(db, "payments"), orderBy("createdAt", "desc"), limit(15));
  unsubscribers.push(
    onSnapshot(paymentsQuery, (snapshot) => {
      const payments = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      const totalRevenue = payments.reduce((sum, payment) => sum + (payment.amount ?? 0), 0);
      const activeSubs = payments.filter((payment) => payment.status === "active").length;
      paymentStats.innerHTML = `
        <div class="rounded-2xl bg-slate-900 border border-slate-800 p-4">
          <div class="text-xs text-slate-500 uppercase tracking-widest">Revenue (30d)</div>
          <div class="text-2xl font-bold">${formatCurrency(totalRevenue)}</div>
        </div>
        <div class="rounded-2xl bg-slate-900 border border-slate-800 p-4">
          <div class="text-xs text-slate-500 uppercase tracking-widest">Active Premium</div>
          <div class="text-2xl font-bold">${activeSubs}</div>
        </div>
        <div class="rounded-2xl bg-slate-900 border border-slate-800 p-4">
          <div class="text-xs text-slate-500 uppercase tracking-widest">ARPU</div>
          <div class="text-2xl font-bold">₹${activeSubs ? Math.round(totalRevenue / activeSubs / 100) : 0}</div>
        </div>
      `;
      paymentHistory.innerHTML = payments
        .map(
          (payment) => `
        <div class="rounded-2xl bg-slate-900 border border-slate-800 p-3 flex items-center justify-between">
          <div>
            <div class="text-sm font-semibold">${payment.email}</div>
            <div class="text-xs text-slate-500">${formatTimestamp(payment.createdAt)}</div>
          </div>
          <div class="text-right">
            <div class="text-sm font-semibold">${formatCurrency(payment.amount ?? 0)}</div>
            <div class="text-[10px] uppercase tracking-widest text-slate-500">${payment.status}</div>
          </div>
        </div>
      `
        )
        .join("");
    })
  );

  const healthQuery = query(collection(db, "systemHealth"), orderBy("updatedAt", "desc"), limit(6));
  unsubscribers.push(
    onSnapshot(healthQuery, (snapshot) => {
      systemHealth.innerHTML = snapshot.docs
        .map(
          (docSnap) => `
        <div class="rounded-2xl bg-slate-900 border border-slate-800 p-4">
          <div class="text-xs uppercase tracking-widest text-slate-500">${docSnap.data().service}</div>
          <div class="text-sm font-semibold">${docSnap.data().status}</div>
          <div class="text-[10px] text-slate-500">${formatTimestamp(docSnap.data().updatedAt)}</div>
        </div>
      `
        )
        .join("");
    })
  );

  unsubscribers.push(
    onSnapshot(collection(db, "presence"), (snapshot) => {
      const activeUsers = snapshot.docs.filter(
        (docSnap) => Date.now() - docSnap.data().updatedAt?.toMillis?.() < 15 * 60 * 1000
      ).length;
      dashboardActiveUsers.textContent = activeUsers;
    })
  );

  unsubscribers.push(
    onSnapshot(collection(db, "premiumStatus"), (snapshot) => {
      const totalUsers = snapshot.size || 1;
      const premium = snapshot.docs.filter((docSnap) => docSnap.data().active).length;
      dashboardPremiumRate.textContent = `${Math.round((premium / totalUsers) * 100)}%`;
    })
  );
};

const loadSettings = async () => {
  const settingsSnap = await getDocs(collection(db, "platformSettings"));
  settingsSnap.forEach((docSnap) => {
    const data = docSnap.data();
    if (docSnap.id === "public") {
      razorpayKeyInput.value = data.razorpayKeyId ?? "";
      supportEmailInput.value = data.supportEmail ?? "";
      maintenanceToggle.checked = !!data.maintenance;
    }
  });
};

navButtons.forEach((btn) =>
  btn.addEventListener("click", () => {
    switchView(btn.dataset.view);
  })
);

adminSignout?.addEventListener("click", () => logout());

videoLibrary?.addEventListener("click", async (event) => {
  const target = event.target;
  const id = target.dataset.delete;
  const path = target.dataset.path;
  if (!id || !path) return;
  try {
    await deleteObject(storageRef(storage, path));
    await setDoc(doc(db, "snaps", id), { deletedAt: serverTimestamp() }, { merge: true });
    adminToast("Snap removed.", "success");
  } catch (error) {
    console.error(error);
    adminToast("Failed to delete snap.", "error");
  }
});

videoUploadInput?.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 80 * 1024 * 1024) {
    adminToast("Max file size is 80MB.", "error");
    return;
  }
  const storagePath = `snaps/${Date.now()}_${file.name}`;
  const ref = storageRef(storage, storagePath);
  const task = uploadBytesResumable(ref, file, { contentType: file.type });
  adminToast("Uploading snap…", "info");
  task.on(
    "state_changed",
    null,
    (error) => {
      console.error(error);
      adminToast("Upload failed.", "error");
    },
    async () => {
      const url = await getDownloadURL(task.snapshot.ref);
      await addDoc(collection(db, "snaps"), {
        title: prompt("Snap title", file.name.replace(/\.[^/.]+$/, "")) ?? file.name,
        topic: prompt("Topic focus", "General") ?? "General",
        url,
        storagePath,
        createdAt: serverTimestamp(),
        duration: 60,
      });
      adminToast("Study Snap uploaded successfully.", "success");
    }
  );
});

createTournamentBtn?.addEventListener("click", async () => {
  try {
    const name = prompt("Tournament name", "StudySnaps Super League");
    if (!name) return;
    const subjectFocus = prompt("Subject focus", "Mixed");
    const prizePool = Number(prompt("Prize pool (₹)", "5000") ?? 0);
    await addDoc(collection(db, "tournaments"), {
      name,
      subjectFocus,
      prizePool,
      status: "upcoming",
      description: "High intensity Study IPL rounds.",
      startTime: serverTimestamp(),
      createdAt: serverTimestamp(),
      playerCount: 0,
    });
    adminToast("Tournament created.", "success");
  } catch (error) {
    console.error(error);
    adminToast("Could not create tournament.", "error");
  }
});

tournamentList?.addEventListener("click", async (event) => {
  const target = event.target;
  if (target.dataset.status) {
    const ref = doc(db, "tournaments", target.dataset.status);
    const snap = await getDoc(ref);
    const current = snap.data()?.status ?? "upcoming";
    const nextStatus = current === "live" ? "completed" : "live";
    await updateDoc(ref, { status: nextStatus });
    adminToast(`Tournament marked as ${nextStatus}.`, "success");
  }
  if (target.dataset.sync) {
    adminToast("Simulating scoreboard sync…", "info");
    await setDoc(
      doc(db, "tournaments", target.dataset.sync, "meta", "scoreboard"),
      {
        teams: [
          { name: "Quantum Blazers", captain: "Riya Agarwal", points: 128 },
          { name: "Reasoning Raiders", captain: "Arjun Mehta", points: 116 },
        ],
        mvps: [
          { name: "Neha Kapoor", subject: "Verbal Ability", points: 48 },
          { name: "Dev Verma", subject: "Mathematics", points: 45 },
        ],
        momentum: [
          { time: "12:01", event: "Quantum Blazers sweep speed round." },
          { time: "12:04", event: "Reasoning Raiders close gap with puzzle streak." },
        ],
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    adminToast("Scoreboard synced.", "success");
  }
});

addQuestionBtn?.addEventListener("click", async () => {
  const promptText = prompt("Question prompt");
  if (!promptText) return;
  const options = [];
  for (let i = 1; i <= 4; i += 1) {
    const option = prompt(`Option ${i}`);
    if (option) options.push(option);
  }
  const correctOption = Number(prompt("Correct option number (1-4)", "1")) - 1;
  await addDoc(collection(db, "questions"), {
    prompt: promptText,
    options,
    correctOption,
    createdAt: serverTimestamp(),
  });
  adminToast("Question added to bank.", "success");
});

addTeamTemplateBtn?.addEventListener("click", async () => {
  const name = prompt("Template name", "Elite Squad");
  if (!name) return;
  const description = prompt("Template description", "Balanced across reasoning and quant.") ?? "";
  await addDoc(collection(db, "teamTemplates"), {
    name,
    description,
    roster: [],
    createdAt: serverTimestamp(),
  });
  adminToast("Template saved.", "success");
});

refreshPaymentsBtn?.addEventListener("click", () => adminToast("Payment metrics refreshed.", "success"));

runMaintenanceBtn?.addEventListener("click", async () => {
  adminToast("Triggering maintenance script…", "info");
  await adminFunctions.runMaintenance();
  adminToast("Maintenance script executed.", "success");
});

broadcastUpdateBtn?.addEventListener("click", async () => {
  const message = prompt("Broadcast message");
  if (!message) return;
  await adminFunctions.broadcast({ message });
  adminToast("Broadcast sent to users.", "success");
});

saveSettingsBtn?.addEventListener("click", async () => {
  await setDoc(
    doc(db, "platformSettings", "public"),
    {
      razorpayKeyId: razorpayKeyInput.value,
      supportEmail: supportEmailInput.value,
      maintenance: maintenanceToggle.checked,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  adminToast("Platform settings updated.", "success");
});

initAuth((user) => {
  activeAdmin = user;
  if (!user) {
    adminToast("Sign in required for admin console.", "error");
    adminAuthStatus.innerHTML = `
      <div class="space-y-3">
        <div class="text-sm text-slate-400">Authenticate to continue.</div>
        <div class="flex gap-2">
          <button id="admin-google" class="px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-xs font-semibold">Google</button>
          <button id="admin-email" class="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs font-semibold">Email</button>
        </div>
      </div>
    `;
    const googleBtn = document.getElementById("admin-google");
    const emailBtn = document.getElementById("admin-email");
    googleBtn?.addEventListener("click", () => signInWithGoogle());
    emailBtn?.addEventListener("click", async () => {
      const email = prompt("Admin email");
      const password = prompt("Password");
      if (email && password) await signInWithEmail(email, password);
    });
    return;
  }

  if (!ensureAdmin(user)) return;
  loadSettings();
  startListeners();
  switchView("dashboard");
});
