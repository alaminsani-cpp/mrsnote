import React, { useState } from 'react';

// IMPORT IMAGES
import himAvatar from '../src/assets/him.png';
import herAvatar from '../src//assets/her.png';
import searchIcon from '../src/assets/search.png';

const ChatHeader = ({
  partnerName,
  partnerAvatar,
  isPartnerOnline,
  partnerLastSeen,
  partnerMood,
  myMood,
  availableMoods,
  showMoodPicker,
  setShowMoodPicker,
  onSetMood,
  onClose,
  onSearch,
}) => {
  const [showSearch, setShowSearch] = useState(false);
  const [localQuery, setLocalQuery] = useState('');

  const formatLastSeen = (ts) => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return new Date(ts).toLocaleDateString();
  };

  const currentMoodEmoji = availableMoods.find((m) => m.key === myMood)?.emoji || '✨';
  const partnerMoodEmoji = availableMoods.find((m) => m.key === partnerMood)?.emoji;

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setLocalQuery(value);
    onSearch(value);
  };

  const avatarImage = partnerAvatar === 'her' ? himAvatar : herAvatar;
  const isHer = partnerAvatar === 'her';

  return (
    <div className="chat-header">
      <div className="header-inner">
        {/* Close button */}
        <button onClick={onClose} className="close-btn" aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M13.5 4.5L4.5 13.5M4.5 4.5L13.5 13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>

        {/* Avatar */}
        <div className="avatar-wrap">
          <div className={`avatar-ring ${isHer ? 'avatar-ring--her' : 'avatar-ring--him'}`}>
            <div className="avatar-img-wrap">
              <img src={avatarImage} alt={partnerName} className="avatar-img" />
            </div>
          </div>
          <span className={`presence-dot ${isPartnerOnline ? 'presence-dot--online' : 'presence-dot--offline'}`} />
        </div>

        {/* Info */}
        <div className="header-info">
          <div className="partner-name-row">
            <span className="partner-name">{partnerName}</span>
            {partnerMoodEmoji && (
              <span className="partner-mood-badge" title="Partner's mood">
                {partnerMoodEmoji}
              </span>
            )}
          </div>
          <div className="presence-text">
            {isPartnerOnline ? (
              <span className="online-text">
                <span className="online-pulse" />
                online now
              </span>
            ) : partnerLastSeen ? (
              <span className="lastseen-text">last seen {formatLastSeen(partnerLastSeen)}</span>
            ) : (
              <span className="lastseen-text">offline</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="header-actions">
          {/* Search */}
          {showSearch ? (
            <div className="search-bar">
              <svg className="search-icon-inline" width="14" height="14" viewBox="0 0 20 20" fill="none">
                <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <input
                type="text"
                placeholder="Search…"
                value={localQuery}
                onChange={handleSearchChange}
                autoFocus
                className="search-input"
              />
              <button onClick={() => { setShowSearch(false); setLocalQuery(''); onSearch(''); }} className="search-close">✕</button>
            </div>
          ) : (
            <button onClick={() => setShowSearch(true)} className="icon-btn" aria-label="Search">
              <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
                <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          )}

          {/* Mood picker */}
          <div className="mood-wrap">
            <button
              onClick={() => setShowMoodPicker(!showMoodPicker)}
              className="mood-trigger"
              title="Set your mood"
            >
              <span className="mood-emoji">{currentMoodEmoji}</span>
            </button>

            {showMoodPicker && (
              <div className="mood-panel">
                <div className="mood-panel-label">How are you feeling?</div>
                <div className="mood-grid">
                  {availableMoods.map((m) => (
                    <button
                      key={m.key}
                      onClick={() => onSetMood(m.key)}
                      className={`mood-item ${myMood === m.key ? 'mood-item--active' : ''}`}
                    >
                      <span className="mood-item-emoji">{m.emoji}</span>
                      <span className="mood-item-label">{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatHeader;