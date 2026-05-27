// src/hooks/useLongPress.js  –  OPTIMIZED
import { useRef, useCallback } from 'react';

export const useLongPress = (onLongPress, onClick, delay = 500) => {
  const timerRef     = useRef(null);
  const isLongPress  = useRef(false);
  // Keep latest callbacks in refs so the returned handlers are always stable
  const onLongPressRef = useRef(onLongPress);
  const onClickRef     = useRef(onClick);
  onLongPressRef.current = onLongPress;
  onClickRef.current     = onClick;

  const start = useCallback((e) => {
    // Only prevent default for touch to allow scrolling on mouse
    if (e.type === 'touchstart') e.preventDefault();
    e.stopPropagation();
    isLongPress.current = false;
    timerRef.current = setTimeout(() => {
      isLongPress.current = true;
      onLongPressRef.current?.(e);
    }, delay);
  }, [delay]);

  const cancel = useCallback((e) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!isLongPress.current) {
      onClickRef.current?.(e);
    } else {
      e.preventDefault();
      e.stopPropagation();
    }
  }, []); // no deps — uses refs

  return {
    onMouseDown:  start,
    onMouseUp:    cancel,
    onMouseLeave: cancel,
    onTouchStart: start,
    onTouchEnd:   cancel,
  };
};