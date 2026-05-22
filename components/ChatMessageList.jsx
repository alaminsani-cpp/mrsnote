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

  // Auto-scroll when new message arrives, but only if already near bottom or it's a new message from user?
  useEffect(() => {
    if (!containerRef?.current) return;
    const container = containerRef.current;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    // Also scroll if the new message is from current user (they likely want to see it)
    const lastMessage = messages[messages.length - 1];
    const isOwnNewMessage = lastMessage && lastMessage.role === currentUser?.role && messages.length > prevMessagesLength.current;
    if (isNearBottom || isOwnNewMessage) {
      scrollToBottom();
    }
    prevMessagesLength.current = messages.length;
  }, [messages]);

  // Filter messages by search query
  const filteredMessages = searchQuery?.trim() === ''
    ? messages
    : messages.filter(msg =>
        msg.text.toLowerCase().includes(searchQuery?.toLowerCase() || '')
      );

  if (filteredMessages.length === 0) {
    return (
      <div ref={containerRef} className="chat-messages-scroll flex-1 overflow-auto p-3 flex flex-col items-center justify-center text-[#5a4a40]">
        {searchQuery ? 'No matching messages' : <ChatEmptyState />}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="chat-messages-scroll flex-1 overflow-auto p-3 flex flex-col gap-1.5">
      {loadingOlder && (
        <div className="text-center text-[#7a6a60] text-xs py-2 animate-pulse">
          Loading older messages...
        </div>
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