// src/components/ReactionPicker.jsx
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

const REACTIONS = [
  { emoji: '❤️', label: 'heart' },
  { emoji: '😂', label: 'laugh' },
  { emoji: '😮', label: 'wow' },
  { emoji: '😢', label: 'sad' },
  { emoji: '😠', label: 'angry' },
  { emoji: '👍', label: 'thumbsup' },
  { emoji: '🚫', label: 'remove', isRemove: true },
];

const ReactionPicker = ({ onSelect, onClose, messageElement }) => {
  const pickerRef = useRef(null);
  const [style, setStyle] = useState({ position: 'fixed', visibility: 'hidden', zIndex: 1000 });
  const readyRef = useRef(false); // blocks outside-click until after mount

  // FIX 1: useLayoutEffect so DOM is painted before we measure
  useLayoutEffect(() => {
    if (!pickerRef.current || !messageElement) return;

    const pickerRect = pickerRef.current.getBoundingClientRect();
    const messageRect = messageElement.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const GAP = 8;

    let top = messageRect.top - pickerRect.height - GAP;
    let placeBelow = false;

    if (top < 10) {
      top = messageRect.bottom + GAP;
      placeBelow = true;
    }

    let left = messageRect.left + messageRect.width / 2 - pickerRect.width / 2;
    if (left < 10) left = 10;
    if (left + pickerRect.width > viewportWidth - 10) {
      left = viewportWidth - pickerRect.width - 10;
    }

    if (!placeBelow && top + pickerRect.height > viewportHeight - 10) {
      top = messageRect.bottom + GAP;
    }

    // FIX 2: reveal only after position is calculated
    setStyle({ position: 'fixed', top, left, zIndex: 1000, visibility: 'visible' });
  }, [messageElement]);

  // FIX 3: reliable grace period using a ref + setTimeout
  useEffect(() => {
    const timer = setTimeout(() => {
      readyRef.current = true;
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  // FIX 4: only use 'mousedown' + 'touchstart', skip redundant 'click'
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

  const handleSelect = (reaction) => {
    onSelect(reaction.isRemove ? null : reaction.emoji);
    onClose(); // close picker after selection
  };

  return (
    <div ref={pickerRef} style={style} className="reaction-picker">
      {REACTIONS.map((react) => (
        <button
          key={react.label}
          onClick={() => handleSelect(react)}
          className={`reaction-btn ${react.isRemove ? 'reaction-btn--remove' : ''}`}
          title={react.label}
        >
          {react.emoji}
        </button>
      ))}
    </div>
  );
};

export default ReactionPicker;