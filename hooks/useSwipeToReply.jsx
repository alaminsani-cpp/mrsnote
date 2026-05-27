// src/hooks/useSwipeToReply.jsx  –  OPTIMIZED
import { useState, useRef, useCallback } from 'react';

const THRESHOLD = 64;

export const useSwipeToReply = () => {
  const [activeReply, setActiveReply] = useState(null);
  // Map of element → cleanup fn — prevents duplicate listener registration
  const swipeRefs = useRef(new Map());

  const clearReply = useCallback(() => setActiveReply(null), []);

  const attachSwipe = useCallback((element, message) => {
    if (!element) return;

    // Skip if already attached for this element
    if (swipeRefs.current.has(element)) return;

    let startX = 0;
    let currentX = 0;
    let swiping = false;

    const handleTouchStart = (e) => {
      startX   = e.touches[0].clientX;
      currentX = 0;
      swiping  = true;
    };

    const handleTouchMove = (e) => {
      if (!swiping) return;
      const dx    = e.touches[0].clientX - startX;
      currentX    = dx;
      const isSent = element.classList.contains('msg-wrapper--sent');
      const delta  = isSent ? Math.min(0, dx) : Math.max(0, dx);
      element.style.transform = `translateX(${delta * 0.45}px)`;
    };

    const handleTouchEnd = () => {
      swiping = false;
      element.style.transform = '';

      if (Math.abs(currentX) >= THRESHOLD) {
        const hasText  = !!message.text;
        const hasImage = !!message.imageUrl;
        setActiveReply({
          text:            hasImage && !hasText ? '📷 Image' : (message.text || ''),
          sender:          message.displayName || (message.role === 'her' ? '🌸 Her' : '💙 Him'),
          messageId:       message.id,
          isImage:         hasImage && !hasText,
          originalMessage: message,
        });
      }
      currentX = 0;
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove',  handleTouchMove,  { passive: true });
    element.addEventListener('touchend',   handleTouchEnd);

    const remove = () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove',  handleTouchMove);
      element.removeEventListener('touchend',   handleTouchEnd);
      swipeRefs.current.delete(element);
    };
    swipeRefs.current.set(element, remove);
    return remove;
  }, []); // stable: no deps that change

  const getReplyPreviewBar = () => {
    if (!activeReply) return null;
    return {
      component: (
        <div className="reply-preview">
          <div className="reply-preview-bar" />
          <div className="reply-preview-content">
            <div className="reply-preview-name">Replying to {activeReply.sender}</div>
            <div className="reply-preview-text">
              {activeReply.isImage ? '📷 Image' : activeReply.text}
            </div>
          </div>
          <button onClick={clearReply} className="reply-preview-close" aria-label="Cancel reply">
            <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
              <path d="M13.5 4.5L4.5 13.5M4.5 4.5L13.5 13.5"
                stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      ),
      activeReply,
    };
  };

  return { activeReply, clearReply, attachSwipe, setActiveReply, getReplyPreviewBar };
};