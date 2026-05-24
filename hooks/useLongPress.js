import { useRef, useCallback } from 'react';

export const useLongPress = (onLongPress, onClick, delay = 500) => {
  const timerRef = useRef(null);
  const isLongPress = useRef(false);

  const start = useCallback((e) => {
  e.preventDefault?.();   // prevent mouse/touch default
  isLongPress.current = false;
  timerRef.current = setTimeout(() => {
    isLongPress.current = true;
    onLongPress(e);
  }, delay);
}, [onLongPress, delay]);

  const cancel = useCallback((e) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!isLongPress.current && onClick) {
      onClick(e);
    }
  }, [onClick]);

  return {
    onMouseDown: start,
    onMouseUp: cancel,
    onMouseLeave: cancel,
    onTouchStart: start,
    onTouchEnd: cancel,
  };
};




