// src/components/ChatMessageList.jsx  –  OPTIMIZED
import React, { useRef, useEffect, memo } from 'react';
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
  containerRef,
  loadingOlder,
}) => {
  const messagesEndRef      = useRef(null);
  const initialScrollDone   = useRef(false);
  const prevMessagesLength  = useRef(0);

  const scrollToBottom = () =>
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  // Initial load: scroll once
  useEffect(() => {
    if (!initialScrollDone.current && messages.length > 0 && !loadingOlder) {
      scrollToBottom();
      initialScrollDone.current = true;
    }
  }, [messages.length, loadingOlder]);

  // Auto-scroll on new message if near bottom or own message
  useEffect(() => {
    if (!containerRef?.current) return;
    const c = containerRef.current;
    const nearBottom  = c.scrollHeight - c.scrollTop - c.clientHeight < 100;
    const lastMessage = messages[messages.length - 1];
    const isOwnNew    = lastMessage?.role === currentUser?.role
                        && messages.length > prevMessagesLength.current;
    if (nearBottom || isOwnNew) scrollToBottom();
    prevMessagesLength.current = messages.length;
  }, [messages.length]); // length only — avoids re-running on reaction/readBy updates

  // Filtered messages — recomputed only when messages array or query changes
  const filteredMessages = React.useMemo(() => {
    if (!searchQuery?.trim()) return messages;
    const q = searchQuery.toLowerCase();
    return messages.filter(m => m.text?.toLowerCase().includes(q));
  }, [messages, searchQuery]);

  if (filteredMessages.length === 0) {
    return (
      <div ref={containerRef} className="chat-messages-scroll"
        style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {searchQuery
          ? <div className="no-results">No messages match your search</div>
          : <ChatEmptyState />}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="chat-messages-scroll">
      {loadingOlder && <div className="loading-older">Loading earlier messages…</div>}

      {filteredMessages.map((msg) => (
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
      ))}

      <ChatTypingIndicator isTyping={typingPartner} />
      <div ref={messagesEndRef} />
    </div>
  );
});

ChatMessageList.displayName = 'ChatMessageList';
export default ChatMessageList;