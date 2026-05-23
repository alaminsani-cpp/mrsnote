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

  return (
    <>
      <ChatReplyPreview activeReply={activeReply} onClear={clearReply} />
      <div className="p-2.5 border-t border-[#38281e] bg-[#1e1813] flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={inputText}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Write a message…"
          rows={1}
          className="flex-1 bg-white/5 border border-[#38281e] rounded-3xl px-4 py-2.5 text-[#f0e0d0] font-serif text-sm resize-none max-h-28 outline-none overscroll-none"
        />
        <button onClick={onSend} className="w-11 h-11 rounded-full bg-gradient-to-br from-[#4a7c59] to-[#2e5239] text-white flex items-center justify-center shadow-md active:scale-95 transition">
          ➤
        </button>
      </div>
    </>
  );
};

export default ChatInputArea;