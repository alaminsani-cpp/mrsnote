// public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDfQxXfOVfXN6_sI_wPSxDImGP1eTYmn0c",
  authDomain: "mrsnote-ac3e5.firebaseapp.com",
  databaseURL: "https://mrsnote-ac3e5-default-rtdb.firebaseio.com",
  projectId: "mrsnote-ac3e5",
  storageBucket: "mrsnote-ac3e5.firebasestorage.app",
  messagingSenderId: "822769418996",
  appId: "1:822769418996:web:7a003ca8e908666a7bd4a1"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/favicon.ico'
  };
  self.registration.showNotification(notificationTitle, notificationOptions);
});