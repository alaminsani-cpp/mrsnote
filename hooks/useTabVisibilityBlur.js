import { useState, useEffect } from 'react';

export const useTabVisibilityBlur = (enabled = true) => {
  const [isHidden, setIsHidden] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      setIsHidden(document.hidden);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [enabled]);

  return isHidden;
};