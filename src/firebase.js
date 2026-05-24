// src/firebase.js
import { initializeApp } from 'firebase/app';
import { 
  getDatabase, 
  ref, 
  push, 
  onChildAdded, 
  onChildChanged, 
  set, 
  onValue, 
  serverTimestamp, 
  onDisconnect,
  orderByKey,
  limitToLast,
  endBefore,
  startAfter,
  query,
  get
} from 'firebase/database';

import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
  apiKey:            "AIzaSyDfQxXfOVfXN6_sI_wPSxDImGP1eTYmn0c",
  authDomain:        "mrsnote-ac3e5.firebaseapp.com",
  databaseURL:       "https://mrsnote-ac3e5-default-rtdb.firebaseio.com",
  projectId:         "mrsnote-ac3e5",
  storageBucket:     "mrsnote-ac3e5.firebasestorage.app",
  messagingSenderId: "822769418996",
  appId:             "1:822769418996:web:7a003ca8e908666a7bd4a1"
};


const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const messaging = getMessaging(app);
export { 
  db, 
  ref, 
  push, 
  onChildAdded, 
  onChildChanged, 
  set, 
  onValue, 
  serverTimestamp, 
  onDisconnect,
  orderByKey,
  limitToLast,
  endBefore,
  startAfter,
  query,
  get
};