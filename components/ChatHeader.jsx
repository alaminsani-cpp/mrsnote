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

  const currentMoodEmoji =
    availableMoods.find((m) => m.key === myMood)?.emoji || '😶';

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setLocalQuery(value);
    onSearch(value);
  };

  // FIXED IMAGE HANDLING
  const avatarImage =
    partnerAvatar === 'her' ? himAvatar : herAvatar;

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-[#38281e] bg-[#1e1813]">
      
      {/* Avatar */}
      <div className="relative">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center overflow-hidden ${
            partnerAvatar === 'her'
              ? 'bg-gradient-to-br from-[#6b2d1a] to-[#3d1208]'
              : 'bg-gradient-to-br from-[#1a3048] to-[#0b1a28]'
          }`}
        >
          <img
            src={avatarImage}
            alt={partnerName}
            className="w-8 h-8 object-contain"
          />
        </div>

        <span
          className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#1e1813] ${
            isPartnerOnline ? 'bg-[#5bc87a]' : 'bg-[#6a5a50]'
          }`}
        ></span>
      </div>

      {/* Partner Info */}
      <div className="flex-1">
        <div className="flex items-center gap-1">
          <span className="font-serif text-[#f0e0d0] font-semibold">
            {partnerName}
          </span>

          {partnerMood && (
            <span className="text-sm">
              {availableMoods.find((m) => m.key === partnerMood)?.emoji}
            </span>
          )}
        </div>

        <div className="text-xs font-serif italic">
          {isPartnerOnline ? (
            <span className="text-[#5bc87a]">online</span>
          ) : partnerLastSeen ? (
            <span className="text-[#6a5a50]">
              last seen {formatLastSeen(partnerLastSeen)}
            </span>
          ) : (
            <span className="text-[#6a5a50]">offline</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        
        {/* Search */}
        {showSearch ? (
          <input
            type="text"
            placeholder="Search..."
            value={localQuery}
            onChange={handleSearchChange}
            autoFocus
            className="bg-[#2a1f18] text-white rounded-full px-3 py-1.5 text-sm outline-none w-28"
          />
        ) : (
          <button
            onClick={() => setShowSearch(true)}
            className="text-[#a09080] w-8 h-8 flex items-center justify-center"
          >
            <img
              src={searchIcon}
              alt="Search"
              className="w-5 h-5"
            />
          </button>
        )}

        {/* Mood Picker */}
        <div className="relative">
          <button
            onClick={() => setShowMoodPicker(!showMoodPicker)}
            className="w-9 h-9 rounded-full bg-white/5 border border-[#38281e] text-xl flex items-center justify-center"
          >
            {currentMoodEmoji}
          </button>

          {showMoodPicker && (
            <div className="absolute right-0 top-full mt-2 w-52 bg-[#1e1813] border border-[#38281e] rounded-2xl p-3 z-50 shadow-xl">
              
              <div className="text-[10px] uppercase text-center text-[#7a6a60] mb-2">
                Set your mood
              </div>

              <div className="grid grid-cols-4 gap-1">
                {availableMoods.map((m) => (
                  <button
                    key={m.key}
                    onClick={() => onSetMood(m.key)}
                    className={`flex flex-col items-center p-1 rounded-lg ${
                      myMood === m.key
                        ? 'bg-[#4a7c59]/20 border border-[#4a7c59]'
                        : ''
                    }`}
                  >
                    <span className="text-xl">{m.emoji}</span>

                    <span className="text-[8px] text-[#7a6a60]">
                      {m.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Close */}
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full bg-white/5 text-[#807060] flex items-center justify-center"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

export default ChatHeader;