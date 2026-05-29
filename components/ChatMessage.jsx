// src/components/ChatMessage.jsx  –  OPTIMIZED + VIDEO SUPPORT + LAZY VIDEO
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
// FIX: uses IntersectionObserver so the <video> element (and its network
// request) is only created once the player scrolls into the viewport.
// Off-screen messages render a lightweight placeholder instead.
const VideoPlayer = ({ url, isSent }) => {
  const containerRef = useRef(null);
  const videoRef     = useRef(null);

  // FIX: start false — only flip to true when the container enters viewport
  const [isVisible, setIsVisible] = useState(false);
  const [error,     setError]     = useState(false);
  const [playing,   setPlaying]   = useState(false);
  const [progress,  setProgress]  = useState(0);
  const [duration,  setDuration]  = useState(0);
  const [current,   setCurrent]   = useState(0);

  // FIX: IntersectionObserver — mount video only when it scrolls into view.
  // Once visible we never hide it again (unobserve after first intersection)
  // so the element isn't torn down mid-playback when the user scrolls slightly.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(el); // one-shot: stay mounted after first appear
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const togglePlay = (e) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); }
    else          { v.pause(); setPlaying(false); }
  };

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    const pct = (v.currentTime / v.duration) * 100;
    setProgress(pct);
    setCurrent(v.currentTime);
  };

  const handleSeek = (e) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v || !v.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    v.currentTime = ((e.clientX - rect.left) / rect.width) * v.duration;
  };

  const fmt = (s) => {
    const m   = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div
      ref={containerRef}
      className={`video-wrap ${isSent ? 'video-wrap--sent' : 'video-wrap--recv'}`}
    >
      {/* FIX: render placeholder until the container enters the viewport */}
      {!isVisible ? (
        <div className="video-placeholder">
          <div className={`video-play-btn ${isSent ? 'video-play-btn--sent' : 'video-play-btn--recv'}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          </div>
        </div>
      ) : error ? (
        <div className="video-error"><span>⚠️ Video unavailable</span></div>
      ) : (
        <>
          {/* Video element — no native controls */}
          <div className="video-stage" onClick={togglePlay}>
            <video
              ref={videoRef}
              className="video-player"
              src={url}
              preload="metadata"
              playsInline
              onTimeUpdate={handleTimeUpdate}
              onEnded={() => setPlaying(false)}
              onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
              onError={() => setError(true)}
            />
            {/* Centre play/pause overlay */}
            <div className={`video-play-overlay ${playing ? 'video-play-overlay--playing' : ''}`}>
              <div className={`video-play-btn ${isSent ? 'video-play-btn--sent' : 'video-play-btn--recv'}`}>
                {playing
                  ? <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="5"  y="3" width="4" height="18" rx="1"/>
                      <rect x="15" y="3" width="4" height="18" rx="1"/>
                    </svg>
                  : <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="5,3 19,12 5,21"/>
                    </svg>
                }
              </div>
            </div>
          </div>

          {/* Custom controls bar */}
          <div className={`video-controls ${isSent ? 'video-controls--sent' : 'video-controls--recv'}`}>
            <span className="video-time">{fmt(current)}</span>

            <div className="video-progress-track" onClick={handleSeek}>
              <div
                className={`video-progress-fill ${isSent ? 'video-progress-fill--sent' : 'video-progress-fill--recv'}`}
                style={{ width: `${progress}%` }}
              />
              <div
                className={`video-progress-thumb ${isSent ? 'video-progress-thumb--sent' : 'video-progress-thumb--recv'}`}
                style={{ left: `${progress}%` }}
              />
            </div>

            <span className="video-time">{fmt(duration)}</span>
          </div>
        </>
      )}
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
      {/* Video — lazy loaded via IntersectionObserver inside VideoPlayer */}
      {message.videoUrl && (
        <div className="message-video mt-1 mb-1">
          <VideoPlayer url={message.videoUrl} isSent={isSent} />
        </div>
      )}

      {/* Image — native browser lazy loading */}
      {message.imageUrl && (
        <div className="message-image mt-1 mb-1">
          <img
            src={message.imageUrl}
            alt="Shared image"
            loading="lazy"
            decoding="async"
            className="media-fixed"
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