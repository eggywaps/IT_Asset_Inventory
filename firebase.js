// Firebase project configuration for the IT Inventory tool.
// This connects the app to your Firestore database so data
// is shared and synced across any device/browser.
const firebaseConfig = {
  apiKey: "AIzaSyClbVqgSFR8c__4TRcwQiV91maoUgnFSzY",
  authDomain: "it-inventory-cb864.firebaseapp.com",
  projectId: "it-inventory-cb864",
  storageBucket: "it-inventory-cb864.firebasestorage.app",
  messagingSenderId: "393659587418",
  appId: "1:393659587418:web:55c6c332ad15187f337163",
  measurementId: "G-M6EBMJ125S"
};

firebase.initializeApp(firebaseConfig);
window.db = firebase.firestore();