// src/components/ChatReplyPreview.jsx
import React from 'react';

const ChatReplyPreview = ({ activeReply, onClear }) => {
  if (!activeReply) return null;

  return (
    <div className="reply-preview">
      <div className="reply-preview-bar" />
      <div className="reply-preview-content">
        <div className="reply-preview-name">Replying to {activeReply.sender}</div>
        <div className="reply-preview-text">{activeReply.text}</div>
      </div>
      <button onClick={onClear} className="reply-preview-close" aria-label="Cancel reply">
        <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
          <path d="M13.5 4.5L4.5 13.5M4.5 4.5L13.5 13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  );
};

export default ChatReplyPreview;