// src/components/ChatInputArea.jsx
import React, { useRef } from 'react';
import ChatReplyPreview from './ChatReplyPreview';

const ChatInputArea = ({
  inputText,
  setInputText,
  onSend,
  onTyping,
  activeReply,
  clearReply
}) => {
  const textareaRef = useRef(null);

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
      onSend();
    }
  };

  const hasText = inputText.trim().length > 0;

  return (
    <div className="input-area">
      <ChatReplyPreview activeReply={activeReply} onClear={clearReply} />
      <div className="input-row">
        <div className="input-field-wrap">
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Write something beautiful…"
            rows={1}
            className="input-field"
          />
        </div>
        <button
          onClick={onSend}
          className={`send-btn ${hasText ? 'send-btn--active' : 'send-btn--idle'}`}
          aria-label="Send message"
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