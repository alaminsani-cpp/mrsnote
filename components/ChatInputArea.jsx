// src/components/ChatInputArea.jsx
import React, { useRef, useState } from 'react';
import ChatReplyPreview from './ChatReplyPreview';

// ─── Cloudinary config ───────────────────────────────────────
const CLOUDINARY_CLOUD_NAME = 'dzvzmdbmz';
const CLOUDINARY_API_KEY    = '141253321924295';
const CLOUDINARY_API_SECRET = 'n0iF5wulNNTM63gBQ_jWlwqYpac';

async function cloudinarySignature(params) {
  const sorted = Object.keys(params).sort()
    .map(k => `${k}=${params[k]}`).join('&');
  const raw    = sorted + CLOUDINARY_API_SECRET;
  const buf    = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function uploadToCloudinary(file, resourceType = 'video') {
  const timestamp = Math.round(Date.now() / 1000);
  const params    = { timestamp };
  const signature = await cloudinarySignature(params);

  const form = new FormData();
  form.append('file', file);
  form.append('api_key',   CLOUDINARY_API_KEY);
  form.append('timestamp', timestamp);
  form.append('signature', signature);

  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`;
  const res  = await fetch(url, { method: 'POST', body: form });
  const data = await res.json();
  if (data.secure_url) return data.secure_url;
  throw new Error(data.error?.message || 'Upload failed');
}

// ─── ImgBB for images (keep existing) ───────────────────────
const IMGBB_API_KEY = '82e4d3726c6019926399bd2fa5c8d4ef';

const ChatInputArea = ({
  inputText,
  setInputText,
  onSend,
  onTyping,
  activeReply,
  clearReply,
  currentUser,
  chatRoom
}) => {
  const textareaRef  = useRef(null);
  const mediaInputRef = useRef(null);
  const [uploading,  setUploading]  = useState(false);
  const [uploadType, setUploadType] = useState(''); // 'image' | 'video'

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

  // ─── Image upload (ImgBB) ──────────────────────────────────
  const uploadImage = async (file) => {
    if (!file) return;
    setUploading(true);
    setUploadType('image');

    const formData = new FormData();
    formData.append('image', file);

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
        alert('Image upload failed: ' + (data.error?.message || 'Unknown error'));
      }
    } catch (err) {
      console.error('Image upload error:', err);
      alert('Failed to upload image. Check your internet connection.');
    } finally {
      setUploading(false);
      setUploadType('');
      if (mediaInputRef.current) mediaInputRef.current.value = '';
    }
  };

  // ─── Video upload (Cloudinary) ─────────────────────────────
  const uploadVideo = async (file) => {
    if (!file) return;
    setUploading(true);
    setUploadType('video');

    try {
      const videoUrl = await uploadToCloudinary(file, 'video');
      await onSend({ videoUrl, text: inputText.trim() || undefined });
      setInputText('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    } catch (err) {
      console.error('Video upload error:', err);
      alert('Failed to upload video: ' + err.message);
    } finally {
      setUploading(false);
      setUploadType('');
      if (mediaInputRef.current) mediaInputRef.current.value = '';
    }
  };

  const handleMediaSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type.startsWith('image/')) uploadImage(file);
    else if (file.type.startsWith('video/')) uploadVideo(file);
  };

  const hasText = inputText.trim().length > 0;

  // Upload progress label
  const uploadLabel = uploadType === 'video' ? 'Uploading video…' : 'Uploading image…';

  return (
    <div className="input-area">
      <ChatReplyPreview activeReply={activeReply} onClear={clearReply} />

      {uploading && (
        <div className="upload-progress">
          <span className="upload-spinner" />
          <span>{uploadLabel}</span>
        </div>
      )}

      <div className="input-row">
        <div className="input-field-wrap">
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Write something beautiful… or attach media"
            rows={1}
            className="input-field"
            disabled={uploading}
          />
        </div>

        {/* Hidden file input — accepts images and videos */}
        <input
          ref={mediaInputRef}
          type="file"
          accept="image/*,video/*"
          onChange={handleMediaSelect}
          style={{ display: 'none' }}
        />

        {/* Single media picker button */}
        <button
          onClick={() => mediaInputRef.current?.click()}
          className={`image-picker-btn ${uploading ? 'disabled' : ''}`}
          disabled={uploading}
          type="button"
          aria-label="Attach image or video"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: '2px' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <circle cx="8.5" cy="9.5" r="2.5" />
            <path d="M21 15L16 10L5 21" />
          </svg>
        </button>

        {/* Send button */}
        <button
          onClick={() => onSend({ text: inputText })}
          className={`send-btn ${hasText || uploading ? 'send-btn--active' : 'send-btn--idle'}`}
          disabled={uploading}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', alignSelf: 'center' }}
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