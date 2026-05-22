import React, { useState, useRef, useEffect } from 'react';
import EmojiBubble from './EmojiBubble';
import ReactionPicker from './ReactionPicker';
import { useLongPress } from '../hooks/useLongPress';

const ChatMessage = ({ 
  message, 
  currentUser, 
  attachSwipe, 
  onAddReaction, 
  showToast, 
  partnerName,
  searchQuery   // new prop
}) => {
  const [pickerVisible, setPickerVisible] = useState(false);
  const messageRef = useRef(null);
  const isSent = message.role === currentUser.role;

  useEffect(() => {
    if (messageRef.current) {
      attachSwipe(messageRef.current, message);
    }
  }, [attachSwipe, message]);

  const handleLongPress = () => {
    setPickerVisible(true);
  };

  const handleReactionSelect = async (emoji) => {
    const currentReaction = message.reactions?.[currentUser.role];
    const newEmoji = currentReaction === emoji ? null : emoji;
    await onAddReaction(message.id, newEmoji);
    setPickerVisible(false);
  };

  const handleSeenInfo = (e) => {
    e.stopPropagation();
    const partnerRole = currentUser.role === 'her' ? 'him' : 'her';
    const readByPartner = message.readBy?.[partnerRole];
    if (readByPartner) {
      const date = new Date(readByPartner).toLocaleDateString();
      const time = new Date(readByPartner).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      showToast(`Seen by ${partnerName} on ${date} at ${time}`);
    } else {
      showToast('Not seen yet');
    }
  };

  const getReactions = () => {
    if (!message.reactions) return null;
    const entries = Object.entries(message.reactions);
    return entries.length ? entries : null;
  };

  const formatTime = (ts) => new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  // Highlight search query in text
  const highlightText = (text, query) => {
    if (!query || query.trim() === '') return text;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? <mark key={i} className="bg-yellow-600/50 text-white rounded px-0.5">{part}</mark> : part
    );
  };

  const longPressProps = useLongPress(handleLongPress, null, 500);
  const reactions = getReactions();
  const partnerRole = currentUser.role === 'her' ? 'him' : 'her';

  return (
    <>
      <div
        ref={messageRef}
        className={`flex flex-col max-w-[76%] ${isSent ? 'self-end items-end' : 'self-start items-start'}`}
        {...longPressProps}
      >
        {!isSent && <div className="text-xs text-[#6a5a50] mb-0.5 ml-1">{message.displayName}</div>}
        <div className="relative">
          <EmojiBubble text={message.text} role={message.role} isSent={isSent} replyTo={message.replyTo}>
            {/* Override default text rendering to enable highlighting */}
            {React.cloneElement(
              <span />,
              { children: highlightText(message.text, searchQuery) }
            )}
          </EmojiBubble>
        </div>
        {reactions && (
          <div className="flex gap-1 mt-0.5 ml-1">
            {reactions.map(([role, emoji]) => (
              <span key={role} className={`text-xs bg-[#2a1f18] rounded-full px-1.5 py-0.5 ${role === currentUser.role ? 'border border-[#4a7c59]' : ''}`}>
                {emoji}
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-1 mt-0.5 mx-1">
          <span className="text-[10px] text-[#5a4a40] italic">{formatTime(message.ts)}</span>
          {isSent && (
            <span onClick={handleSeenInfo} className="text-xs cursor-pointer">
              <span className={message.readBy?.[partnerRole] ? 'text-[#5bc87a]' : 'text-[#5a4a40]'}>
                ✓✓
              </span>
            </span>
          )}
        </div>
      </div>
      {pickerVisible && (
        <ReactionPicker
          onSelect={handleReactionSelect}
          onClose={() => setPickerVisible(false)}
          messageElement={messageRef.current}
        />
      )}
    </>
  );
};

export default ChatMessage;