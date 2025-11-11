// src/firebaseConfig.js
import { initializeApp } from "firebase/app";
import { getAuth, RecaptchaVerifier } from "firebase/auth";

// Firebase configuration
const firebaseConfig = {
 apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Auth
const auth = getAuth(app);

// Setup reCAPTCHA (invisible)
let recaptchaVerifier;
export const setupRecaptcha = () => {
  if (!recaptchaVerifier) {
    recaptchaVerifier = new RecaptchaVerifier(
      "recaptcha-container",
      {
        size: "invisible",
        callback: () => console.log("✅ reCAPTCHA solved"),
        "expired-callback": () => console.warn("⚠️ reCAPTCHA expired"),
      },
      auth
    );

    recaptchaVerifier.render().then((widgetId) => {
      window.recaptchaWidgetId = widgetId;
      console.log("[reCAPTCHA] Widget rendered ID:", widgetId);
    });
  }
  return recaptchaVerifier;
};

export { auth };
export default app;
