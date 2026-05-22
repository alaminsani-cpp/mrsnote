import { useState, useRef, useCallback } from 'react';

export const useSwipeToReply = () => {
  const [activeReply, setActiveReply] = useState(null);
  const swipeRefs = useRef(new Map());

  const clearReply = useCallback(() => {
    setActiveReply(null);
  }, []);

  const attachSwipe = useCallback((element, message) => {
    if (!element) return;
    
    let startX = 0;
    let currentX = 0;
    let swiping = false;
    const THRESHOLD = 64;

    const handleTouchStart = (e) => {
      startX = e.touches[0].clientX;
      swiping = true;
    };

    const handleTouchMove = (e) => {
      if (!swiping) return;
      currentX = e.touches[0].clientX - startX;
      const delta = element.classList.contains('sent') 
        ? Math.min(0, currentX) 
        : Math.max(0, currentX);
      element.style.transform = `translateX(${delta * 0.45}px)`;
    };

    const handleTouchEnd = () => {
      swiping = false;
      element.style.transform = '';
      if (Math.abs(currentX) >= THRESHOLD) {
        setActiveReply({
          text: message.text,
          sender: message.displayName || (message.role === 'her' ? '🌸 Her' : '💙 Him'),
          messageId: message.id
        });
      }
      currentX = 0;
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: true });
    element.addEventListener('touchend', handleTouchEnd);

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  const getReplyPreviewBar = () => {
    if (!activeReply) return null;
    return {
      component: (
        <div className="bg-[#2a1f18] border-l-3 border-[#4a7c59] rounded-t-lg px-3 py-2 mx-3 text-xs text-[#a09080] flex justify-between items-center gap-2 animate-slideUp">
          <div className="flex-1 overflow-hidden">
            <div className="text-[10px] text-[#7cb58e] mb-0.5">Replying to {activeReply.sender}</div>
            <div className="truncate">{activeReply.text}</div>
          </div>
          <button onClick={clearReply} className="text-[#6a5a50] hover:text-[#f0e0d0] text-base">✕</button>
        </div>
      ),
      activeReply
    };
  };

  return { activeReply, clearReply, attachSwipe, getReplyPreviewBar };
};