// src/components/ReactionPicker.jsx
import React, { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';

const REACTIONS = [
  { emoji: '❤️', label: 'heart' },
  { emoji: '🤣', label: 'laugh' },
  { emoji: '😮', label: 'wow' },
  { emoji: '😢', label: 'sad' },
  { emoji: '😠', label: 'angry' },
  { emoji: '👍', label: 'thumbsup' },
  { emoji: '🚫', label: 'remove', isRemove: true },
];

const ReactionPicker = ({ onSelect, onClose, messageElement, isSent = false }) => {
  const pickerRef = useRef(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [isVisible, setIsVisible] = useState(false);
  const readyRef = useRef(false);
  const mountedRef = useRef(false);

  // ─── Calculate position once ──────────────────────────────
  const calculatePosition = useCallback(() => {
    if (!messageElement || !pickerRef.current) return;

    const messageRect = messageElement.getBoundingClientRect();
    const pickerRect = pickerRef.current.getBoundingClientRect();

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const GAP = 12;
    const BUFFER = 6;
    const PICKER_WIDTH = pickerRect.width || 240;
    const PICKER_HEIGHT = pickerRect.height || 44;

    let left;

    if (isSent) {
      // Sent (right-aligned): anchor to the right edge of the bubble
      left = messageRect.right - PICKER_WIDTH - GAP;
      if (left < GAP) {
        left = messageRect.left + (messageRect.width / 2) - (PICKER_WIDTH / 2);
      }
    } else {
      // Received (left-aligned): anchor to the left edge
      left = messageRect.left + GAP;
      if (left + PICKER_WIDTH > viewportWidth - GAP) {
        left = messageRect.left + (messageRect.width / 2) - (PICKER_WIDTH / 2);
      }
    }

    // Clamp horizontally
    const minLeft = GAP + BUFFER;
    const maxLeft = viewportWidth - PICKER_WIDTH - GAP - BUFFER;
    left = Math.max(minLeft, Math.min(maxLeft, left));

    // Vertical: above, fallback below
    let top = messageRect.top - PICKER_HEIGHT - GAP;
    if (top < GAP + BUFFER) {
      top = messageRect.bottom + GAP;
    }
    if (top + PICKER_HEIGHT > viewportHeight - GAP - BUFFER) {
      top = GAP + BUFFER;
    }
    const minTop = GAP + BUFFER;
    const maxTop = viewportHeight - PICKER_HEIGHT - GAP - BUFFER;
    top = Math.max(minTop, Math.min(maxTop, top));

    setPosition({ top, left });
    setIsVisible(true);
  }, [messageElement, isSent]);

  // ─── Measure and position on mount ─────────────────────────
  useLayoutEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      calculatePosition();
      // Second pass after fonts/layout settle
      requestAnimationFrame(() => {
        calculatePosition();
      });
    }
  }, [calculatePosition]);

  // ─── Close on any scroll or resize ─────────────────────────
  useEffect(() => {
    if (!isVisible) return;

    const handleClose = () => {
      onClose();
    };

    // Scroll events on window and inside the message container
    window.addEventListener('scroll', handleClose, true);
    window.addEventListener('resize', handleClose);

    const scrollContainer = messageElement?.closest('.chat-messages-scroll');
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleClose, { passive: true });
    }

    return () => {
      window.removeEventListener('scroll', handleClose, true);
      window.removeEventListener('resize', handleClose);
      if (scrollContainer) {
        scrollContainer.removeEventListener('scroll', handleClose);
      }
    };
  }, [isVisible, onClose, messageElement]);

  // ─── Click outside handler ──────────────────────────────────
  useEffect(() => {
    const handleOutside = (e) => {
      if (!readyRef.current) return;
      if (messageElement?.contains(e.target)) return;
      if (pickerRef.current?.contains(e.target)) return;
      onClose();
    };

    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside, { passive: true });

    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, [onClose, messageElement]);

  // ─── Mark ready for outside clicks ─────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      readyRef.current = true;
    }, 200);
    return () => clearTimeout(timer);
  }, []);

  const handleSelect = (reaction) => {
    onSelect(reaction.isRemove ? null : reaction.emoji);
    onClose();
  };

  // ─── Render via Portal ─────────────────────────────────────
  const pickerContent = (
    <div
      ref={pickerRef}
      className="reaction-picker"
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        zIndex: 9999,
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'scale(1)' : 'scale(0.92)',
        transition: 'opacity 0.15s ease, transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)',
        pointerEvents: isVisible ? 'auto' : 'none',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4)',
        background: '#0e121a',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '32px',
        padding: '6px 10px',
        display: 'flex',
        alignItems: 'center',
        gap: '2px',
        overflow: 'visible',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        willChange: 'transform, opacity',
      }}
    >
      {REACTIONS.map((react) => (
        <button
          key={react.label}
          onClick={() => handleSelect(react)}
          className={`reaction-btn ${react.isRemove ? 'reaction-btn--remove' : ''}`}
          title={react.label}
          style={{
            fontSize: react.isRemove ? '16px' : '20px',
            padding: '2px 4px',
            borderRadius: '50%',
            cursor: 'pointer',
            transition: 'transform 0.12s ease',
            lineHeight: 1,
            background: 'transparent',
            border: 'none',
            color: react.isRemove ? 'rgba(255,255,255,0.4)' : 'inherit',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.2) translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1) translateY(0)';
          }}
        >
          {react.emoji}
        </button>
      ))}
    </div>
  );

  return createPortal(pickerContent, document.body);
};

export default ReactionPicker;