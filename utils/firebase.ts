import AsyncStorage from '@react-native-async-storage/async-storage'
import { getApp, getApps, initializeApp } from 'firebase/app'
import {
    browserLocalPersistence,
    getAuth,
    getReactNativePersistence,
    initializeAuth,
    setPersistence
} from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { Platform } from 'react-native'

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyD3wulF0Lgl7jK6d2b7fbvItsYpu4F0c3k",
  authDomain: "healthify-26f7e.firebaseapp.com",
  projectId: "healthify-26f7e",
  storageBucket: "healthify-26f7e.firebasestorage.app",
  messagingSenderId: "329529586028",
  appId: "1:329529586028:web:8871c6100ceb3af2c6c349",
  measurementId: "G-M0V7Z27R63"
}

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()

// Initialize Firebase Auth with platform-specific persistence
let auth: any

const initializeAuthWithPersistence = async () => {
  try {
    if (Platform.OS === 'web') {
      // For web, use browser local storage
      auth = getAuth(app)
      await setPersistence(auth, browserLocalPersistence)
    } else {
      // For React Native, use AsyncStorage
      auth = initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage)
      })
    }
  } catch (error) {
    console.warn('Auth persistence setup failed, falling back to default:', error)
    auth = getAuth(app)
  }
}

// Initialize auth immediately
initializeAuthWithPersistence()

// If auth is not initialized yet, get default
if (!auth) {
  auth = getAuth(app)
}

// Initialize Firestore
const db = getFirestore(app)

// Initialize Storage
const storage = getStorage(app)

// Enable emulator in development (optional)
if (__DEV__) {
  // Uncomment these lines if you want to use Firebase emulators
  // connectFirestoreEmulator(db, 'localhost', 8080)
}

export { auth, db, storage }
export default app 