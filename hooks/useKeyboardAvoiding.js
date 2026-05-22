// src/hooks/useKeyboardAvoiding.js
import { useEffect, useState, useCallback, useRef } from 'react';

export const useKeyboardAvoiding = (enabled = true, extraPadding = 0) => {
  const [style, setStyle] = useState({});
  const rafId = useRef(null);

  const updateStyle = useCallback(() => {
    if (!enabled) {
      setStyle({});
      return;
    }
    const vv = window.visualViewport;
    if (!vv) {
      setStyle({
        height: window.innerHeight,
        top: 0,
        left: 0,
        right: 0,
        position: 'fixed',
      });
      return;
    }
    // Request animation frame to avoid layout thrashing
    if (rafId.current) cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(() => {
      const newHeight = vv.height + extraPadding;
      setStyle({
        height: newHeight,
        top: vv.offsetTop,
        left: 0,
        right: 0,
        position: 'fixed',
      });
    });
  }, [enabled, extraPadding]);

  useEffect(() => {
    if (!enabled) {
      setStyle({});
      return;
    }
    const vv = window.visualViewport;
    if (!vv) {
      window.addEventListener('resize', updateStyle);
      updateStyle();
      return () => window.removeEventListener('resize', updateStyle);
    }
    vv.addEventListener('resize', updateStyle);
    vv.addEventListener('scroll', updateStyle);
    updateStyle();
    return () => {
      vv.removeEventListener('resize', updateStyle);
      vv.removeEventListener('scroll', updateStyle);
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [enabled, updateStyle]);

  return style;
};