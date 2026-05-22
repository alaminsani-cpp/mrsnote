// src/components/ChatReplyPreview.jsx
import React from 'react';

const ChatReplyPreview = ({ activeReply, onClear }) => {
  if (!activeReply) return null;

  return (
    <div className="bg-[#2a1f18] border-l-3 border-[#4a7c59] rounded-t-lg px-3 py-2 mx-3 text-xs text-[#a09080] flex justify-between items-center gap-2 animate-slideUp">
      <div className="flex-1 overflow-hidden">
        <div className="text-[10px] text-[#7cb58e] mb-0.5">Replying to {activeReply.sender}</div>
        <div className="truncate">{activeReply.text}</div>
      </div>
      <button onClick={onClear} className="text-[#6a5a50] hover:text-[#f0e0d0] text-base">✕</button>
    </div>
  );
};

export default ChatReplyPreview;