// IMPORTANT: To enable Firebase authentication, you must create a Firebase project,
// enable Email/Password and Google sign-in providers, and then add your
// Firebase configuration credentials to a `.env.local` file at the root of your project.
// Example .env.local content:
//
// FIREBASE_API_KEY="your-api-key"
// FIREBASE_AUTH_DOMAIN="your-auth-domain"
// FIREBASE_PROJECT_ID="your-project-id"
// FIREBASE_STORAGE_BUCKET="your-storage-bucket"
// FIREBASE_MESSAGING_SENDER_ID="your-sender-id"
// FIREBASE_APP_ID="your-app-id"

import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let googleProvider: GoogleAuthProvider | null = null;
export const isFirebaseEnabled = !!firebaseConfig.apiKey;

if (isFirebaseEnabled) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  googleProvider = new GoogleAuthProvider();
} else {
    // We log a clear warning to the developer to guide them on how to fix the configuration.
    // This is better than stopping the app with a thrown error.
    console.warn(
      "Firebase API Key is missing. Authentication features will be disabled, and the app will run in offline mode.\n\n" +
      "To enable user accounts, please create a `.env.local` file in the project root and add your Firebase project's configuration keys.\n\n" +
      "Example `.env.local` content:\n" +
      'FIREBASE_API_KEY="your-api-key"\n' +
      'FIREBASE_AUTH_DOMAIN="your-auth-domain"\n' +
      'FIREBASE_PROJECT_ID="your-project-id"\n' +
      'FIREBASE_STORAGE_BUCKET="your-storage-bucket"\n' +
      'FIREBASE_MESSAGING_SENDER_ID="your-sender-id"\n' +
      'FIREBASE_APP_ID="your-app-id"'
    );
}

export { auth, googleProvider };