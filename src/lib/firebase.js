// Firebase bootstrap — fully lazy. The SDK is dynamically imported so it
// never lands in the main bundle: auth loads only when env vars are set,
// Firestore only when actually used (sign-in/sync/sharing). The app stays
// 100% local-first (and identical to the offline build) when env vars are
// unset — cloudEnabled() is false and all cloud UI stays hidden.
//
// The web config is public by design; access control lives in
// firestore.rules. Emulators are used when VITE_USE_EMULATORS=1 so
// development never touches production data.

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

export function cloudEnabled() {
  return Boolean(config.apiKey && config.projectId && config.appId);
}

let ready = null;

function ensure() {
  if (ready) return ready;
  ready = (async () => {
    const { initializeApp, getApps } = await import("firebase/app");
    const app = getApps()[0] ?? initializeApp(config);

    const fsMod = await import("firebase/firestore");
    const db = fsMod.initializeFirestore(app, {
      ignoreUndefinedProperties: true,
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
          platform: ReCaptchaV3Provider,
          siteKey: env.VITE_RECAPTCHA_V3_SITE_KEY,
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
export function loadFirebaseAuth() {
  return ensure().then(({ auth, authMod }) => ({ auth, m: authMod }));
}

export function loadFirestore() {
  return ensure().then(({ db, fsMod }) => ({ db, m: fsMod }));
}
