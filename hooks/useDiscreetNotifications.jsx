// src/hooks/useDiscreetNotifications.js
import { useCallback, useRef, useEffect } from 'react';

const NOTIFICATION_PHRASES = [
  "A little bird left a note.",
  "A whisper arrived.",
  "A petal fell from the tree.",
  "A secret was shared.",
  "A distant hum heard.",
  "A soft breeze carries a word."
];

const getRandomPhrase = () => {
  return NOTIFICATION_PHRASES[Math.floor(Math.random() * NOTIFICATION_PHRASES.length)];
};

export const useDiscreetNotifications = (currentUser, isChatOpen) => {
  const permissionGranted = useRef(false);
  const lastNotifiedId = useRef(null);

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return false;
    }
    if (Notification.permission === 'granted') {
      permissionGranted.current = true;
      return true;
    }
    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      permissionGranted.current = permission === 'granted';
      return permissionGranted.current;
    }
    return false;
  }, []);

  const showDiscreetNotification = useCallback((message) => {
    // Conditions to not show
    if (!permissionGranted.current) return;
    if (isChatOpen) return;
    if (!message || message.role === currentUser?.role) return;
    if (lastNotifiedId.current === message.id) return;

    const title = getRandomPhrase();
    const body = message.text.length > 40 ? message.text.slice(0, 37) + '…' : message.text;
    
    const notification = new Notification(title, {
      body,
      icon: '/favicon.ico', // make sure you have a favicon in public/
      silent: false,
    });
    
    lastNotifiedId.current = message.id;
    
    // Auto-close after 5 seconds
    setTimeout(() => notification.close(), 5000);
  }, [isChatOpen, currentUser]);

  // Optional: log permission status for debugging
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'granted') {
      permissionGranted.current = true;
    }
  }, []);

  return { requestPermission, showDiscreetNotification };
};