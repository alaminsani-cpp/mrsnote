// src/components/Chat.jsx
import { useState, useEffect, useRef } from 'react';
import { 
  db, ref, push, onChildAdded, onChildChanged, set, onValue, onDisconnect,
  orderByKey, limitToLast, endBefore, get
} from '../src/firebase';
import ChatHeader from './ChatHeader';
import ChatMessageList from './ChatMessageList';
import ChatInputArea from './ChatInputArea';
import { useSwipeToReply } from '../hooks/useSwipeToReply';
import { useDiscreetNotifications } from '../hooks/useDiscreetNotifications';
import { useKeyboardAvoiding } from '../hooks/useKeyboardAvoiding';
import { usePreventSelection } from '../hooks/usePreventSelection';
import { useTabVisibilityBlur } from '../hooks/useTabVisibilityBlur';

const Chat = ({ isOpen, onClose, currentUser, partnerName, partnerAvatar, partnerAvatarEmoji }) => {
  // State
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [typingPartner, setTypingPartner] = useState(false);
  const [isPartnerOnline, setIsPartnerOnline] = useState(false);
  const [partnerLastSeen, setPartnerLastSeen] = useState(null);
  const [partnerMood, setPartnerMood] = useState(null);
  const [myMood, setMyMood] = useState(null);
  const [showMoodPicker, setShowMoodPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Pagination / lazy loading
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const messagesContainerRef = useRef(null);
  const initialLoadDone = useRef(false);
  const chatRoom = 'privateChats/secret_blossom_chat';

  // Custom hooks
  const { activeReply, clearReply, attachSwipe } = useSwipeToReply();
  const { requestPermission, showDiscreetNotification } = useDiscreetNotifications(currentUser, isOpen);
  const keyboardStyle = useKeyboardAvoiding(isOpen, 0);
  usePreventSelection(isOpen);
  const tabHidden = useTabVisibilityBlur(isOpen);

  // Toast helper
  const showToast = (msg) => {
    const toastEl = document.getElementById('toast');
    if (toastEl) {
      toastEl.textContent = msg;
      toastEl.classList.add('show');
      setTimeout(() => toastEl.classList.remove('show'), 2800);
    }
  };

  // Firebase references
  const messagesRef = ref(db, `${chatRoom}/messages`);
  const typingRef = ref(db, `${chatRoom}/typing`);
  const presenceRef = ref(db, `${chatRoom}/presence`);
  const moodRef = ref(db, `${chatRoom}/moods`);

  // Load messages (initial or older)
  const loadMessages = async (lastKey = null) => {
    if (loadingOlder) return;
    setLoadingOlder(true);
    try {
      let query = orderByKey(messagesRef);
      if (lastKey) {
        query = endBefore(query, lastKey);
      }
      query = limitToLast(query, 20);
      const snapshot = await get(query);
      const newMessages = [];
      snapshot.forEach(child => {
        newMessages.push({ id: child.key, ...child.val() });
      });
      // Reverse to oldest first
      newMessages.reverse();
      if (newMessages.length < 20) setHasMore(false);
      
      setMessages(prev => {
        const all = [...newMessages, ...prev];
        const unique = [];
        const ids = new Set();
        for (const msg of all) {
          if (!ids.has(msg.id)) {
            ids.add(msg.id);
            unique.push(msg);
          }
        }
        return unique;
      });
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setLoadingOlder(false);
    }
  };

  // Initial load (only once when chat opens)
  useEffect(() => {
    if (!isOpen || !currentUser || initialLoadDone.current) return;
    initialLoadDone.current = true;
    loadMessages();
  }, [isOpen, currentUser]);

  // Real‑time new messages listener (appends at the end)
  useEffect(() => {
    if (!isOpen || !currentUser) return;
    const unsubscribe = onChildAdded(messagesRef, (snap) => {
      const msg = { id: snap.key, ...snap.val() };
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      showDiscreetNotification(msg);
      if (msg.role !== currentUser.role) markAsRead(msg.id);
    });
    return () => unsubscribe();
  }, [isOpen, currentUser]);

  // Message updates (reactions, readBy, etc.)
  useEffect(() => {
    if (!isOpen || !currentUser) return;
    const unsubscribe = onChildChanged(messagesRef, (snap) => {
      const updatedMsg = { id: snap.key, ...snap.val() };
      setMessages(prev => prev.map(msg => msg.id === updatedMsg.id ? updatedMsg : msg));
    });
    return () => unsubscribe();
  }, [isOpen, currentUser]);

  // Typing indicator
  useEffect(() => {
    if (!isOpen || !currentUser) return;
    const unsubscribe = onValue(typingRef, (snap) => {
      const data = snap.val() || {};
      const partnerTyping = Object.entries(data).some(
        ([role, ts]) => role !== currentUser.role && (Date.now() - ts < 5000)
      );
      setTypingPartner(partnerTyping);
    });
    return () => unsubscribe();
  }, [isOpen, currentUser]);

  // Presence (online / last seen)
  useEffect(() => {
    if (!isOpen || !currentUser) return;
    const unsubscribe = onValue(presenceRef, (snap) => {
      const data = snap.val() || {};
      const partnerRole = currentUser.role === 'her' ? 'him' : 'her';
      const partner = data[partnerRole] || {};
      setIsPartnerOnline(partner.online === true);
      setPartnerLastSeen(partner.lastSeen);
    });
    return () => unsubscribe();
  }, [isOpen, currentUser]);

  // Moods
  useEffect(() => {
    if (!isOpen || !currentUser) return;
    const unsubscribe = onValue(moodRef, (snap) => {
      const data = snap.val() || {};
      const partnerRole = currentUser.role === 'her' ? 'him' : 'her';
      setPartnerMood(data[partnerRole] || null);
      if (data[currentUser.role]) setMyMood(data[currentUser.role]);
    });
    return () => unsubscribe();
  }, [isOpen, currentUser]);

  // Set current user online
  useEffect(() => {
    if (!isOpen || !currentUser) return;
    const onlineRef = ref(db, `${chatRoom}/presence/${currentUser.role}/online`);
    const lastSeenRef = ref(db, `${chatRoom}/presence/${currentUser.role}/lastSeen`);
    set(onlineRef, true);
    onDisconnect(onlineRef).remove();
    onDisconnect(lastSeenRef).set(Date.now());
    return () => {
      set(onlineRef, null);
      set(lastSeenRef, Date.now());
    };
  }, [isOpen, currentUser]);

  // Scroll to top detection -> load older messages
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      if (container.scrollTop === 0 && hasMore && !loadingOlder && messages.length > 0) {
        const oldestId = messages[0]?.id;
        if (oldestId) loadMessages(oldestId);
      }
    };
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [messages, hasMore, loadingOlder]);

  // Lock body scroll when chat open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, [isOpen]);

  // Request notification permission on user interaction
  useEffect(() => {
    const handleInteraction = () => {
      requestPermission();
      document.removeEventListener('click', handleInteraction);
    };
    document.addEventListener('click', handleInteraction);
    return () => document.removeEventListener('click', handleInteraction);
  }, []);

  const markAsRead = (messageId) => {
    const readRef = ref(db, `${chatRoom}/messages/${messageId}/readBy/${currentUser.role}`);
    set(readRef, Date.now());
  };

  const sendMessage = async () => {
    if (!inputText.trim()) return;
    const msg = {
      text: inputText.trim(),
      role: currentUser.role,
      displayName: currentUser.displayName,
      ts: Date.now(),
    };
    if (activeReply) {
      msg.replyTo = { text: activeReply.text, sender: activeReply.sender };
      clearReply();
    }
    await push(messagesRef, msg);
    setInputText('');
    set(typingRef, null);
  };

  const handleTyping = () => {
    set(typingRef, { [currentUser.role]: Date.now() });
  };

  const setUserMood = (moodKey) => {
    setMyMood(moodKey);
    const moodUserRef = ref(db, `${chatRoom}/moods/${currentUser.role}`);
    set(moodUserRef, moodKey);
    setShowMoodPicker(false);
  };

  const addReaction = async (messageId, emoji) => {
    if (!currentUser || !messageId) return;
    const reactionRef = ref(db, `${chatRoom}/messages/${messageId}/reactions/${currentUser.role}`);
    try {
      if (emoji === null) {
        await set(reactionRef, null);
      } else {
        await set(reactionRef, emoji);
      }
      console.log('Reaction saved:', messageId, emoji);
    } catch (error) {
      console.error('Failed to save reaction:', error);
    }
  };

  // Warn when tab hidden
  useEffect(() => {
    if (!isOpen) return;
    const handleVisibilityChange = () => {
      if (document.hidden) showToast('🔒 Chat hidden – content protected');
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isOpen]);

  const availableMoods = [
    { emoji: '😊', label: 'Happy', key: 'happy' },
    { emoji: '😌', label: 'Calm', key: 'calm' },
    { emoji: '🥰', label: 'Loved', key: 'loved' },
    { emoji: '🤩', label: 'Excited', key: 'excited' },
    { emoji: '😢', label: 'Sad', key: 'sad' },
    { emoji: '🫦', label: 'Horny', key: 'horny' },
    { emoji: '😴', label: 'Tired', key: 'tired' },
    { emoji: '😤', label: 'Angry', key: 'angry' },
  ];

  if (!isOpen) return null;

  return (
    <div
      style={keyboardStyle}
      className="fixed z-50 bg-[#13100e] flex flex-col will-change-transform transition-transform duration-300 ease-out translate-y-0"
    >
      {tabHidden && (
        <div className="absolute inset-0 bg-black z-[60] flex items-center justify-center">
          <div className="text-center text-white/70 text-sm px-4">
            <span className="text-3xl block mb-2">🔒</span>
            Content hidden when you're away
          </div>
        </div>
      )}

      <ChatHeader
        partnerName={partnerName}
        partnerAvatar={partnerAvatar}
        partnerAvatarEmoji={partnerAvatarEmoji}
        isPartnerOnline={isPartnerOnline}
        partnerLastSeen={partnerLastSeen}
        partnerMood={partnerMood}
        myMood={myMood}
        availableMoods={availableMoods}
        showMoodPicker={showMoodPicker}
        setShowMoodPicker={setShowMoodPicker}
        onSetMood={setUserMood}
        onClose={onClose}
        onSearch={setSearchQuery}
      />
      <ChatMessageList
        messages={messages}
        currentUser={currentUser}
        typingPartner={typingPartner}
        attachSwipe={attachSwipe}
        onAddReaction={addReaction}
        showToast={showToast}
        partnerName={partnerName}
        searchQuery={searchQuery}
        containerRef={messagesContainerRef}
        loadingOlder={loadingOlder}
      />
      <ChatInputArea
        inputText={inputText}
        setInputText={setInputText}
        onSend={sendMessage}
        onTyping={handleTyping}
        activeReply={activeReply}
        clearReply={clearReply}
      />
    </div>
  );
};

export default Chat;