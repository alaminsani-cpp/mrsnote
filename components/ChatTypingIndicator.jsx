// src/components/ChatTypingIndicator.jsx
import React from 'react';

const ChatTypingIndicator = ({ isTyping }) => {
  if (!isTyping) return null;
  
  return (
    <div className="self-start flex items-center gap-1 bg-[#1e1813] border border-[#38281e] rounded-2xl rounded-bl-md px-3 py-2">
      <span className="w-1.5 h-1.5 rounded-full bg-[#7a6a60] animate-bounce" style={{ animationDelay: '0s' }}></span>
      <span className="w-1.5 h-1.5 rounded-full bg-[#7a6a60] animate-bounce" style={{ animationDelay: '0.2s' }}></span>
      <span className="w-1.5 h-1.5 rounded-full bg-[#7a6a60] animate-bounce" style={{ animationDelay: '0.4s' }}></span>
    </div>
  );
};

export default ChatTypingIndicator;