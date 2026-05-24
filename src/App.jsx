// src/App.jsx
import { useState, useRef } from 'react';
import Journal from '../components/Journal';
import Chat from '../components/chat';

function App() {
  const [chatOpen, setChatOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const openTimeoutRef = useRef(null);

  const handleSecretWord = (word) => {
    let user = null;
    if (word === 'totapakhi') {
      user = {
        role: 'her',
        displayName: '🌸 Her',
        partnerName: '💙 Him',
        avatarClass: 'her',
        avatarEmoji: '🌸',
      };
    } else if (word === 'pakhi') {
      user = {
        role: 'him',
        displayName: '💙 Him',
        partnerName: '🌸 Her',
        avatarClass: 'him',
        avatarEmoji: '💙',
      };
    }
    if (user) {
      // 1. Dismiss keyboard
      if (document.activeElement && document.activeElement.blur) {
        document.activeElement.blur();
      }
      // 2. Clear any pending timeout
      if (openTimeoutRef.current) clearTimeout(openTimeoutRef.current);
      // 3. Wait for keyboard to fully close before showing chat
      openTimeoutRef.current = setTimeout(() => {
        setCurrentUser(user);
        setChatOpen(true);
      }, 150);
    }
  };

  const closeChat = () => {
    setChatOpen(false);
    setCurrentUser(null);
  };

  return (
    <div>
      <Journal onSecretWordDetected={handleSecretWord} />
      <Chat
        isOpen={chatOpen}
        onClose={closeChat}
        currentUser={currentUser}
        partnerName={currentUser?.partnerName}
        partnerAvatar={currentUser?.avatarClass}
        partnerAvatarEmoji={currentUser?.avatarEmoji}
      />
    </div>
  );
}

export default App;