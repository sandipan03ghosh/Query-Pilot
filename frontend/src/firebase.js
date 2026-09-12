import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup
} from "firebase/auth";

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// UI-only flag: true when the essential Firebase web-config vars are set, so the
// login screen shows Firebase/Google auth vs the native fallback. Not a security
// boundary — the real checks are backend ID-token verification and the Firebase
// console auth-provider / rule settings.
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.appId
);

// Initialize Firebase - with error handling
let app;
let analytics;
let auth;
const googleProvider = new GoogleAuthProvider();

try {
  if (!isFirebaseConfigured) {
    throw new Error("Firebase env vars not set — using native auth fallback");
  }
  app = initializeApp(firebaseConfig);
  // Analytics may not be available in all environments
  try {
    analytics = getAnalytics(app);
  } catch (analyticsError) {
    console.warn("Analytics initialization failed:", analyticsError.message);
  }
  auth = getAuth(app);
  console.log("Firebase initialized successfully");
} catch (firebaseError) {
  console.error("Firebase initialization error:", firebaseError);
}

// More detailed error handling for Firebase authentication functions
export const registerWithEmailAndPassword = async (email, password) => {
  try {
    if (!auth) {
      return { 
        user: null, 
        error: { code: "auth/not-initialized", message: "Firebase authentication not initialized" }
      };
    }
    
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    return { user: userCredential.user, error: null };
  } catch (error) {
    console.error("Registration error:", error.code, error.message);
    
    // Provide more user-friendly error messages
    let errorMessage = error.message;
    if (error.code === 'auth/email-already-in-use') {
      errorMessage = 'This email is already in use. Please try a different email or sign in.';
    } else if (error.code === 'auth/weak-password') {
      errorMessage = 'Password is too weak. Please use a stronger password.';
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = 'Email address is invalid. Please check and try again.';
    }
    
    return { user: null, error: { code: error.code, message: errorMessage } };
  }
};

export const loginWithEmailAndPassword = async (email, password) => {
  try {
    if (!auth) {
      return { 
        user: null, 
        error: { code: "auth/not-initialized", message: "Firebase authentication not initialized" }
      };
    }
    
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return { user: userCredential.user, error: null };
  } catch (error) {
    console.error("Login error:", error.code, error.message);
    
    // More user-friendly error messages for login failures
    let errorMessage = error.message;
    if (error.code === 'auth/invalid-credential' || 
        error.code === 'auth/user-not-found' || 
        error.code === 'auth/wrong-password') {
      errorMessage = 'Invalid email or password. Please check your credentials and try again.';
    } else if (error.code === 'auth/too-many-requests') {
      errorMessage = 'Access temporarily disabled due to many failed login attempts. Please try again later.';
    } else if (error.code === 'auth/user-disabled') {
      errorMessage = 'This account has been disabled. Please contact support.';
    }
    
    return { user: null, error: { code: error.code, message: errorMessage } };
  }
};

// Google authentication function
export const signInWithGoogle = async () => {
  try {
    if (!auth) {
      return { 
        user: null, 
        error: { code: "auth/not-initialized", message: "Firebase authentication not initialized" }
      };
    }
    
    const result = await signInWithPopup(auth, googleProvider);
    // This gives you a Google Access Token. You can use it to access the Google API.
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential?.accessToken;
    // The signed-in user info
    const user = result.user;
    
    return { user, token, error: null };
  } catch (error) {
    console.error("Google sign-in error:", error.code, error.message);
    
    // Provide more user-friendly error messages
    let errorMessage = error.message;
    if (error.code === 'auth/popup-closed-by-user') {
      errorMessage = 'Sign-in popup was closed before completion. Please try again.';
    } else if (error.code === 'auth/popup-blocked') {
      errorMessage = 'Sign-in popup was blocked by your browser. Please allow popups for this site.';
    } else if (error.code === 'auth/cancelled-popup-request') {
      errorMessage = 'Sign-in request was cancelled. Please try again.';
    } else if (error.code === 'auth/account-exists-with-different-credential') {
      errorMessage = 'An account already exists with the same email address but different sign-in credentials.';
    }
    
    // Return error info
    return { 
      user: null, 
      error: { 
        code: error.code,
        message: errorMessage,
        email: error.customData?.email || null,
        credential: GoogleAuthProvider.credentialFromError(error)
      } 
    };
  }
};

export { auth, googleProvider };
export default app;
