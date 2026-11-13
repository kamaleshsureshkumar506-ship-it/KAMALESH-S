import { initializeApp, getApps, cert, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'tamil-kavithai-f5cd8';

let firestoreInstance = null;

/**
 * Reset the cached Firestore instance (for testing).
 */
export async function _resetAdminDbForTesting() {
  firestoreInstance = null;
  const apps = getApps();
  for (const app of apps) {
    try {
      await deleteApp(app);
    } catch (e) {
      // ignore
    }
  }
}

/**
 * Injects a mock Firestore instance for unit testing.
 */
export function _setMockFirestoreForTesting(mockDb) {
  firestoreInstance = mockDb;
}

/**
 * Retrieve the initialized Firebase Admin Firestore database instance.
 * Strict security requirement:
 * - FIREBASE_SERVICE_ACCOUNT must be present in environment variables.
 * - Must be valid JSON containing required service account credentials.
 * - No unauthenticated fallback is permitted for privileged admin operations.
 * Throws explicit server configuration errors if credentials are missing or invalid.
 */
export function getFirebaseAdminDb() {
  if (firestoreInstance) return firestoreInstance;

  const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!rawCredentials || !rawCredentials.trim()) {
    throw new Error('Server configuration error: FIREBASE_SERVICE_ACCOUNT is required for privileged admin operations.');
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(rawCredentials);
  } catch (err) {
    throw new Error('Server configuration error: FIREBASE_SERVICE_ACCOUNT contains invalid JSON.');
  }

  if (
    typeof serviceAccount !== 'object' ||
    serviceAccount === null ||
    !serviceAccount.project_id ||
    !serviceAccount.client_email ||
    !serviceAccount.private_key
  ) {
    throw new Error('Server configuration error: FIREBASE_SERVICE_ACCOUNT is missing required credentials (project_id, client_email, or private_key).');
  }

  try {
    let app;
    const existingApps = getApps();
    if (existingApps.length === 0) {
      app = initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.project_id || PROJECT_ID
      });
    } else {
      app = existingApps[0];
    }

    firestoreInstance = getFirestore(app);
    return firestoreInstance;
  } catch (err) {
    throw new Error('Firebase Admin SDK initialization failed: ' + err.message);
  }
}

/**
 * Save (create or update) a poem using Firebase Admin SDK.
 * Privileged operation: Requires authenticated admin session and Firebase Admin SDK credentials.
 * No unauthenticated REST fallback is permitted.
 */
export async function adminSavePoem(poem) {
  const db = getFirebaseAdminDb();
  try {
    const docRef = db.collection('kavithaigal').doc(poem.id.toString());
    await docRef.set(poem, { merge: true });
    return { success: true, method: 'admin-sdk', poem };
  } catch (error) {
    throw new Error('Firebase Admin SDK write failed: ' + error.message);
  }
}

/**
 * Delete a poem using Firebase Admin SDK.
 * Privileged operation: Requires authenticated admin session and Firebase Admin SDK credentials.
 * No unauthenticated REST fallback is permitted.
 */
export async function adminDeletePoem(poemId) {
  const db = getFirebaseAdminDb();
  try {
    const docRef = db.collection('kavithaigal').doc(poemId.toString());
    await docRef.delete();
    return { success: true, method: 'admin-sdk' };
  } catch (error) {
    throw new Error('Firebase Admin SDK delete failed: ' + error.message);
  }
}

/**
 * Save custom category using Firebase Admin SDK.
 * Privileged operation: Requires authenticated admin session and Firebase Admin SDK credentials.
 * No unauthenticated REST fallback is permitted.
 */
export async function adminSaveCategory(category) {
  const db = getFirebaseAdminDb();
  try {
    const docRef = db.collection('categories').doc(category.name);
    await docRef.set(category, { merge: true });
    return { success: true, method: 'admin-sdk', category };
  } catch (error) {
    throw new Error('Firebase Admin SDK category write failed: ' + error.message);
  }
}
