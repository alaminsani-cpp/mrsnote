import React, { useRef, useEffect } from 'react';
import ChatEmptyState from './ChatEmptyState';
import ChatTypingIndicator from './ChatTypingIndicator';
import ChatMessage from './ChatMessage';

const ChatMessageList = ({
  messages,
  currentUser,
  typingPartner,
  attachSwipe,
  onAddReaction,
  showToast,
  partnerName,
  searchQuery,
  containerRef,
  loadingOlder
}) => {
  const messagesEndRef = useRef(null);
  const initialScrollDone = useRef(false);
  const prevMessagesLength = useRef(0);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Initial load: scroll to bottom once
  useEffect(() => {
    if (!initialScrollDone.current && messages.length > 0 && !loadingOlder) {
      scrollToBottom();
      initialScrollDone.current = true;
    }
  }, [messages, loadingOlder]);

  // Auto-scroll on new message if near bottom
  useEffect(() => {
    if (!containerRef?.current) return;
    const container = containerRef.current;
    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    const lastMessage = messages[messages.length - 1];
    const isOwnNewMessage =
      lastMessage &&
      lastMessage.role === currentUser?.role &&
      messages.length > prevMessagesLength.current;
    if (isNearBottom || isOwnNewMessage) scrollToBottom();
    prevMessagesLength.current = messages.length;
  }, [messages]);

  // Filter messages by search query
  const filteredMessages =
    searchQuery?.trim() === ''
      ? messages
      : messages.filter((msg) =>
          msg.text.toLowerCase().includes(searchQuery?.toLowerCase() || '')
        );

  if (filteredMessages.length === 0) {
    return (
      <div
        ref={containerRef}
        className="chat-messages-scroll"
        style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
      >
        {searchQuery ? (
          <div className="no-results">No messages match your search</div>
        ) : (
          <ChatEmptyState />
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="chat-messages-scroll">
      {loadingOlder && (
        <div className="loading-older">Loading earlier messages…</div>
      )}

      {filteredMessages.map((msg) => (
        <ChatMessage
          key={msg.id}
          message={msg}
          currentUser={currentUser}
          attachSwipe={attachSwipe}
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
};

export default ChatMessageList;