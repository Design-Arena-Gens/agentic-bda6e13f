import { auth, db, addDoc, collection, serverTimestamp } from "./firebase.js";
import { randomId } from "../utils/helpers.js";

const DEFAULT_FLAGS = {
  tabSwitch: 0,
  blur: 0,
  copy: 0,
  suspiciousKeys: 0,
};

const suspiciousKeyCombos = [
  "Control+c",
  "Control+v",
  "Control+x",
  "Meta+c",
  "Meta+v",
  "Meta+x",
  "Alt+Tab",
  "Meta+Tab",
];

let sessionState = {
  sessionId: null,
  flags: { ...DEFAULT_FLAGS },
  listenersActive: false,
};

const logEvent = async (type, meta = {}) => {
  const user = auth.currentUser;
  if (!user) return;
  try {
    await addDoc(collection(db, "antiCheatEvents"), {
      sessionId: sessionState.sessionId,
      uid: user.uid,
      type,
      meta,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("anti-cheat log failed", error);
  }
};

const incrementFlag = (flag) => {
  sessionState.flags[flag] = (sessionState.flags[flag] ?? 0) + 1;
};

const handleVisibility = async () => {
  if (document.hidden) {
    incrementFlag("tabSwitch");
    await logEvent("tabSwitch");
  }
};

const handleBlur = async () => {
  incrementFlag("blur");
  await logEvent("blur");
};

const handleCopy = async (event) => {
  incrementFlag("copy");
  await logEvent("copy", { length: event.clipboardData?.getData("text/plain")?.length ?? 0 });
};

const handleKeydown = async (event) => {
  const combo = `${event.metaKey ? "Meta+" : ""}${event.ctrlKey ? "Control+" : ""}${
    event.altKey ? "Alt+" : ""
  }${event.key}`;
  if (suspiciousKeyCombos.includes(combo)) {
    incrementFlag("suspiciousKeys");
    await logEvent("suspiciousKeys", { combo });
  }
};

const attachListeners = () => {
  if (sessionState.listenersActive) return;
  document.addEventListener("visibilitychange", handleVisibility);
  window.addEventListener("blur", handleBlur);
  document.addEventListener("copy", handleCopy);
  document.addEventListener("cut", handleCopy);
  document.addEventListener("keydown", handleKeydown);
  sessionState.listenersActive = true;
};

const detachListeners = () => {
  if (!sessionState.listenersActive) return;
  document.removeEventListener("visibilitychange", handleVisibility);
  window.removeEventListener("blur", handleBlur);
  document.removeEventListener("copy", handleCopy);
  document.removeEventListener("cut", handleCopy);
  document.removeEventListener("keydown", handleKeydown);
  sessionState.listenersActive = false;
};

export const startAntiCheatSession = async () => {
  const user = auth.currentUser;
  if (!user) return null;
  sessionState = {
    sessionId: randomId("acs"),
    flags: { ...DEFAULT_FLAGS },
    listenersActive: false,
  };
  await logEvent("sessionStart");
  attachListeners();
  return sessionState.sessionId;
};

export const stopAntiCheatSession = async () => {
  if (!sessionState.sessionId) return;
  await logEvent("sessionStop", { flags: sessionState.flags });
  detachListeners();
  sessionState.sessionId = null;
};

export const getAntiCheatState = () => ({ ...sessionState });
