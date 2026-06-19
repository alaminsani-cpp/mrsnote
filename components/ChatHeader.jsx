// src/components/ChatHeader.jsx
import React, { useState } from 'react';
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
  tokenBalance,   // NEW prop
}) => {
  const [showSearch, setShowSearch] = useState(false);
  const [localQuery, setLocalQuery] = useState('');
  const [showTokenInfo, setShowTokenInfo] = useState(false); // NEW

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

  // NEW: Token info component
  const TokenInfo = () => (
    <div className="mood-panel" style={{ width: '260px' }}>
      <div className="mood-panel-label" style={{ marginBottom: '8px' }}>Token Budget</div>
      <div style={{ padding: '4px 0', fontSize: '14px', color: 'var(--text-primary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span>Balance</span>
          <span style={{ fontWeight: 'bold' }}>
            {tokenBalance !== null ? tokenBalance : '…'} / 300
          </span>
        </div>
        <div style={{ 
          height: '6px', 
          background: 'rgba(255,255,255,0.1)', 
          borderRadius: '3px', 
          overflow: 'hidden',
          marginBottom: '12px'
        }}>
          <div style={{
            height: '100%',
            width: `${tokenBalance !== null ? (tokenBalance / 300) * 100 : 0}%`,
            background: tokenBalance < 20 ? '#e8837a' : '#4dd68c',
            transition: 'width 0.3s'
          }} />
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
          <div>Text: 1 token per 100 characters</div>
          <div>Active: 10 tokens per 10 min</div>
          <div>Open: 3 tokens per new session</div>
          <div>Photo: 8 tokens per image</div>
          <div style={{ marginTop: '6px', fontStyle: 'italic' }}>
            Resets at midnight (local time)
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="chat-header">
      <div className="header-inner">
        {/* Close button */}
        <button onClick={onClose} className="close-btn" aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M13.5 4.5L4.5 13.5M4.5 4.5L13.5 13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>

        {/* Avatar (unchanged) */}
        <div className="avatar-wrap">
          <div className={`avatar-ring ${isHer ? 'avatar-ring--her' : 'avatar-ring--him'}`}>
            <div className="avatar-img-wrap">
              <img src={avatarImage} alt={partnerName} className="avatar-img" />
            </div>
          </div>
          <span className={`presence-dot ${isPartnerOnline ? 'presence-dot--online' : 'presence-dot--offline'}`} />
        </div>

        {/* Info (unchanged) */}
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
          {/* Search (unchanged) */}
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

          {/* NEW: Settings / Token Info button */}
          <div className="mood-wrap">
            <button
              onClick={() => setShowTokenInfo(!showTokenInfo)}
              className="mood-trigger"
              title="Token budget"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
              </svg>
            </button>
            {showTokenInfo && <TokenInfo />}
          </div>

          {/* Mood picker (unchanged) */}
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
