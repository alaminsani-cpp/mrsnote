// src/components/ChatInputArea.jsx
import React, { useRef, useState } from 'react';
import ChatReplyPreview from './ChatReplyPreview';

const ChatInputArea = ({
  inputText,
  setInputText,
  onSend,
  onTyping,
  activeReply,
  clearReply,
}) => {
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const inputAreaRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const autoResize = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 110) + 'px';
    }
  };

  const handleInput = (e) => {
    setInputText(e.target.value);
    autoResize();
    onTyping();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend({ text: inputText });
    }
  };

  // Scroll the whole input area into view when focused (critical for mobile)
  const handleFocus = () => {
    // Small delay to let the keyboard start opening
    setTimeout(() => {
      inputAreaRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }, 150);
  };

  const uploadImage = async (file) => {
    if (!file) return;
    setUploading(true);

    const formData = new FormData();
    formData.append('image', file);

    const IMGBB_API_KEY = '82e4d3726c6019926399bd2fa5c8d4ef';

    try {
      const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (data.success) {
        await onSend({ imageUrl: data.data.url, text: inputText.trim() || undefined });
        setInputText('');
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
      } else {
        alert('Upload failed: ' + (data.error?.message || 'Unknown error'));
      }
    } catch (err) {
      console.error('Upload error:', err);
      alert('Failed to upload image. Check your internet connection.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      uploadImage(file);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const hasText = inputText.trim().length > 0;

  return (
    <div ref={inputAreaRef} className="input-area">
      <ChatReplyPreview activeReply={activeReply} onClear={clearReply} />

      {uploading && (
        <div className="upload-progress">
          <span className="upload-spinner" />
          <span>Uploading image...</span>
        </div>
      )}

      <div className="input-row">
        <div className="input-field-wrap">
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            placeholder="Write something beautiful… or attach an image"
            rows={1}
            className="input-field"
            disabled={uploading}
          />
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageSelect}
          style={{ display: 'none' }}
        />

        <button
          onClick={triggerFileSelect}
          className={`image-picker-btn ${uploading ? 'disabled' : ''}`}
          disabled={uploading}
          type="button"
          aria-label="Attach image"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            alignSelf: 'center',
            marginBottom: '2px',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <circle cx="8.5" cy="9.5" r="2.5" />
            <path d="M21 15L16 10L5 21" />
          </svg>
        </button>

        <button
          onClick={() => onSend({ text: inputText })}
          className={`send-btn ${hasText || uploading ? 'send-btn--active' : 'send-btn--idle'}`}
          disabled={uploading}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            alignSelf: 'center',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default ChatInputArea;