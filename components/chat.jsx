// src/components/Chat.jsx
import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import {
  db, ref, push, onChildAdded, onChildChanged, set, onValue, onDisconnect,
  orderByKey, limitToLast, endBefore, startAfter, query, get
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

const CHAT_ROOM = 'privateChats/secret_blossom_chat';
const PAGE_SIZE = 20;
const TYPING_THROTTLE_MS = 3000;
const HEARTBEAT_INTERVAL = 30000; // 30 seconds

const Chat = ({ isOpen, onClose, currentUser, partnerName, partnerAvatar, partnerAvatarEmoji }) => {
  const [messages, setMessages]               = useState([]);
  const [inputText, setInputText]             = useState('');
  const [typingPartner, setTypingPartner]     = useState(false);
  const [isPartnerOnline, setIsPartnerOnline] = useState(false);
  const [partnerLastSeen, setPartnerLastSeen] = useState(null);
  const [partnerMood, setPartnerMood]         = useState(null);
  const [myMood, setMyMood]                   = useState(null);
  const [showMoodPicker, setShowMoodPicker]   = useState(false);
  const [searchQuery, setSearchQuery]         = useState('');
  const [loadingOlder, setLoadingOlder]       = useState(false);
  const [hasMore, setHasMore]                 = useState(true);

  const messagesContainerRef = useRef(null);
  const bottomSentinelRef    = useRef(null);

  const initialLoadDone      = useRef(false);
  const lastLoadedKeyRef     = useRef(null);
  const oldestLoadedKeyRef   = useRef(null);
  const isInitialLoad        = useRef(true);
  const prevScrollHeightRef  = useRef(0);
  const lastTypingWriteRef   = useRef(0);
  
  const loadingOlderRef      = useRef(false);
  const hasMoreRef           = useRef(true);
  const realtimeListenerRef  = useRef(false);
  const heartbeatIntervalRef = useRef(null);

  const messagesRef = useMemo(() => ref(db, `${CHAT_ROOM}/messages`), []);
  const typingRef   = useMemo(() => ref(db, `${CHAT_ROOM}/typing`),   []);
  const presenceRef = useMemo(() => ref(db, `${CHAT_ROOM}/presence`), []);
  const moodRef     = useMemo(() => ref(db, `${CHAT_ROOM}/moods`),    []);

  const { activeReply, clearReply, attachSwipe, setActiveReply } = useSwipeToReply();
  const { requestPermission, showDiscreetNotification }          = useDiscreetNotifications(currentUser, isOpen);
  const keyboardStyle = useKeyboardAvoiding(isOpen, 0);
  usePreventSelection(isOpen);
  const tabHidden = useTabVisibilityBlur(isOpen);

  const showToast = useCallback((msg) => {
    const toastEl = document.getElementById('toast');
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    setTimeout(() => toastEl.classList.remove('show'), 2800);
  }, []);

  const scrollToBottom = useCallback((smooth = false) => {
    bottomSentinelRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  // ── sendMessage: accepts replyTo ──
  const sendMessage = useCallback(async (msgData = {}) => {
    const { text, imageUrl, videoUrl, replyTo } = msgData;
    if (!text?.trim() && !imageUrl && !videoUrl) return;

    const message = {
      role: currentUser.role,
      displayName: currentUser.displayName,
      ts: Date.now(),
    };
    if (text?.trim()) message.text = text.trim();
    if (imageUrl) message.imageUrl = imageUrl;
    if (videoUrl) message.videoUrl = videoUrl;
    
    if (replyTo) {
      message.replyTo = {
        text: replyTo.text || '',
        sender: replyTo.sender || '',
        messageId: replyTo.messageId,
        isImage: replyTo.isImage || false,
        isVideo: replyTo.isVideo || false,
      };
    }

    try {
      await push(messagesRef, message);
      setInputText('');
      await set(typingRef, null);
    } catch (err) {
      console.error('sendMessage error:', err);
      showToast('❌ Failed to send message');
    }
  }, [currentUser, messagesRef, typingRef, showToast]);

  // ── Load messages ──
  const loadMessages = useCallback(async (lastKey = null) => {
    if (loadingOlderRef.current) return;
    if (lastKey && !hasMoreRef.current) return;

    loadingOlderRef.current = true;
    setLoadingOlder(true);

    if (lastKey) {
      prevScrollHeightRef.current = messagesContainerRef.current?.scrollHeight ?? 0;
    }

    try {
      const constraints = [orderByKey()];
      if (lastKey) constraints.push(endBefore(lastKey));
      constraints.push(limitToLast(PAGE_SIZE));

      const snapshot = await get(query(messagesRef, ...constraints));
      const loaded   = [];
      snapshot.forEach(child => {
        loaded.push({ id: child.key, ...child.val() });
      });

      if (loaded.length < PAGE_SIZE) {
        hasMoreRef.current = false;
        setHasMore(false);
      }

      if (loaded.length > 0) {
        oldestLoadedKeyRef.current = loaded[0].id;
        if (!lastKey) {
          lastLoadedKeyRef.current = loaded[loaded.length - 1].id;
          isInitialLoad.current = true;
        }
      }

      setMessages(prev => {
        const merged = lastKey ? [...loaded, ...prev] : [...prev, ...loaded];
        const seen   = new Set();
        return merged
          .filter(m => seen.has(m.id) ? false : (seen.add(m.id), true))
          .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
      });

      if (!lastKey) {
        const unread = loaded.filter(m => m.role !== currentUser.role && !m.readBy?.[currentUser.role]);
        await Promise.all(
          unread.map(m =>
            set(ref(db, `${CHAT_ROOM}/messages/${m.id}/readBy/${currentUser.role}`), Date.now())
          )
        );
      }
    } catch (e) {
      console.error('[loadMessages] Firebase error:', e);
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  }, [messagesRef, currentUser]);

  // ── Initial load ──
  useEffect(() => {
    if (!isOpen || !currentUser || initialLoadDone.current) return;
    initialLoadDone.current = true;
    loadMessages();
  }, [isOpen, currentUser, loadMessages]);

  // ── Real‑time new messages ──
  useEffect(() => {
    if (!isOpen || !currentUser) return;
    if (realtimeListenerRef.current) return;
    if (lastLoadedKeyRef.current === null) return;

    realtimeListenerRef.current = true;
    const q = lastLoadedKeyRef.current === ''
      ? query(messagesRef, orderByKey())
      : query(messagesRef, orderByKey(), startAfter(lastLoadedKeyRef.current));

    const unsub = onChildAdded(q, (snap) => {
      const msg = { id: snap.key, ...snap.val() };
      lastLoadedKeyRef.current = snap.key;
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev;
        if (!oldestLoadedKeyRef.current) oldestLoadedKeyRef.current = msg.id;
        return [...prev, msg];
      });
      if (msg.role !== currentUser.role) {
        set(ref(db, `${CHAT_ROOM}/messages/${msg.id}/readBy/${currentUser.role}`), Date.now())
          .catch(console.error);
      }
      showDiscreetNotification(msg);
    });
    return () => { unsub(); realtimeListenerRef.current = false; };
  }, [isOpen, currentUser, messages.length, messagesRef, showDiscreetNotification]);

  // ── Message updates (reactions, receipts) ──
  useEffect(() => {
    if (!isOpen || !currentUser) return;
    const unsub = onChildChanged(messagesRef, (snap) => {
      const updated = { id: snap.key, ...snap.val() };
      setMessages(prev => prev.map(m => m.id === updated.id ? updated : m));
    });
    return () => unsub();
  }, [isOpen, currentUser, messagesRef]);

  // ── Typing indicator ──
  useEffect(() => {
    if (!isOpen || !currentUser) return;
    const unsub = onValue(typingRef, (snap) => {
      const data = snap.val() || {};
      setTypingPartner(
        Object.entries(data).some(([role, ts]) => role !== currentUser.role && Date.now() - ts < 5000)
      );
    });
    return () => unsub();
  }, [isOpen, currentUser, typingRef]);

  // ── Presence + Heartbeat (FIX: last seen now updates every 30s) ──
  useEffect(() => {
    if (!isOpen || !currentUser) return;

    const presenceUserRef = ref(db, `${CHAT_ROOM}/presence/${currentUser.role}`);

    // 1. Write initial presence
    set(presenceUserRef, { lastActive: Date.now() });

    // 2. On disconnect, write offline timestamp
    const disconnectRef = onDisconnect(presenceUserRef);
    disconnectRef.set({ lastActive: Date.now() });

    // 3. Heartbeat – update every 30s while tab is visible
    heartbeatIntervalRef.current = setInterval(() => {
      if (!document.hidden) {
        set(presenceUserRef, { lastActive: Date.now() }).catch(console.error);
      }
    }, HEARTBEAT_INTERVAL);

    // 4. Cleanup
    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      set(presenceUserRef, { lastActive: Date.now() }).catch(console.error);
    };
  }, [isOpen, currentUser]);

  // ── Partner presence ──
  useEffect(() => {
    if (!isOpen || !currentUser) return;
    const unsub = onValue(presenceRef, (snap) => {
      const partnerRole = currentUser.role === 'her' ? 'him' : 'her';
      const partner     = (snap.val() || {})[partnerRole] || {};
      const lastActive  = partner.lastActive;
      if (lastActive && typeof lastActive === 'number') {
        setIsPartnerOnline(Date.now() - lastActive < 60000);
        setPartnerLastSeen(lastActive);
      } else {
        setIsPartnerOnline(false);
        setPartnerLastSeen(null);
      }
    });
    return () => unsub();
  }, [isOpen, currentUser, presenceRef]);

  // ── Mood ──
  useEffect(() => {
    if (!isOpen || !currentUser) return;
    const unsub = onValue(moodRef, (snap) => {
      const data        = snap.val() || {};
      const partnerRole = currentUser.role === 'her' ? 'him' : 'her';
      setPartnerMood(data[partnerRole] || null);
      if (data[currentUser.role]) setMyMood(data[currentUser.role]);
    });
    return () => unsub();
  }, [isOpen, currentUser, moodRef]);

  // ── Layout ──
  useLayoutEffect(() => {
    if (messages.length === 0) return;
    if (isInitialLoad.current) {
      scrollToBottom(false);
      isInitialLoad.current = false;
    } else if (prevScrollHeightRef.current > 0) {
      const c = messagesContainerRef.current;
      if (c) {
        c.scrollTop = c.scrollHeight - prevScrollHeightRef.current;
      }
      prevScrollHeightRef.current = 0;
    } else {
      const c = messagesContainerRef.current;
      if (c) {
        const distFromBottom = c.scrollHeight - c.scrollTop - c.clientHeight;
        if (distFromBottom < 150) scrollToBottom(true);
      }
    }
  }, [messages, scrollToBottom]);

  // ── Scroll to load older ──
  useEffect(() => {
    if (!isOpen || !currentUser) return;
    const container = messagesContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const atTop        = container.scrollTop <= 60;
      const canLoadMore  = hasMoreRef.current;
      const notLoading   = !loadingOlderRef.current;
      const hasOldestKey = oldestLoadedKeyRef.current !== null;
      if (atTop && canLoadMore && notLoading && hasOldestKey) {
        loadMessages(oldestLoadedKeyRef.current);
      }
    };
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [isOpen, currentUser, loadMessages]);

  // ── Body lock ──
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.cssText = 'overflow:hidden;position:fixed;width:100%';
    return () => { document.body.style.cssText = ''; };
  }, [isOpen]);

  // ── Permission request ──
  useEffect(() => {
    const handle = () => { requestPermission(); document.removeEventListener('click', handle); };
    document.addEventListener('click', handle);
    return () => document.removeEventListener('click', handle);
  }, [requestPermission]);

  // ── Tab hide toast ──
  useEffect(() => {
    if (!isOpen) return;
    const handle = () => { if (document.hidden) showToast('🔒 Chat hidden – content protected'); };
    document.addEventListener('visibilitychange', handle);
    return () => document.removeEventListener('visibilitychange', handle);
  }, [isOpen, showToast]);

  // ── Typing handler ──
  const handleTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingWriteRef.current < TYPING_THROTTLE_MS) return;
    lastTypingWriteRef.current = now;
    set(typingRef, { [currentUser.role]: now });
  }, [currentUser, typingRef]);

  // ── Mood setter ──
  const setUserMood = useCallback((moodKey) => {
    setMyMood(moodKey);
    set(ref(db, `${CHAT_ROOM}/moods/${currentUser.role}`), moodKey);
    setShowMoodPicker(false);
  }, [currentUser]);

  // ── Reaction handler ──
  const addReaction = useCallback(async (messageId, emoji) => {
    if (!currentUser || !messageId) return;
    try {
      await set(
        ref(db, `${CHAT_ROOM}/messages/${messageId}/reactions/${currentUser.role}`),
        emoji ?? null
      );
    } catch (e) { console.error('reaction failed:', e); }
  }, [currentUser]);

  const availableMoods = useMemo(() => [
    { emoji: '😊', label: 'Happy',   key: 'happy'   },
    { emoji: '😌', label: 'Calm',    key: 'calm'    },
    { emoji: '🥰', label: 'Loved',   key: 'loved'   },
    { emoji: '🤩', label: 'Excited', key: 'excited' },
    { emoji: '😢', label: 'Sad',     key: 'sad'     },
    { emoji: '🫦', label: 'Horny',   key: 'horny'   },
    { emoji: '😴', label: 'Tired',   key: 'tired'   },
    { emoji: '😤', label: 'Angry',   key: 'angry'   },
  ], []);

  if (!isOpen) return null;

  return (
    <div style={keyboardStyle} className="chat-root fixed inset-0 z-50 bg-[#080b10] flex flex-col font-sans">
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

      <div ref={messagesContainerRef} className="chat-messages-scroll">
        <ChatMessageList
          messages={messages}
          currentUser={currentUser}
          typingPartner={typingPartner}
          attachSwipe={attachSwipe}
          setReply={setActiveReply}
          onAddReaction={addReaction}
          showToast={showToast}
          partnerName={partnerName}
          searchQuery={searchQuery}
          loadingOlder={loadingOlder}
          bottomSentinelRef={bottomSentinelRef}
        />
      </div>

      <ChatInputArea
        inputText={inputText}
        setInputText={setInputText}
        onSend={sendMessage}
        onTyping={handleTyping}
        activeReply={activeReply}
        clearReply={clearReply}
        currentUser={currentUser}
        chatRoom={CHAT_ROOM}
      />
    </div>
  );
};

export default Chat;