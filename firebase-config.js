// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBjAQB9sL39U1TFruMGQoIVDP-xlzwP5o4",
  authDomain: "we-chat-app-e5746.firebaseapp.com",
  projectId: "we-chat-app-e5746",
  storageBucket: "we-chat-app-e5746.firebasestorage.app",
  messagingSenderId: "592895643942",
  appId: "1:592895643942:web:33b9caee3b6d5bb00171e7"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firebase services
const auth = firebase.auth();
const db = firebase.firestore();

console.log('Firebase initialized successfully');