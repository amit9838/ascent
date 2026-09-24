// Firebase bootstrap — fully lazy. The SDK is dynamically imported so it
// never lands in the main bundle: auth loads only when env vars are set,
// Firestore only when actually used (sign-in/sync/sharing). The app stays
// 100% local-first (and identical to the offline build) when env vars are
// unset — cloudEnabled() is false and all cloud UI stays hidden.
//
// The web config is public by design; access control lives in
// firestore.rules. Emulators are used when VITE_USE_EMULATORS=1 so
// development never touches production data.

import type { FirebaseApp } from "firebase/app";
import type { Auth } from "firebase/auth";
import type { Firestore } from "firebase/firestore";
import type * as AuthMod from "firebase/auth";
import type * as FsMod from "firebase/firestore";

const env = import.meta.env;

const config = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

const useEmulators = env.VITE_USE_EMULATORS === "1";

export function cloudEnabled(): boolean {
  return Boolean(config.apiKey && config.projectId && config.appId);
}

export interface FirebaseKit {
  auth: Auth;
  authMod: typeof AuthMod;
  db: Firestore;
  fsMod: typeof FsMod;
}

let ready: Promise<FirebaseKit> | null = null;

function ensure(): Promise<FirebaseKit> {
  if (ready) return ready;
  ready = (async (): Promise<FirebaseKit> => {
    const { initializeApp, getApps } = await import("firebase/app");
    const app: FirebaseApp = getApps()[0] ?? initializeApp(config);

    const fsMod = await import("firebase/firestore");
    // Persistent local cache: snapshots and getDoc serve from disk on
    // warm starts / offline, cutting repeat network reads. Multi-tab
    // manager keeps two open tabs from clobbering each other's cache;
    // if IndexedDB is unavailable the SDK falls back to memory.
    const db = fsMod.initializeFirestore(app, {
      ignoreUndefinedProperties: true,
      localCache: fsMod.persistentLocalCache({
        tabManager: fsMod.persistentMultipleTabManager(),
      }),
    });

    const authMod = await import("firebase/auth");
    const auth = authMod.getAuth(app);

    if (useEmulators) {
      authMod.connectAuthEmulator(auth, "http://127.0.0.1:9099", {
        disableWarnings: true,
      });
      fsMod.connectFirestoreEmulator(db, "127.0.0.1", 8080);
    } else if (env.VITE_RECAPTCHA_V3_SITE_KEY) {
      // Optional App Check (abuse protection); enable enforcement in the
      // Firebase console after verifying flows still work.
      const { initializeAppCheck, ReCaptchaV3Provider } = await import(
        "firebase/app-check"
      );
      try {
        initializeAppCheck(app, {
          provider: new ReCaptchaV3Provider(env.VITE_RECAPTCHA_V3_SITE_KEY),
        });
      } catch {
        // App Check failure must never break the app
      }
    }

    authMod.setPersistence(auth, authMod.browserLocalPersistence).catch(() => {});

    return { auth, authMod, db, fsMod };
  })();
  return ready;
}

// `m` is the SDK module (callers use m.doc, m.signInWithPopup, …).
export function loadFirebaseAuth(): Promise<{ auth: Auth; m: typeof AuthMod }> {
  return ensure().then(({ auth, authMod }) => ({ auth, m: authMod }));
}

export function loadFirestore(): Promise<{ db: Firestore; m: typeof FsMod }> {
  return ensure().then(({ db, fsMod }) => ({ db, m: fsMod }));
}
