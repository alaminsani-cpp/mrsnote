import { useEffect, useState } from 'react';
import { messaging, getToken, onMessage } from '../firebase';
import { set, ref, db } from '../firebase';

const VAPID_KEY = 'BP-M1pY-fTo_C2u_303Jqol4Lj1m8EQChpkAJYKQ4bGxv4DTrqnznDso1qULAz3-otL8EsU5gygmh5urGYylUcE';

export const usePushNotifications = (currentUser, isChatOpen) => {
  const [fcmToken, setFcmToken] = useState(null);

  // Request permission and get token when user is logged in
  useEffect(() => {
    if (!currentUser) return;

    const initFCM = async () => {
      try {
        // Request permission
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        // Get token
        const token = await getToken(messaging, { vapidKey: VAPID_KEY });
        if (token) {
          setFcmToken(token);
          // Store token in Firebase under the user's role
          const tokenRef = ref(db, `privateChats/secret_blossom_chat/fcmTokens/${currentUser.role}`);
          await set(tokenRef, token);
          console.log('FCM token saved for', currentUser.role);
        }
      } catch (error) {
        console.error('FCM token error:', error);
      }
    };

    initFCM();

    // Cleanup: remove token when chat closes or user logs out? Not strictly needed.
  }, [currentUser]);

  // Handle foreground messages (when chat is open, we already have our own notification system)
  useEffect(() => {
    if (!isChatOpen) return;
    const unsubscribe = onMessage(messaging, (payload) => {
      console.log('Foreground message:', payload);
      // You can show a custom toast or discreet notification here
      // But since chat is open, we can rely on the existing showDiscreetNotification
    });
    return unsubscribe;
  }, [isChatOpen]);

  return { fcmToken };
};