// src/hooks/useSwipeToReply.jsx
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
      // Limit drag direction based on message alignment
      const delta = element.classList.contains('msg-wrapper--sent') 
        ? Math.min(0, currentX)   // sent messages drag left
        : Math.max(0, currentX);  // received drag right
      element.style.transform = `translateX(${delta * 0.45}px)`;
    };

    const handleTouchEnd = () => {
      swiping = false;
      element.style.transform = '';
      if (Math.abs(currentX) >= THRESHOLD) {
        // Prepare reply data
        let replyText = message.text || '';
        let isImage = false;
        
        if (message.imageUrl && !message.text) {
          // Pure image message
          replyText = '📷 Image';
          isImage = true;
        } else if (message.imageUrl && message.text) {
          // Message with both text and image – show text as usual
          replyText = message.text;
          isImage = false; // replying to the text part, but we still note the image exists?
          // For simplicity, we just treat it as a normal text reply.
          // If you want to indicate both, you could set replyText = `📷 ${message.text}`
        }
        
        setActiveReply({
          text: replyText,
          sender: message.displayName || (message.role === 'her' ? '🌸 Her' : '💙 Him'),
          messageId: message.id,
          isImage: isImage,
          originalMessage: message, // optional: keep full message for advanced features
        });
      }
      currentX = 0;
    };

    // Clean up previous listeners if any (avoid duplicates)
    const cleanup = swipeRefs.current.get(element);
    if (cleanup) cleanup();
    
    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: true });
    element.addEventListener('touchend', handleTouchEnd);
    
    // Store cleanup function
    const removeListeners = () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
    swipeRefs.current.set(element, removeListeners);
    
    return removeListeners;
  }, []);

  // Optional: helper to get reply preview component (used in ChatInputArea)
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
              <path d="M13.5 4.5L4.5 13.5M4.5 4.5L13.5 13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      ),
      activeReply
    };
  };

  return { activeReply, clearReply, attachSwipe, getReplyPreviewBar };
};