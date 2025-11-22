import {
  db,
  auth,
  collection,
  doc,
  addDoc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  runTransaction,
} from "./firebase.js";
import { randomId, clamp } from "../utils/helpers.js";

const tournamentsRef = collection(db, "tournaments");
const teamsRef = collection(db, "teams");

export const DEFAULT_PLAYER_POOL = [
  { id: "player_quant", name: "Riya Agarwal", role: "Quant Ace", subject: "Quantitative Aptitude", rating: 92 },
  { id: "player_reasoning", name: "Arjun Mehta", role: "Logic Strategist", subject: "Logical Reasoning", rating: 89 },
  { id: "player_verbal", name: "Neha Kapoor", role: "Verbal Maestro", subject: "Verbal Ability", rating: 95 },
  { id: "player_gk", name: "Rahul Nair", role: "GK Navigator", subject: "General Awareness", rating: 87 },
  { id: "player_ds", name: "Ananya Desai", role: "Data Sleuth", subject: "Data Interpretation", rating: 93 },
  { id: "player_cs", name: "Kabir Shah", role: "Code Runner", subject: "Computer Science", rating: 90 },
  { id: "player_phy", name: "Ishita Rao", role: "Physics Sprinter", subject: "Physics", rating: 88 },
  { id: "player_chem", name: "Sarthak Jain", role: "Chem Catalyst", subject: "Chemistry", rating: 85 },
  { id: "player_bio", name: "Simran Paul", role: "Bio Analyst", subject: "Biology", rating: 86 },
  { id: "player_math", name: "Dev Verma", role: "Math Sniper", subject: "Mathematics", rating: 91 },
  { id: "player_history", name: "Meera Iyer", role: "History Tracker", subject: "History", rating: 84 },
  { id: "player_polity", name: "Yashwant Rao", role: "Polity Architect", subject: "Political Science", rating: 82 },
  { id: "player_geo", name: "Harshita Singh", role: "Geo Mapper", subject: "Geography", rating: 83 },
  { id: "player_finance", name: "Rohit Kulkarni", role: "Finance Wizard", subject: "Finance", rating: 90 },
];

export const subscribeToLiveTournaments = (callback) => {
  const q = query(tournamentsRef, where("status", "in", ["live", "upcoming"]), orderBy("startTime", "asc"), limit(10));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  });
};

export const subscribeToUserTournaments = (uid, callback) => {
  if (!uid) return () => {};
  const q = query(collection(db, "playerTournaments"), where("uid", "==", uid), orderBy("joinedAt", "desc"), limit(10));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  });
};

export const subscribeToScoreboard = (tournamentId, callback) => {
  if (!tournamentId) return () => {};
  const scoreboardRef = doc(db, "tournaments", tournamentId, "meta", "scoreboard");
  return onSnapshot(scoreboardRef, (snap) => {
    callback(snap.exists() ? snap.data() : null);
  });
};

export const subscribeToFixtures = (tournamentId, callback) => {
  if (!tournamentId) return () => {};
  const q = query(
    collection(db, "tournaments", tournamentId, "matches"),
    orderBy("scheduledAt", "asc"),
    limit(12)
  );
  return onSnapshot(q, (snapshot) => callback(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))));
};

export const joinTournament = async (tournamentId, team) => {
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in required.");
  const tournamentDoc = doc(tournamentsRef, tournamentId);
  const playerTournamentId = `${tournamentId}_${user.uid}`;
  const playerTournamentRef = doc(db, "playerTournaments", playerTournamentId);

  await runTransaction(db, async (tx) => {
    const tournamentSnap = await tx.get(tournamentDoc);
    if (!tournamentSnap.exists()) throw new Error("Tournament not found.");
    const data = tournamentSnap.data();
    if (data.status === "completed") throw new Error("Tournament finished.");

    tx.set(
      playerTournamentRef,
      {
        uid: user.uid,
        tournamentId,
        team,
        joinedAt: serverTimestamp(),
        points: 0,
        answers: {},
      },
      { merge: true }
    );
  });
  return playerTournamentId;
};

export const submitAnswer = async ({ tournamentId, matchId, questionId, answer }) => {
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in required.");

  const answerRef = doc(db, "answers", `${tournamentId}_${matchId}_${user.uid}_${questionId}`);
  await setDoc(
    answerRef,
    {
      uid: user.uid,
      tournamentId,
      matchId,
      questionId,
      answer,
      submittedAt: serverTimestamp(),
    },
    { merge: true }
  );
};

export const subscribeToQuestion = (tournamentId, callback) => {
  if (!tournamentId) return () => {};
  const questionRef = doc(db, "tournaments", tournamentId, "meta", "activeQuestion");
  return onSnapshot(questionRef, (snap) => callback(snap.exists() ? snap.data() : null));
};

export const fetchTeam = async (uid) => {
  const docRef = doc(teamsRef, uid);
  const snap = await getDoc(docRef);
  return snap.exists() ? snap.data() : null;
};

export const saveTeam = async (uid, roster) => {
  await setDoc(doc(teamsRef, uid), { roster, updatedAt: serverTimestamp() });
};

export const getDefaultLineup = () => {
  const sorted = [...DEFAULT_PLAYER_POOL].sort((a, b) => b.rating - a.rating);
  return sorted.slice(0, 11);
};

export const subscribeToTeam = (uid, callback) => {
  if (!uid) return () => {};
  const ref = doc(teamsRef, uid);
  return onSnapshot(ref, (snap) => callback(snap.exists() ? snap.data() : null));
};

export const subscribeToPremiumStatus = (uid, callback) => {
  if (!uid) return () => {};
  const ref = doc(db, "premiumStatus", uid);
  return onSnapshot(ref, (snap) => {
    callback(snap.exists() ? snap.data() : { active: false });
  });
};

export const subscribeToPresence = (tournamentId, callback) => {
  if (!tournamentId) return () => {};
  const q = query(
    collection(db, "presence"),
    where("tournamentId", "==", tournamentId),
    orderBy("updatedAt", "desc"),
    limit(20)
  );
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  });
};

export const updatePresence = async (tournamentId) => {
  const user = auth.currentUser;
  if (!user || !tournamentId) return;
  await setDoc(
    doc(db, "presence", `${tournamentId}_${user.uid}`),
    {
      uid: user.uid,
      tournamentId,
      updatedAt: serverTimestamp(),
      displayName: user.displayName ?? "Learner",
    },
    { merge: true }
  );
};

export const computeTeamPower = (roster = []) =>
  Math.round(
    roster.reduce((acc, player, idx) => acc + clamp(player.rating ?? 70, 50, 99) * (1 + (11 - idx) * 0.04), 0) /
      Math.max(roster.length, 1)
  );
