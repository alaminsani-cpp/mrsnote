// src/components/ChatTypingIndicator.jsx
import React from 'react';

const ChatTypingIndicator = ({ isTyping }) => {
  if (!isTyping) return null;

  return (
    <div className="typing-indicator">
      <span className="typing-dot" style={{ animationDelay: '0ms' }} />
      <span className="typing-dot" style={{ animationDelay: '180ms' }} />
      <span className="typing-dot" style={{ animationDelay: '360ms' }} />
    </div>
  );
};

export default ChatTypingIndicator;