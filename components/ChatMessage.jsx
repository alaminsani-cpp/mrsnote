// src/components/ChatMessage.jsx  –  OPTIMIZED + VIDEO SUPPORT
import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import EmojiBubble from './EmojiBubble';
import ReactionPicker from './ReactionPicker';
import { useLongPress } from '../hooks/useLongPress';

// ─── stable URL regex (compiled once) ───────────────────────────────
const URL_REGEX = /(https?:\/\/[^\s]+|www\.[^\s]+\.[^\s]+)/gi;

const renderText = (text, query) => {
  const segments = text.split(URL_REGEX);
  URL_REGEX.lastIndex = 0;

  return segments.map((segment, i) => {
    const isUrl = URL_REGEX.test(segment);
    URL_REGEX.lastIndex = 0;

    if (isUrl) {
      const href = segment.startsWith('http') ? segment : `https://${segment}`;
      return (
        <a key={i} href={href} target="_blank" rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()} className="msg-link">
          {segment}
        </a>
      );
    }

    if (!query?.trim()) return segment;
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const hlRe    = new RegExp(`(${escaped})`, 'gi');
    const parts   = segment.split(hlRe);
    return parts.map((part, j) =>
      hlRe.test(part)
        ? <mark key={`${i}-${j}`} className="search-mark">{part}</mark>
        : part
    );
  });
};

// ─── Video player component ──────────────────────────────────────────
const VideoPlayer = ({ url, isSent }) => {
  const [error, setError] = useState(false);

  const handleDownload = async (e) => {
    e.stopPropagation();
    try {
      const res  = await fetch(url);
      const blob = await res.blob();
      const bUrl = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = bUrl;
      // derive filename from URL or fallback
      const parts   = url.split('/');
      const rawName = parts[parts.length - 1].split('?')[0];
      a.download = rawName || 'video.mp4';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(bUrl);
    } catch {
      // fallback — open in new tab
      window.open(url, '_blank');
    }
  };

  if (error) {
    return (
      <div className="video-error">
        <span>⚠️ Video unavailable</span>
      </div>
    );
  }

  return (
    <div className={`video-wrap ${isSent ? 'video-wrap--sent' : 'video-wrap--recv'}`}>
      <video
        className="video-player"
        src={url}
        controls
        preload="metadata"
        playsInline
        onClick={(e) => e.stopPropagation()}
        onError={() => setError(true)}
      />
      <button
        className="video-download-btn"
        onClick={handleDownload}
        aria-label="Download video"
        type="button"
        title="Download video"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        <span>Download</span>
      </button>
    </div>
  );
};

const ChatMessage = memo(({
  message,
  currentUser,
  attachSwipe,
  setReply,
  onAddReaction,
  showToast,
  partnerName,
  searchQuery,
}) => {
  const [pickerVisible, setPickerVisible] = useState(false);
  const messageRef = useRef(null);
  const isSent     = message.role === currentUser.role;

  useEffect(() => {
    if (messageRef.current) attachSwipe(messageRef.current, message);
  }, [attachSwipe, message.id]);

  useEffect(() => {
    const element = messageRef.current;
    if (!element) return;
    if (!window.matchMedia('(pointer: fine)').matches) return;

    const handleDoubleClick = (e) => {
      e.stopPropagation();
      setReply({
        text:            message.videoUrl ? '🎥 Video'
                       : (message.imageUrl && !message.text) ? '📷 Image'
                       : (message.text || ''),
        sender:          message.displayName || (message.role === 'her' ? '🌸 Her' : '💙 Him'),
        messageId:       message.id,
        isImage:         !!(message.imageUrl && !message.text),
        isVideo:         !!message.videoUrl,
        originalMessage: message,
      });
    };

    element.addEventListener('dblclick', handleDoubleClick);
    return () => element.removeEventListener('dblclick', handleDoubleClick);
  }, [message.id, message.text, message.imageUrl, message.videoUrl, message.displayName, message.role, setReply]);

  const handleLongPress = useCallback(() => setPickerVisible(true), []);

  const handleReactionSelect = useCallback(async (emoji) => {
    const current = message.reactions?.[currentUser.role];
    await onAddReaction(message.id, current === emoji ? null : emoji);
    setPickerVisible(false);
  }, [message.id, message.reactions, currentUser.role, onAddReaction]);

  const handleSeenInfo = useCallback((e) => {
    e.stopPropagation();
    const partnerRole   = currentUser.role === 'her' ? 'him' : 'her';
    const readByPartner = message.readBy?.[partnerRole];
    if (readByPartner) {
      const d = new Date(readByPartner);
      showToast(`Seen by ${partnerName} on ${d.toLocaleDateString()} at ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`);
    } else {
      showToast('Not seen yet');
    }
  }, [message.readBy, currentUser.role, partnerName, showToast]);

  const reactions      = message.reactions ? Object.entries(message.reactions).filter(([, v]) => v) : null;
  const partnerRole    = currentUser.role === 'her' ? 'him' : 'her';
  const longPressProps = useLongPress(handleLongPress, null, 500);

  if (!message.text && !message.imageUrl && !message.videoUrl) return null;

  const replyData = (() => {
    if (!message.replyTo) return null;
    const { text, isImage, isVideo, sender } = message.replyTo;
    return {
      sender,
      displayText: isVideo ? '🎥 Video' : isImage ? '📷 Image' : (text || ''),
    };
  })();

  const bubbleContent = (
    <>
      {/* Video */}
      {message.videoUrl && (
        <div className="message-video mt-1 mb-1">
          <VideoPlayer url={message.videoUrl} isSent={isSent} />
        </div>
      )}

      {/* Image */}
      {message.imageUrl && (
        <div className="message-image mt-1 mb-1">
          <img
            src={message.imageUrl}
            alt="Shared image"
            loading="lazy"
            decoding="async"
            className="max-w-full rounded-lg cursor-pointer"
            style={{ maxHeight: '200px', objectFit: 'cover' }}
            onClick={(e) => { e.stopPropagation(); window.open(message.imageUrl, '_blank'); }}
            onError={(e) => { e.target.style.display = 'none'; showToast('Failed to load image'); }}
          />
        </div>
      )}

      {/* Text */}
      {message.text && (
        <span className="bubble-text">
          {renderText(message.text, searchQuery)}
        </span>
      )}
    </>
  );

  return (
    <>
      <div
        ref={messageRef}
        className={`msg-wrapper ${isSent ? 'msg-wrapper--sent' : 'msg-wrapper--recv'}`}
        {...longPressProps}
      >
        {!isSent && <div className="msg-sender-name">{message.displayName}</div>}

        <div style={{ position: 'relative' }}>
          <EmojiBubble
            text={message.text || ''}
            role={message.role}
            isSent={isSent}
            replyTo={replyData ? { text: replyData.displayText, sender: replyData.sender } : null}
          >
            {bubbleContent}
          </EmojiBubble>
        </div>

        {reactions?.length > 0 && (
          <div className="reactions-row">
            {reactions.map(([role, emoji]) => (
              <span key={role}
                className={`reaction-chip ${role === currentUser.role ? 'reaction-chip--mine' : ''}`}>
                {emoji}
              </span>
            ))}
          </div>
        )}

        <div className="msg-meta">
          <span className="msg-time">
            {new Date(message.ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </span>
          {isSent && (
            <span onClick={handleSeenInfo}
              className={`read-tick ${message.readBy?.[partnerRole] ? 'read-tick--read' : 'read-tick--unread'}`}>
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
}, (prev, next) => {
  return (
    prev.message.id        === next.message.id        &&
    prev.message.text      === next.message.text      &&
    prev.message.imageUrl  === next.message.imageUrl  &&
    prev.message.videoUrl  === next.message.videoUrl  &&
    prev.message.reactions === next.message.reactions &&
    prev.message.readBy    === next.message.readBy    &&
    prev.searchQuery       === next.searchQuery       &&
    prev.partnerName       === next.partnerName
  );
});

ChatMessage.displayName = 'ChatMessage';
export default ChatMessage;