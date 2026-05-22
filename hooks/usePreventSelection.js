import { useEffect } from 'react';

export const usePreventSelection = (enabled = true) => {
  useEffect(() => {
    if (!enabled) return;

    const preventCopy = (e) => {
      e.preventDefault();
      e.clipboardData?.setData('text/plain', '');
    };

    const preventContextMenu = (e) => {
      e.preventDefault();
    };

    // Disable selection via CSS (will also add class)
    document.body.classList.add('no-select');
    
    // Prevent copy/cut events
    document.addEventListener('copy', preventCopy);
    document.addEventListener('cut', preventCopy);
    document.addEventListener('contextmenu', preventContextMenu);

    return () => {
      document.body.classList.remove('no-select');
      document.removeEventListener('copy', preventCopy);
      document.removeEventListener('cut', preventCopy);
      document.removeEventListener('contextmenu', preventContextMenu);
    };
  }, [enabled]);
};