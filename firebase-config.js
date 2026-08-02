// ============================================
// FIREBASE CONFIGURATION
// ============================================

/**
 * Firebase configuration
 * Replace with your own Firebase project config
 * Get this from Firebase Console → Project Settings → General → Your apps
 */

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Get database reference
const database = firebase.database();

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.firebaseDatabase = database;
}