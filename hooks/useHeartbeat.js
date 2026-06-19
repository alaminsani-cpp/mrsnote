// src/hooks/useHeartbeat.js
import { useEffect, useRef } from 'react';

const HEARTBEAT_INTERVAL = 30 * 1000; // 30 seconds
const IDLE_TIMEOUT = 3 * 60 * 1000;   // 3 minutes

export const useHeartbeat = (isActive, currentUser) => {
  const heartbeatInterval = useRef(null);
  const idleTimeout = useRef(null);
  const lastActivityRef = useRef(Date.now());
  const isIdleRef = useRef(false);

  useEffect(() => {
    if (!isActive || !currentUser) return;

    const sendHeartbeat = async () => {
      try {
        await fetch('/.netlify/functions/heartbeat', {
          method: 'POST',
          body: JSON.stringify({ role: currentUser.role }),
        });
      } catch (err) {
        console.warn('Heartbeat failed:', err);
      }
    };

    // Reset idle timer on any activity
    const resetIdleTimer = () => {
      lastActivityRef.current = Date.now();
      if (isIdleRef.current) {
        isIdleRef.current = false;
        // Send a heartbeat immediately when user becomes active again
        sendHeartbeat();
      }
      // Clear existing idle timeout
      if (idleTimeout.current) clearTimeout(idleTimeout.current);
      // Set new idle timeout
      idleTimeout.current = setTimeout(() => {
        isIdleRef.current = true;
      }, IDLE_TIMEOUT);
    };

    // Activity listeners
    const events = ['mousemove', 'keydown', 'touchstart', 'scroll'];
    events.forEach(event => window.addEventListener(event, resetIdleTimer));

    // Initial idle timer
    resetIdleTimer();

    // Heartbeat interval – send every 30s if not idle and tab visible
    heartbeatInterval.current = setInterval(() => {
      if (!document.hidden && !isIdleRef.current) {
        sendHeartbeat();
      }
    }, HEARTBEAT_INTERVAL);

    // Send one immediately
    sendHeartbeat();

    return () => {
      events.forEach(event => window.removeEventListener(event, resetIdleTimer));
      if (heartbeatInterval.current) clearInterval(heartbeatInterval.current);
      if (idleTimeout.current) clearTimeout(idleTimeout.current);
    };
  }, [isActive, currentUser]);
};