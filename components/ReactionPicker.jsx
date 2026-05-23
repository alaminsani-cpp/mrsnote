import React, { useEffect, useRef, useState } from 'react';

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
  const [style, setStyle] = useState({});

  useEffect(() => {
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

    setStyle({ position: 'fixed', top, left, zIndex: 1000 });
  }, [messageElement]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) onClose();
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [onClose]);

  const handleSelect = (reaction) => {
    onSelect(reaction.isRemove ? null : reaction.emoji);
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