// src/components/ChatEmptyState.jsx
import React from 'react';

const ChatEmptyState = () => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-2 text-[#4a3a30]">
      <span className="text-5xl">🌿</span>
      <span className="font-['Caveat'] text-lg text-[#5a4a40]">
        Just the two of you here.<br/>Say something 💬
      </span>
    </div>
  );
};

export default ChatEmptyState;