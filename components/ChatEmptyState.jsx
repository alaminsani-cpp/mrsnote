// src/components/ChatEmptyState.jsx
import React from 'react';

const ChatEmptyState = () => {
  return (
    <div className="empty-state">
      <div className="empty-orb">
        <span className="empty-orb-icon">🌙</span>
      </div>
      <p className="empty-title">Just the two of you</p>
      <p className="empty-sub">Say something that matters 💬</p>
    </div>
  );
};

export default ChatEmptyState;