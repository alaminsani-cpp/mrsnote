// src/components/ChatMessageList.jsx
import React, { memo } from 'react';
import ChatEmptyState from './ChatEmptyState';
import ChatTypingIndicator from './ChatTypingIndicator';
import ChatMessage from './ChatMessage';

const ChatMessageList = memo(({
  messages,
  currentUser,
  typingPartner,
  attachSwipe,
  setReply,
  onAddReaction,
  showToast,
  partnerName,
  searchQuery,
  loadingOlder,
  bottomSentinelRef,
}) => {
  // Filtered messages — only recomputed when messages or searchQuery changes
  const filteredMessages = React.useMemo(() => {
    if (!searchQuery?.trim()) return messages;
    const q = searchQuery.toLowerCase();
    return messages.filter(m => m.text?.toLowerCase().includes(q));
  }, [messages, searchQuery]);

  return (
    <>
      {loadingOlder && (
        <div className="loading-older">Loading earlier messages…</div>
      )}

      {filteredMessages.length === 0
        ? (searchQuery
            ? <div className="no-results">No messages match your search</div>
            : <ChatEmptyState />)
        : filteredMessages.map((msg) => (
            <ChatMessage
              key={msg.id}
              message={msg}
              currentUser={currentUser}
              attachSwipe={attachSwipe}
              setReply={setReply}
              onAddReaction={onAddReaction}
              showToast={showToast}
              partnerName={partnerName}
              searchQuery={searchQuery}
            />
          ))
      }

      <ChatTypingIndicator isTyping={typingPartner} />

      {/* Sentinel div — Chat.jsx calls scrollIntoView on this to reach the bottom */}
      <div ref={bottomSentinelRef} style={{ height: 1 }} />
    </>
  );
});

ChatMessageList.displayName = 'ChatMessageList';
export default ChatMessageList;