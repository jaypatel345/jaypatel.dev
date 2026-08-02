// ============================================
// FIREBASE CONFIGURATION
// ============================================

/**
 * Firebase configuration for jaypatel-dev project
 */

const firebaseConfig = {
  apiKey: "AIzaSyAMQaloo2CgJvBSZranyyGrzYD8cQKxT4c",
  authDomain: "jaypatel-dev.firebaseapp.com",
  databaseURL: "https://jaypatel-dev-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "jaypatel-dev",
  storageBucket: "jaypatel-dev.firebasestorage.app",
  messagingSenderId: "111869620921",
  appId: "1:111869620921:web:7b79ea79d86109e595a168",
  measurementId: "G-28GK8PGMEZ"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Get database reference
const database = firebase.database();

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.firebaseDatabase = database;
}