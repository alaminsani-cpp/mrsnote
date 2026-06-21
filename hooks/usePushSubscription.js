// hooks/usePushSubscription.js
import { useEffect, useState } from 'react';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

export const usePushSubscription = (currentUser, isOpen) => {
  const [subscription, setSubscription] = useState(null);
  const [permissionState, setPermissionState] = useState('default');

  useEffect(() => {
    if (!currentUser || !isOpen) return;

    const subscribe = async () => {
      try {
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
          applicationServerKey: VAPID_PUBLIC_KEY,
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