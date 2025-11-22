import { initAuth, signInWithGoogle, signInWithEmail, logout } from "./auth.js";
import {
  subscribeToLiveTournaments,
  subscribeToScoreboard,
  subscribeToFixtures,
  subscribeToUserTournaments,
  getDefaultLineup,
  subscribeToTeam,
  saveTeam,
  joinTournament,
  subscribeToQuestion,
  submitAnswer,
  subscribeToPremiumStatus,
  updatePresence,
  computeTeamPower,
  DEFAULT_PLAYER_POOL,
} from "./tournamentEngine.js";
import { initiatePremiumPurchase } from "./payments.js";
import { initAds } from "./adManager.js";
import { startAntiCheatSession, stopAntiCheatSession } from "./antiCheat.js";
import { showToast, toggleModal, updateElement } from "./ui.js";
import { padTime } from "../utils/helpers.js";

const authBtn = document.getElementById("auth-btn");
const authStatus = document.getElementById("auth-status");
const premiumBadge = document.getElementById("premium-badge");
const premiumStatus = document.getElementById("premium-status");
const startPremiumBtn = document.getElementById("start-premium");
const navPremium = document.getElementById("nav-premium");
const upgradeFromAd = document.getElementById("upgrade-from-ad");

const liveTournamentContainer = document.getElementById("live-tournaments");
const userTournamentContainer = document.getElementById("user-tournaments");
const liveScoreboard = document.getElementById("live-scoreboard");
const teamLineup = document.getElementById("team-lineup");
const upcomingFixtures = document.getElementById("upcoming-fixtures");
const questionBody = document.getElementById("question-body");
const questionSubmit = document.getElementById("question-submit");
const questionFeedback = document.getElementById("question-feedback");
const questionTimer = document.getElementById("question-timer");
const videoElement = document.getElementById("study-video");
const videoMeta = document.getElementById("video-meta");
const bookmarkBtn = document.getElementById("bookmark-btn");
const currentYear = document.getElementById("current-year");

const teamModal = document.getElementById("team-modal");
const leaderboardModal = document.getElementById("leaderboard-modal");
const editTeamBtn = document.getElementById("edit-team-btn");
const closeTeamModal = document.getElementById("close-team-modal");
const saveTeamBtn = document.getElementById("save-team");
const selectedPlayersContainer = document.getElementById("selected-players");
const playerPoolContainer = document.getElementById("player-pool");
const playerSearchInput = document.getElementById("player-search");

const viewLeaderboardBtn = document.getElementById("view-leaderboard");
const closeLeaderboardBtn = document.getElementById("close-leaderboard");
const leaderboardTeams = document.getElementById("leaderboard-teams");
const leaderboardPlayers = document.getElementById("leaderboard-players");
const matchFeed = document.getElementById("match-feed");

const refreshTournamentsBtn = document.getElementById("refresh-tournaments");
const premiumTriggerButtons = [startPremiumBtn, navPremium, upgradeFromAd].filter(Boolean);

currentYear.textContent = new Date().getFullYear();

let activeUser = null;
let activeTournament = null;
let activeTeam = [];
let activeQuestion = null;
let antiCheatSession = null;

let unsubscribeTournaments = null;
let unsubscribeScoreboard = null;
let unsubscribeFixtures = null;
let unsubscribeUserTournaments = null;
let unsubscribeTeam = null;
let unsubscribeQuestion = null;
let unsubscribePremium = null;

const AUTH_PROMPT = `
<div class="space-y-3">
  <p class="text-slate-300">Sign in to save progress, join tournaments, and sync your team.</p>
  <div class="flex gap-2">
    <button id="auth-google" class="flex-1 px-4 py-2 rounded-full bg-white/10 border border-white/20 hover:bg-white/20 transition text-sm font-semibold">Google</button>
    <button id="auth-email" class="flex-1 px-4 py-2 rounded-full bg-slate-900 border border-slate-700 hover:bg-slate-800 transition text-sm font-semibold">Email</button>
  </div>
</div>
`;

const state = {
  tournaments: [],
  fixtures: [],
  scoreboard: null,
  userTournaments: [],
  leaderboard: {
    teams: [],
    players: [],
    feed: [],
  },
};

const renderScoreboard = () => {
  if (!state.scoreboard) {
    liveScoreboard.innerHTML = `<p class="text-slate-500 text-sm">Join a tournament to see live scores.</p>`;
    return;
  }
  const { teams = [], momentum = [] } = state.scoreboard;
  liveScoreboard.innerHTML = teams
    .map(
      (team) => `
    <div class="flex items-center justify-between px-4 py-3 rounded-2xl bg-slate-900 border border-slate-800">
      <div>
        <div class="text-sm font-semibold">${team.name}</div>
        <div class="text-xs text-slate-500">${team.captain}</div>
      </div>
      <div class="text-right">
        <div class="text-xl font-bold">${team.points}</div>
        <div class="text-[10px] uppercase tracking-widest text-slate-500">Points</div>
      </div>
    </div>
  `
    )
    .join("");

  matchFeed.innerHTML = momentum
    .map(
      (line) => `
      <div class="p-3 rounded-2xl bg-slate-900 border border-slate-800">
        <div class="text-xs text-slate-400">${line.time}</div>
        <div class="text-sm text-slate-200">${line.event}</div>
      </div>
    `
    )
    .join("");
};

const renderTournaments = () => {
  liveTournamentContainer.innerHTML = state.tournaments
    .map(
      (tournament) => `
    <div class="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl shadow-black/30">
      <div class="flex items-center justify-between">
        <div>
          <div class="text-lg font-semibold">${tournament.name}</div>
          <div class="text-xs uppercase tracking-widest text-slate-400">${tournament.status}</div>
        </div>
        <div class="text-right">
          <div class="text-sm text-slate-400">Prize Pool</div>
          <div class="text-xl font-bold text-emerald-400">₹${tournament.prizePool ?? 0}</div>
        </div>
      </div>
      <p class="text-sm text-slate-400">${tournament.description ?? "Fast-paced Study IPL action."}</p>
      <div class="flex items-center gap-2 text-xs text-slate-500">
        <span class="badge">${tournament.subjectFocus ?? "Mixed"}</span>
        <span class="badge">60s Snaps</span>
        <span class="badge">${(tournament.playerCount ?? 0) + " players"}</span>
      </div>
      <button data-tournament="${tournament.id}" class="join-tournament w-full py-2 rounded-full bg-violet-600 hover:bg-violet-500 transition font-semibold">
        ${tournament.status === "live" ? "Join Match" : "Pre-register"}
      </button>
    </div>
  `
    )
    .join("");
};

const renderTeam = () => {
  const lineup = activeTeam.length ? activeTeam : getDefaultLineup();
  teamLineup.innerHTML = lineup
    .map(
      (player) => `
      <div class="rounded-2xl bg-slate-900 border border-slate-800 p-3">
        <div class="text-sm font-semibold">${player.name}</div>
        <div class="text-xs text-slate-400">${player.role}</div>
        <div class="text-[10px] uppercase tracking-widest text-violet-300 font-semibold">Rating ${player.rating}</div>
      </div>
    `
    )
    .join("");
  updateElement("#player-power", (el) => {
    el.textContent = computeTeamPower(lineup);
  });
};

const renderSelectedPlayers = () => {
  selectedPlayersContainer.innerHTML = activeTeam
    .map(
      (player) => `
      <div class="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
        <div>
          <div class="text-sm font-semibold">${player.name}</div>
          <div class="text-xs text-slate-400">${player.subject}</div>
        </div>
        <button data-remove="${player.id}" class="text-xs text-rose-400 hover:text-rose-300">Remove</button>
      </div>
    `
    )
    .join("");
};

const renderPlayerPool = () => {
  const queryText = playerSearchInput.value?.toLowerCase() ?? "";
  const filtered = DEFAULT_PLAYER_POOL.filter(
    (player) =>
      player.name.toLowerCase().includes(queryText) ||
      player.role.toLowerCase().includes(queryText) ||
      player.subject.toLowerCase().includes(queryText)
  );
  playerPoolContainer.innerHTML = filtered
    .map(
      (player) => `
      <div class="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
        <div>
          <div class="text-sm font-semibold">${player.name}</div>
          <div class="text-xs text-slate-400">${player.role}</div>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-xs text-violet-300">Rating ${player.rating}</span>
          <button data-add="${player.id}" class="text-xs text-emerald-400 hover:text-emerald-300">Add</button>
        </div>
      </div>
    `
    )
    .join("");
};

const renderUserTournaments = () => {
  userTournamentContainer.innerHTML = state.userTournaments.length
    ? state.userTournaments
        .map(
          (entry) => `
      <div class="rounded-3xl bg-slate-900 border border-slate-800 p-4">
        <div class="flex items-center justify-between">
          <div>
            <div class="text-sm font-semibold">${entry.tournamentName ?? entry.tournamentId}</div>
            <div class="text-xs text-slate-500">Joined ${entry.joinedAt?.toDate?.().toLocaleString?.() ?? ""}</div>
          </div>
          <div class="text-right">
            <div class="text-xl font-bold text-emerald-400">${entry.points ?? 0}</div>
            <div class="text-[10px] uppercase tracking-widest text-slate-500">Points</div>
          </div>
        </div>
      </div>
    `
        )
        .join("")
    : `<p class="text-sm text-slate-500">Join a tournament to start your Study IPL journey.</p>`;
};

const renderFixtures = () => {
  upcomingFixtures.innerHTML = state.fixtures
    .map(
      (fixture) => `
      <div class="p-3 rounded-2xl bg-slate-900 border border-slate-800">
        <div class="text-sm font-semibold">${fixture.name ?? "Match"}</div>
        <div class="text-xs text-slate-400">${fixture.matchType ?? "Blitz"}</div>
        <div class="text-[10px] uppercase tracking-widest text-slate-500 mt-1">
          ${fixture.scheduledAt?.toDate?.().toLocaleString?.() ?? ""}
        </div>
      </div>
    `
    )
    .join("");
};

const renderQuestion = () => {
  if (!activeQuestion) {
    questionBody.innerHTML = `<p class="text-slate-500 text-sm">Join a live match to receive real-time questions synced with Study Snaps.</p>`;
    questionSubmit.disabled = true;
    questionTimer.textContent = "00:00";
    return;
  }

  const options = (activeQuestion.options ?? []).map(
    (opt, idx) => `
      <label class="flex items-center gap-3 px-3 py-2 rounded-2xl bg-slate-900 border border-slate-800 hover:border-violet-500 transition">
        <input type="radio" name="question-option" value="${idx}" class="accent-violet-500 h-4 w-4" />
        <span class="text-sm text-slate-200">${opt}</span>
      </label>
    `
  );

  questionBody.innerHTML = `
    <div class="space-y-4">
      <div>
        <p class="text-sm font-semibold text-slate-100">${activeQuestion.prompt}</p>
      </div>
      <div class="space-y-2">
        ${options.join("")}
      </div>
    </div>
  `;
  questionSubmit.disabled = false;
};

const attachEventListeners = () => {
  authBtn?.addEventListener("click", async () => {
    if (activeUser) {
      await logout();
      return;
    }
    const dialog = document.createElement("div");
    dialog.innerHTML = AUTH_PROMPT;
    showToast("Continue with Google or email sign-in.", "info");
    document.body.appendChild(dialog);
    dialog.querySelector("#auth-google")?.addEventListener("click", () => {
      signInWithGoogle();
      dialog.remove();
    });
    dialog.querySelector("#auth-email")?.addEventListener("click", async () => {
      const email = prompt("Enter email");
      const password = prompt("Enter password (min 6 chars)");
      if (email && password) await signInWithEmail(email, password);
      dialog.remove();
    });
    setTimeout(() => dialog.remove(), 4000);
  });

  premiumTriggerButtons.forEach((btn) =>
    btn?.addEventListener("click", () => {
      initiatePremiumPurchase();
    })
  );

  editTeamBtn?.addEventListener("click", () => {
    toggleModal("team-modal", true);
    renderSelectedPlayers();
    renderPlayerPool();
  });

  closeTeamModal?.addEventListener("click", () => toggleModal("team-modal", false));

  playerPoolContainer?.addEventListener("click", (event) => {
    const addId = event.target.dataset.add;
    if (!addId) return;
    const selected = DEFAULT_PLAYER_POOL.find((player) => player.id === addId);
    if (!selected) return;
    if (activeTeam.some((player) => player.id === selected.id)) {
      showToast("Player already in squad.", "error");
      return;
    }
    if (activeTeam.length >= 11) {
      showToast("11 player squad limit reached.", "error");
      return;
    }
    activeTeam = [...activeTeam, selected];
    renderSelectedPlayers();
    renderPlayerPool();
  });

  selectedPlayersContainer?.addEventListener("click", (event) => {
    const removeId = event.target.dataset.remove;
    if (!removeId) return;
    activeTeam = activeTeam.filter((player) => player.id !== removeId);
    renderSelectedPlayers();
    renderPlayerPool();
  });

  saveTeamBtn?.addEventListener("click", async () => {
    if (!activeUser) {
      showToast("Sign in to save squad.", "error");
      return;
    }
    if (activeTeam.length !== 11) {
      showToast("Pick exactly 11 players.", "error");
      return;
    }
    await saveTeam(activeUser.uid, activeTeam);
    showToast("Squad saved. Ready for matchday!", "success");
    toggleModal("team-modal", false);
  });

  bookmarkBtn?.addEventListener("click", () => {
    if (!activeUser) {
      showToast("Sign in to bookmark this Study Snap.", "error");
      return;
    }
    showToast("Bookmark saved to your highlights.", "success");
  });

  questionSubmit?.addEventListener("click", async () => {
    const selected = document.querySelector('input[name="question-option"]:checked');
    if (!selected || !activeQuestion) {
      showToast("Select an option.", "error");
      return;
    }
    try {
      await submitAnswer({
        tournamentId: activeTournament?.id,
        matchId: activeQuestion.matchId,
        questionId: activeQuestion.id,
        answer: Number(selected.value),
      });
      questionFeedback.textContent = "Answer submitted. Awaiting verdict…";
      showToast("Answer locked in!", "success");
    } catch (error) {
      showToast(error.message ?? "Could not submit answer.", "error");
    }
  });

  playerSearchInput?.addEventListener("input", renderPlayerPool);

  liveTournamentContainer?.addEventListener("click", async (event) => {
    const button = event.target.closest(".join-tournament");
    if (!button) return;
    if (!activeUser) {
      showToast("Sign in to join tournaments.", "error");
      return;
    }
    const tournamentId = button.dataset.tournament;
    const tournament = state.tournaments.find((item) => item.id === tournamentId);
    if (!tournament) return;
    try {
      await joinTournament(tournamentId, activeTeam.length === 11 ? activeTeam : getDefaultLineup());
      activeTournament = tournament;
      subscribeTournamentDetail();
      showToast(`Joined ${tournament.name}.`, "success");
      antiCheatSession = await startAntiCheatSession();
    } catch (error) {
      console.error(error);
      showToast(error.message ?? "Could not join tournament.", "error");
    }
  });

  viewLeaderboardBtn?.addEventListener("click", () => toggleModal("leaderboard-modal", true));
  closeLeaderboardBtn?.addEventListener("click", () => toggleModal("leaderboard-modal", false));
  document.getElementById("close-leaderboard")?.addEventListener("click", () =>
    toggleModal("leaderboard-modal", false)
  );

  refreshTournamentsBtn?.addEventListener("click", () => {
    if (unsubscribeTournaments) {
      unsubscribeTournaments();
      unsubscribeTournaments = subscribeToLiveTournaments(handleTournamentSnapshot);
      showToast("Tournaments refreshed.", "success");
    }
  });

  document.addEventListener("premium:activated", () => {
    initAds(false);
    premiumBadge?.classList.remove("hidden");
    premiumStatus.textContent = "Premium active";
  });
};

const startTimer = () => {
  let remaining = activeQuestion?.remaining ?? 0;
  if (!remaining) {
    questionTimer.textContent = "00:00";
    return;
  }
  questionTimer.textContent = padTime(remaining);
  const interval = setInterval(() => {
    remaining = Math.max(remaining - 1, 0);
    questionTimer.textContent = padTime(remaining);
    if (!remaining) clearInterval(interval);
  }, 1000);
};

const handleTournamentSnapshot = (tournaments) => {
  state.tournaments = tournaments;
  renderTournaments();
};

const subscribeTournamentDetail = () => {
  unsubscribeScoreboard?.();
  unsubscribeFixtures?.();
  unsubscribeQuestion?.();

  if (!activeTournament) return;

  unsubscribeScoreboard = subscribeToScoreboard(activeTournament.id, (scoreboard) => {
    state.scoreboard = scoreboard;
    renderScoreboard();
    if (scoreboard?.teams?.length) {
      leaderboardTeams.innerHTML = scoreboard.teams
        .map(
          (team, idx) => `
        <div class="flex items-center justify-between px-4 py-2 rounded-2xl bg-slate-900 border border-slate-800">
          <div class="flex items-center gap-3">
            <span class="text-xs text-slate-500">#${idx + 1}</span>
            <div>
              <div class="text-sm font-semibold">${team.name}</div>
              <div class="text-[10px] uppercase tracking-widest text-slate-500">Captain ${team.captain}</div>
            </div>
          </div>
          <div class="text-lg font-bold text-emerald-400">${team.points}</div>
        </div>
      `
        )
        .join("");
    }
    if (scoreboard?.mvps?.length) {
      leaderboardPlayers.innerHTML = scoreboard.mvps
        .map(
          (player) => `
        <div class="px-4 py-2 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div>
            <div class="text-sm font-semibold">${player.name}</div>
            <div class="text-xs text-slate-500">${player.subject}</div>
          </div>
          <div class="text-lg font-bold text-emerald-400">${player.points} pts</div>
        </div>
      `
        )
        .join("");
    }
  });

  unsubscribeFixtures = subscribeToFixtures(activeTournament.id, (fixtures) => {
    state.fixtures = fixtures;
    renderFixtures();
  });

  unsubscribeQuestion = subscribeToQuestion(activeTournament.id, (question) => {
    activeQuestion = question;
    renderQuestion();
    if (question) {
      startTimer();
      updatePresence(activeTournament.id);
    }
  });
};

const handleUserChange = (user) => {
  activeUser = user;
  if (user) {
    authStatus.textContent = `Signed in as ${user.displayName ?? user.email}`;
    authBtn.textContent = "Sign Out";

    unsubscribeUserTournaments?.();
    unsubscribeUserTournaments = subscribeToUserTournaments(user.uid, (entries) => {
      state.userTournaments = entries;
      renderUserTournaments();
    });

    unsubscribeTeam?.();
    unsubscribeTeam = subscribeToTeam(user.uid, (team) => {
      if (team?.roster?.length) {
        activeTeam = team.roster;
      } else {
        activeTeam = getDefaultLineup();
      }
      renderTeam();
    });

    unsubscribePremium?.();
    unsubscribePremium = subscribeToPremiumStatus(user.uid, (status) => {
      if (status?.active) {
        initAds(false);
        premiumBadge?.classList.remove("hidden");
        const expires = status.expiresAt?.toDate?.() ?? (status.expiresAt ? new Date(status.expiresAt) : null);
        premiumStatus.textContent = expires
          ? `Active until ${expires.toLocaleDateString()}`
          : "Premium active";
      } else {
        initAds(true);
        premiumBadge?.classList.add("hidden");
        premiumStatus.textContent = "Free plan";
      }
    });

    updateElement("#player-power", (el) => {
      el.textContent = computeTeamPower(activeTeam);
    });
  } else {
    authStatus.textContent = "Guest mode";
    authBtn.textContent = "Sign In";
    initAds(true);
    premiumBadge?.classList.add("hidden");
    premiumStatus.textContent = "Free plan";
    unsubscribeUserTournaments?.();
    unsubscribeTeam?.();
    unsubscribePremium?.();
    activeTeam = getDefaultLineup();
    renderTeam();
  }
};

const init = () => {
  attachEventListeners();
  activeTeam = getDefaultLineup();
  renderTeam();
  renderPlayerPool();
  renderSelectedPlayers();
  initAds(true);
  unsubscribeTournaments = subscribeToLiveTournaments(handleTournamentSnapshot);
  initAuth(handleUserChange);

  const defaultVideo =
    "https://storage.googleapis.com/coverr-main/mp4/Mt_Baker.mp4";
  videoElement.src = defaultVideo;
  videoMeta.textContent = "Topper Tactics: Speed math hacks in under 60 seconds.";
};

window.addEventListener("beforeunload", () => {
  if (antiCheatSession) {
    stopAntiCheatSession();
  }
});

init();
