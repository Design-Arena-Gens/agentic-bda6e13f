import {
  auth,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  db,
  doc,
  getDoc,
} from "./firebase.js";
import { showToast } from "./ui.js";

const provider = new GoogleAuthProvider();

export const initAuth = (callback) => {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      const rolesSnap = await getDoc(doc(db, "roles", user.uid));
      callback({
        ...user,
        roles: rolesSnap.exists() ? rolesSnap.data() : { admin: false },
      });
    } else {
      callback(null);
    }
  });
};

export const signInWithGoogle = async () => {
  try {
    await signInWithPopup(auth, provider);
    showToast("Signed in with Google.", "success");
  } catch (error) {
    console.error(error);
    showToast(error.message ?? "Google sign-in failed.", "error");
  }
};

export const signInWithEmail = async (email, password) => {
  try {
    await signInWithEmailAndPassword(auth, email, password);
    showToast("Welcome back!", "success");
  } catch (error) {
    if (error.code === "auth/user-not-found") {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: email.split("@")[0] });
      showToast("Account created. You're in!", "success");
    } else {
      console.error(error);
      showToast(error.message ?? "Email sign-in failed.", "error");
    }
  }
};

export const logout = async () => {
  await signOut(auth);
  showToast("Signed out successfully.", "info");
};
