// src/components/EmojiBubble.jsx
import React from 'react';

const isEmojiOnly = (text) => {
  return /^[\p{Emoji}\s\u200d\uFE0F\u20E3\uD83C\uDFFB-\uD83C\uDFFF]+$/u.test(text) && text.trim().length <= 10;
};

const EmojiBubble = ({ text, role, isSent, replyTo, children }) => {
  const isEmoji = isEmojiOnly(text);
  const content = children !== undefined ? children : text;

  if (isEmoji) {
    return (
      <div className={`bubble-emoji ${isSent ? 'bubble-emoji--sent' : 'bubble-emoji--recv'}`}>
        {replyTo && (
          <div className="bubble-reply">
            <span className="bubble-reply-name">↩ {replyTo.sender}</span>
            <span className="bubble-reply-text">{replyTo.text}</span>
          </div>
        )}
        <span className="emoji-only">{content}</span>
      </div>
    );
  }

  return (
    <div className={`bubble ${isSent ? 'bubble--sent' : 'bubble--recv'}`}>
      {replyTo && (
        <div className="bubble-reply">
          <span className="bubble-reply-name">↩ {replyTo.sender}</span>
          <span className="bubble-reply-text">{replyTo.text}</span>
        </div>
      )}
      <span className="bubble-text">{content}</span>
    </div>
  );
};

export default EmojiBubble;