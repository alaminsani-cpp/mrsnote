// src/components/ChatMessage.jsx
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
  searchQuery
}) => {
  const [pickerVisible, setPickerVisible] = useState(false);
  const messageRef = useRef(null);
  const isSent = message.role === currentUser.role;

  // Attach swipe-to-reply listener
  useEffect(() => {
    if (messageRef.current) {
      attachSwipe(messageRef.current, message);
    }
  }, [attachSwipe, message]);

  const handleLongPress = () => setPickerVisible(true);

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

  const formatTime = (ts) =>
    new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  // Render clickable links and search highlight
  const renderText = (text, query) => {
    const URL_REGEX = /(https?:\/\/[^\s]+|www\.[^\s]+\.[^\s]+)/gi;
    const segments = text.split(URL_REGEX);

    return segments.map((segment, i) => {
      const isUrl = URL_REGEX.test(segment);
      URL_REGEX.lastIndex = 0;

      if (isUrl) {
        const href = segment.startsWith('http') ? segment : `https://${segment}`;
        return (
          <a
            key={i}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="msg-link"
          >
            {segment}
          </a>
        );
      }

      if (!query || query.trim() === '') return segment;
      const highlightRegex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      const parts = segment.split(highlightRegex);
      return parts.map((part, j) =>
        highlightRegex.test(part)
          ? <mark key={`${i}-${j}`} className="search-mark">{part}</mark>
          : part
      );
    });
  };

  const longPressProps = useLongPress(handleLongPress, null, 500);
  const reactions = getReactions();
  const partnerRole = currentUser.role === 'her' ? 'him' : 'her';

  // ------------------------------------------------------------------
  // Helper: render image if present
  // ------------------------------------------------------------------
  const renderImage = () => {
    if (!message.imageUrl) return null;
    return (
      <div className="message-image mt-1 mb-1">
        <img
          src={message.imageUrl}
          alt="Shared image"
          className="max-w-full rounded-lg cursor-pointer"
          style={{ maxHeight: '200px', objectFit: 'cover' }}
          onClick={(e) => {
            e.stopPropagation();
            window.open(message.imageUrl, '_blank');
          }}
          onError={(e) => {
            e.target.style.display = 'none';
            showToast('Failed to load image');
          }}
        />
      </div>
    );
  };

  // ------------------------------------------------------------------
  // Prepare reply preview text (show "📷 Image" for image replies)
  // ------------------------------------------------------------------
  const getReplyText = () => {
    if (!message.replyTo) return null;
    const { text, isImage, sender } = message.replyTo;
    const displayText = isImage ? '📷 Image' : (text || '');
    return { sender, displayText };
  };

  const replyData = getReplyText();

  // ------------------------------------------------------------------
  // Decide what to render inside the bubble/emoji component
  // ------------------------------------------------------------------
  // For emoji‑only messages we still want to show images if any.
  // The EmojiBubble component already handles reply previews.
  // We'll pass the image as children inside the same structure.
  const bubbleContent = (
    <>
      {renderImage()}
      {message.text && (
        <span className="bubble-text">
          {renderText(message.text, searchQuery)}
        </span>
      )}
    </>
  );

  // If the message has an image but no text, we still need to pass something
  // so the bubble doesn't become empty. The image itself is already rendered.
  const hasContent = !!message.text || !!message.imageUrl;

  if (!hasContent) return null;

  return (
    <>
      <div
        ref={messageRef}
        className={`msg-wrapper ${isSent ? 'msg-wrapper--sent' : 'msg-wrapper--recv'}`}
        {...longPressProps}
      >
        {!isSent && (
          <div className="msg-sender-name">{message.displayName}</div>
        )}

        <div style={{ position: 'relative' }}>
          {/* 
            EmojiBubble will wrap the bubbleContent.
            If the message is only an image (no text), we treat it as a normal bubble
            because isEmojiOnly would be false. So it works fine.
          */}
          <EmojiBubble
            text={message.text || ''}   // needed for emoji detection
            role={message.role}
            isSent={isSent}
            replyTo={replyData ? { text: replyData.displayText, sender: replyData.sender } : null}
          >
            {bubbleContent}
          </EmojiBubble>
        </div>

        {reactions && (
          <div className="reactions-row">
            {reactions.map(([role, emoji]) => (
              <span
                key={role}
                className={`reaction-chip ${role === currentUser.role ? 'reaction-chip--mine' : ''}`}
              >
                {emoji}
              </span>
            ))}
          </div>
        )}

        <div className="msg-meta">
          <span className="msg-time">{formatTime(message.ts)}</span>
          {isSent && (
            <span
              onClick={handleSeenInfo}
              className={`read-tick ${message.readBy?.[partnerRole] ? 'read-tick--read' : 'read-tick--unread'}`}
            >
              ✓✓
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