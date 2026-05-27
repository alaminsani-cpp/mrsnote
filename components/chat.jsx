// src/components/Chat.jsx (modified)
import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  db, ref, push, onChildAdded, onChildChanged, set, onValue, onDisconnect,
  orderByKey, limitToLast, endBefore, startAfter, query, get, serverTimestamp
} from '../src/firebase';
import ChatHeader from './ChatHeader';
import ChatMessageList from './ChatMessageList';
import ChatInputArea from './ChatInputArea';
import { useSwipeToReply } from '../hooks/useSwipeToReply';
import { useDiscreetNotifications } from '../hooks/useDiscreetNotifications';
import { useKeyboardAvoiding } from '../hooks/useKeyboardAvoiding';
import { usePreventSelection } from '../hooks/usePreventSelection';
import { useTabVisibilityBlur } from '../hooks/useTabVisibilityBlur';
import './chat.css';

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
  const lastLoadedKeyRef = useRef(null);
  const isInitialLoad = useRef(true);
  const prevScrollHeightRef = useRef(0);
  const chatRoom = 'privateChats/secret_blossom_chat';

  // Heartbeat interval ref
  const heartbeatIntervalRef = useRef(null);
  const lastActiveRef = useRef(Date.now());

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

  // ------------------------------------------------------------------
  // Update lastActive timestamp (used for online/offline)
  // ------------------------------------------------------------------
  const updateLastActive = useCallback(async () => {
    if (!isOpen || !currentUser) return;
    const now = Date.now();
    lastActiveRef.current = now;
    const lastActiveRefDb = ref(db, `${chatRoom}/presence/${currentUser.role}/lastActive`);
    try {
      await set(lastActiveRefDb, now);
    } catch (error) {
      console.error('Failed to update lastActive:', error);
    }
  }, [isOpen, currentUser, chatRoom]);

  // ------------------------------------------------------------------
  // Helper: mark a single message as read
  // ------------------------------------------------------------------
  const markMessageAsReadIfNeeded = async (messageId, messageRole) => {
    if (!currentUser || messageRole === currentUser.role) return;
    const readRef = ref(db, `${chatRoom}/messages/${messageId}/readBy/${currentUser.role}`);
    try {
      const snapshot = await get(readRef);
      if (!snapshot.exists()) {
        await set(readRef, Date.now());
      }
    } catch (error) {
      console.error('Failed to mark message as read:', error);
    }
  };

  // ------------------------------------------------------------------
  // Load messages (initial or older)
  // ------------------------------------------------------------------
  const loadMessages = async (lastKey = null) => {
    if (loadingOlder) return;
    setLoadingOlder(true);
    try {
      const constraints = [orderByKey()];
      if (lastKey) constraints.push(endBefore(lastKey));
      constraints.push(limitToLast(20));
      const q = query(messagesRef, ...constraints);
      const snapshot = await get(q);
      const newMessages = [];
      snapshot.forEach(child => {
        newMessages.push({ id: child.key, ...child.val() });
      });
      if (newMessages.length < 20) setHasMore(false);

      setMessages(prev => {
        const all = lastKey ? [...newMessages, ...prev] : [...prev, ...newMessages];
        const unique = [];
        const ids = new Set();
        for (const msg of all) {
          if (!ids.has(msg.id)) {
            ids.add(msg.id);
            unique.push(msg);
          }
        }
        unique.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
        return unique;
      });

      for (const msg of newMessages) {
        await markMessageAsReadIfNeeded(msg.id, msg.role);
      }

      if (!lastKey) {
        lastLoadedKeyRef.current = newMessages.length > 0 ? newMessages[newMessages.length - 1].id : '';
        isInitialLoad.current = true;
      } else {
        prevScrollHeightRef.current = messagesContainerRef.current?.scrollHeight || 0;
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setLoadingOlder(false);
    }
  };

  // Initial load
  useEffect(() => {
    if (!isOpen || !currentUser || initialLoadDone.current) return;
    initialLoadDone.current = true;
    loadMessages();
  }, [isOpen, currentUser]);

  // Real-time NEW messages listener
  useEffect(() => {
    if (!isOpen || !currentUser) return;
    if (lastLoadedKeyRef.current === null) return;

    const newMsgsQuery = lastLoadedKeyRef.current === ''
      ? query(messagesRef, orderByKey())
      : query(messagesRef, orderByKey(), startAfter(lastLoadedKeyRef.current));

    const unsubscribe = onChildAdded(newMsgsQuery, async (snap) => {
      const msg = { id: snap.key, ...snap.val() };
      lastLoadedKeyRef.current = snap.key;
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      await markMessageAsReadIfNeeded(msg.id, msg.role);
      showDiscreetNotification(msg);
    });
    return () => unsubscribe();
  }, [isOpen, currentUser, lastLoadedKeyRef.current]);

  // Message updates (reactions, read status)
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

  // ------------------------------------------------------------------
  // FIXED PRESENCE: lastActive heartbeat + online inference
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!isOpen || !currentUser) return;

    // 1. Write initial lastActive
    updateLastActive();

    // 2. Set up heartbeat interval (every 30 seconds)
    heartbeatIntervalRef.current = setInterval(() => {
      updateLastActive();
    }, 30000);

    // 3. On disconnect: write final lastActive timestamp
    const finalActiveRef = ref(db, `${chatRoom}/presence/${currentUser.role}/lastActive`);
    onDisconnect(finalActiveRef).set(Date.now());

    // 4. Cleanup on unmount or chat close
    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      // Write final lastActive immediately
      const finalRef = ref(db, `${chatRoom}/presence/${currentUser.role}/lastActive`);
      set(finalRef, Date.now()).catch(console.error);
    };
  }, [isOpen, currentUser, chatRoom, updateLastActive]);

  // Listen to partner presence (compute online from lastActive)
  useEffect(() => {
    if (!isOpen || !currentUser) return;
    const unsubscribe = onValue(presenceRef, (snap) => {
      const data = snap.val() || {};
      const partnerRole = currentUser.role === 'her' ? 'him' : 'her';
      const partner = data[partnerRole] || {};
      const lastActive = partner.lastActive;
      if (lastActive && typeof lastActive === 'number') {
        const now = Date.now();
        const isOnline = (now - lastActive) < 60000; // within last 60 seconds = online
        setIsPartnerOnline(isOnline);
        setPartnerLastSeen(lastActive);
      } else {
        setIsPartnerOnline(false);
        setPartnerLastSeen(null);
      }
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

  // Scroll behaviour
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container || messages.length === 0) return;

    if (isInitialLoad.current) {
      container.scrollTop = container.scrollHeight;
      isInitialLoad.current = false;
    } else if (prevScrollHeightRef.current > 0) {
      const newScrollHeight = container.scrollHeight;
      container.scrollTop = newScrollHeight - prevScrollHeightRef.current;
      prevScrollHeightRef.current = 0;
    } else {
      const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      if (distanceFromBottom < 150) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [messages]);

  // Load older on scroll to top
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

  // Lock body scroll
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

  // Request notification permission
  useEffect(() => {
    const handleInteraction = () => {
      requestPermission();
      document.removeEventListener('click', handleInteraction);
    };
    document.addEventListener('click', handleInteraction);
    return () => document.removeEventListener('click', handleInteraction);
  }, [requestPermission]);

  // Send message – also update lastActive
  const sendMessage = async (msgData = {}) => {
    const { text, imageUrl } = msgData;
    if (!text?.trim() && !imageUrl) return;
    
    // Update lastActive on message send
    await updateLastActive();

    const message = {
      role: currentUser.role,
      displayName: currentUser.displayName,
      ts: Date.now(),
    };
    if (text?.trim()) message.text = text.trim();
    if (imageUrl) message.imageUrl = imageUrl;
    if (activeReply) {
      message.replyTo = {
        text: activeReply.text,
        sender: activeReply.sender,
        isImage: activeReply.isImage || false,
      };
      clearReply();
    }
    await push(messagesRef, message);
    setInputText('');
    set(typingRef, null);
  };

  const handleTyping = () => {
    set(typingRef, { [currentUser.role]: Date.now() });
    // Also update lastActive on typing (throttled by Firebase, but fine)
    updateLastActive();
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
      // Update lastActive on reaction (activity)
      await updateLastActive();
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
  }, [isOpen, showToast]);

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
      className="chat-root fixed inset-0 z-50 bg-[#080b10] flex flex-col font-sans"
    >
      {tabHidden && (
        <div className="tab-hidden-overlay">
          <div className="tab-hidden-content">
            <span className="tab-hidden-icon">🔒</span>
            Content hidden while you're away
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