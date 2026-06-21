// hooks/usePushSubscription.js
import { useEffect, useState } from 'react';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

// Push API requires a Uint8Array, not a raw base64 string
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const usePushSubscription = (currentUser, isOpen) => {
  const [subscription, setSubscription] = useState(null);
  const [permissionState, setPermissionState] = useState('default');

  useEffect(() => {
    if (!currentUser || !isOpen) return;

    const subscribe = async () => {
      try {
        // 0. Make sure the public key actually made it into the client bundle
        if (!VAPID_PUBLIC_KEY) {
          console.error(
            'VITE_VAPID_PUBLIC_KEY is missing. Add it as an env var in Netlify ' +
            '(Site configuration → Environment variables) using the same value as ' +
            'your VAPID public key, then redeploy.'
          );
          return;
        }

        // 1. Check if service workers are supported
        if (!('serviceWorker' in navigator)) {
          console.warn('Service workers not supported');
          return;
        }

        // 2. Check if push is supported
        if (!('PushManager' in window)) {
          console.warn('Push notifications not supported');
          return;
        }

        // 3. Register the service worker
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        });

        // 4. Request permission
        const permission = await Notification.requestPermission();
        setPermissionState(permission);

        if (permission !== 'granted') {
          console.warn('Notification permission denied');
          return;
        }

        // 5. Subscribe to push
        const sub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });

        setSubscription(sub);

        // 6. Save subscription to server
        await fetch('/.netlify/functions/save-subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role: currentUser.role,
            subscription: sub,
          }),
        });

        console.log(`✅ Push subscription saved for ${currentUser.role}`);
      } catch (error) {
        console.error('Error subscribing to push:', error);
      }
    };

    subscribe();

    // Cleanup: unsubscribe when chat closes?
    // We keep the subscription for future sessions
  }, [currentUser, isOpen]);

  return { subscription, permissionState };
};