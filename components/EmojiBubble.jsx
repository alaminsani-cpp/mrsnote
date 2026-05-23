// src/components/EmojiBubble.jsx
import React from 'react';

const isEmojiOnly = (text) => {
  // Match emojis, spaces, and a few punctuation marks that might accompany emojis
  return /^[\p{Emoji}\s\u200d\uFE0F\u20E3\uD83C\uDFFB-\uD83C\uDFFF]+$/u.test(text) && text.trim().length <= 10;
};

const EmojiBubble = ({ text, role, isSent, replyTo, children }) => {
  const isEmoji = isEmojiOnly(text);
  
  const bubbleClasses = `px-3 py-2 rounded-2xl font-serif break-words ${
    isSent ? 'rounded-br-md' : 'rounded-bl-md'
  } ${
    role === 'her' 
      ? 'bg-[#6b2d1a] text-[#fad5c5]' 
      : 'bg-[#1a3048] text-[#c0d8f5]'
  } ${
    isEmoji ? '!bg-transparent !text-4xl !px-2 !py-1' : ''
  }`;

  // Use children if provided, otherwise fall back to plain text
  const content = children !== undefined ? children : text;

  return (
    <div className={bubbleClasses}>
      {replyTo && (
        <div className="bg-black/20 border-l-3 border-[#7cb58e] rounded-md px-2 py-1 mb-1 text-xs italic text-[#9a8878]">
          <div className="text-[10px] text-[#7cb58e] not-italic mb-0.5">↩️ {replyTo.sender}</div>
          <div className="truncate max-w-[180px]">{replyTo.text}</div>
        </div>
      )}
      <span className={isEmoji ? 'block text-center' : ''}>{content}</span>
    </div>
  );
};

export default EmojiBubble;