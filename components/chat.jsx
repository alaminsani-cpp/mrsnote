// src/components/Chat.jsx  –  OPTIMIZED
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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

const CHAT_ROOM = 'privateChats/secret_blossom_chat';
const PAGE_SIZE = 20;
// Throttle typing/lastActive writes — one write per this many ms
const TYPING_THROTTLE_MS = 3000;

const Chat = ({ isOpen, onClose, currentUser, partnerName, partnerAvatar, partnerAvatarEmoji }) => {
  const [messages, setMessages]             = useState([]);
  const [inputText, setInputText]           = useState('');
  const [typingPartner, setTypingPartner]   = useState(false);
  const [isPartnerOnline, setIsPartnerOnline] = useState(false);
  const [partnerLastSeen, setPartnerLastSeen] = useState(null);
  const [partnerMood, setPartnerMood]       = useState(null);
  const [myMood, setMyMood]                 = useState(null);
  const [showMoodPicker, setShowMoodPicker] = useState(false);
  const [searchQuery, setSearchQuery]       = useState('');
  const [loadingOlder, setLoadingOlder]     = useState(false);
  const [hasMore, setHasMore]               = useState(true);

  const messagesContainerRef  = useRef(null);
  const initialLoadDone       = useRef(false);
  const lastLoadedKeyRef      = useRef(null);
  const isInitialLoad         = useRef(true);
  const prevScrollHeightRef   = useRef(0);
  const heartbeatIntervalRef  = useRef(null);
  const lastTypingWriteRef    = useRef(0);   // throttle guard
  const lastActiveWriteRef    = useRef(0);   // throttle guard

  // ── Memoised Firebase refs (never recreated) ──────────────────────
  const messagesRef = useMemo(() => ref(db, `${CHAT_ROOM}/messages`), []);
  const typingRef   = useMemo(() => ref(db, `${CHAT_ROOM}/typing`), []);
  const presenceRef = useMemo(() => ref(db, `${CHAT_ROOM}/presence`), []);
  const moodRef     = useMemo(() => ref(db, `${CHAT_ROOM}/moods`), []);

  // Custom hooks
  const { activeReply, clearReply, attachSwipe, setActiveReply } = useSwipeToReply();
  const { requestPermission, showDiscreetNotification }          = useDiscreetNotifications(currentUser, isOpen);
  const keyboardStyle = useKeyboardAvoiding(isOpen, 20);
  usePreventSelection(isOpen);
  const tabHidden = useTabVisibilityBlur(isOpen);

  // ── Toast (stable reference) ───────────────────────────────────────
  const showToast = useCallback((msg) => {
    const toastEl = document.getElementById('toast');
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    setTimeout(() => toastEl.classList.remove('show'), 2800);
  }, []);

  // ── Throttled lastActive write ─────────────────────────────────────
  const updateLastActive = useCallback(async () => {
    if (!isOpen || !currentUser) return;
    const now = Date.now();
    // Only write if >25 s since last write (heartbeat handles the rest)
    if (now - lastActiveWriteRef.current < 25000) return;
    lastActiveWriteRef.current = now;
    try {
      await set(ref(db, `${CHAT_ROOM}/presence/${currentUser.role}/lastActive`), now);
    } catch (e) {
      console.error('lastActive write failed:', e);
    }
  }, [isOpen, currentUser]);

  // ── Force-write (no throttle gate) for heartbeat ──────────────────
  const forceUpdateLastActive = useCallback(async () => {
    if (!isOpen || !currentUser) return;
    const now = Date.now();
    lastActiveWriteRef.current = now;
    try {
      await set(ref(db, `${CHAT_ROOM}/presence/${currentUser.role}/lastActive`), now);
    } catch (e) {
      console.error('heartbeat write failed:', e);
    }
  }, [isOpen, currentUser]);

  // ── Batch mark-as-read (single pass, no sequential gets) ──────────
  const batchMarkAsRead = useCallback(async (msgs) => {
    if (!currentUser) return;
    const unread = msgs.filter(m => m.role !== currentUser.role && !m.readBy?.[currentUser.role]);
    // Fire writes in parallel — no get() check, just overwrite
    await Promise.all(
      unread.map(m =>
        set(ref(db, `${CHAT_ROOM}/messages/${m.id}/readBy/${currentUser.role}`), Date.now())
      )
    );
  }, [currentUser]);

  // ── Load messages (initial or older) ──────────────────────────────
  const loadMessages = useCallback(async (lastKey = null) => {
    if (loadingOlder) return;
    setLoadingOlder(true);
    try {
      const constraints = [orderByKey()];
      if (lastKey) constraints.push(endBefore(lastKey));
      constraints.push(limitToLast(PAGE_SIZE));
      const snapshot = await get(query(messagesRef, ...constraints));

      const newMessages = [];
      snapshot.forEach(child => newMessages.push({ id: child.key, ...child.val() }));
      if (newMessages.length < PAGE_SIZE) setHasMore(false);

      setMessages(prev => {
        const merged = lastKey ? [...newMessages, ...prev] : [...prev, ...newMessages];
        const seen   = new Set();
        return merged
          .filter(m => seen.has(m.id) ? false : (seen.add(m.id), true))
          .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
      });

      // Batch read-receipts (parallel, no sequential gets)
      batchMarkAsRead(newMessages);

      if (!lastKey) {
        lastLoadedKeyRef.current = newMessages.length > 0
          ? newMessages[newMessages.length - 1].id : '';
        isInitialLoad.current = true;
      } else {
        prevScrollHeightRef.current = messagesContainerRef.current?.scrollHeight || 0;
      }
    } catch (e) {
      console.error('loadMessages failed:', e);
    } finally {
      setLoadingOlder(false);
    }
  }, [loadingOlder, messagesRef, batchMarkAsRead]);

  // Initial load
  useEffect(() => {
    if (!isOpen || !currentUser || initialLoadDone.current) return;
    initialLoadDone.current = true;
    loadMessages();
  }, [isOpen, currentUser]); // loadMessages excluded intentionally (stable after mount)

  // Real-time NEW messages listener
  useEffect(() => {
    if (!isOpen || !currentUser || lastLoadedKeyRef.current === null) return;

    const newMsgsQuery = lastLoadedKeyRef.current === ''
      ? query(messagesRef, orderByKey())
      : query(messagesRef, orderByKey(), startAfter(lastLoadedKeyRef.current));

    const unsub = onChildAdded(newMsgsQuery, (snap) => {
      const msg = { id: snap.key, ...snap.val() };
      lastLoadedKeyRef.current = snap.key;
      setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
      // Single write, no get()
      if (msg.role !== currentUser.role) {
        set(ref(db, `${CHAT_ROOM}/messages/${msg.id}/readBy/${currentUser.role}`), Date.now())
          .catch(console.error);
      }
      showDiscreetNotification(msg);
    });
    return () => unsub();
  }, [isOpen, currentUser, lastLoadedKeyRef.current]); // eslint-disable-line

  // Message updates (reactions, read receipts)
  useEffect(() => {
    if (!isOpen || !currentUser) return;
    const unsub = onChildChanged(messagesRef, (snap) => {
      const updated = { id: snap.key, ...snap.val() };
      setMessages(prev => prev.map(m => m.id === updated.id ? updated : m));
    });
    return () => unsub();
  }, [isOpen, currentUser, messagesRef]);

  // Typing indicator
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

  // Presence heartbeat
  useEffect(() => {
    if (!isOpen || !currentUser) return;

    forceUpdateLastActive();
    heartbeatIntervalRef.current = setInterval(forceUpdateLastActive, 30000);

    const finalRef = ref(db, `${CHAT_ROOM}/presence/${currentUser.role}/lastActive`);
    onDisconnect(finalRef).set(Date.now());

    return () => {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
      set(finalRef, Date.now()).catch(console.error);
    };
  }, [isOpen, currentUser, forceUpdateLastActive]);

  // Partner presence
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

  // Moods
  useEffect(() => {
    if (!isOpen || !currentUser) return;
    const unsub = onValue(moodRef, (snap) => {
      const data       = snap.val() || {};
      const partnerRole = currentUser.role === 'her' ? 'him' : 'her';
      setPartnerMood(data[partnerRole] || null);
      if (data[currentUser.role]) setMyMood(data[currentUser.role]);
    });
    return () => unsub();
  }, [isOpen, currentUser, moodRef]);

  // Scroll to bottom / restore position after load
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container || messages.length === 0) return;

    if (isInitialLoad.current) {
      container.scrollTop = container.scrollHeight;
      isInitialLoad.current = false;
    } else if (prevScrollHeightRef.current > 0) {
      container.scrollTop = container.scrollHeight - prevScrollHeightRef.current;
      prevScrollHeightRef.current = 0;
    } else {
      const distFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      if (distFromBottom < 150) container.scrollTop = container.scrollHeight;
    }
  }, [messages]);

  // Load older on scroll to top
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      if (container.scrollTop === 0 && hasMore && !loadingOlder && messages.length > 0) {
        loadMessages(messages[0]?.id);
      }
    };
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [messages, hasMore, loadingOlder, loadMessages]);

  // Lock body scroll
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.cssText = 'overflow:hidden;position:fixed;width:100%';
    return () => { document.body.style.cssText = ''; };
  }, [isOpen]);

  // Notification permission
  useEffect(() => {
    const handle = () => { requestPermission(); document.removeEventListener('click', handle); };
    document.addEventListener('click', handle);
    return () => document.removeEventListener('click', handle);
  }, [requestPermission]);

  // Tab hidden toast
  useEffect(() => {
    if (!isOpen) return;
    const handle = () => { if (document.hidden) showToast('🔒 Chat hidden – content protected'); };
    document.addEventListener('visibilitychange', handle);
    return () => document.removeEventListener('visibilitychange', handle);
  }, [isOpen, showToast]);

  // ── Send message ──────────────────────────────────────────────────
  const sendMessage = useCallback(async (msgData = {}) => {
    const { text, imageUrl } = msgData;
    if (!text?.trim() && !imageUrl) return;

    // Don't await lastActive — non-blocking
    updateLastActive();

    const message = {
      role:        currentUser.role,
      displayName: currentUser.displayName,
      ts:          Date.now(),
    };
    if (text?.trim()) message.text = text.trim();
    if (imageUrl)     message.imageUrl = imageUrl;
    if (activeReply) {
      message.replyTo = {
        text:    activeReply.text,
        sender:  activeReply.sender,
        isImage: activeReply.isImage || false,
      };
      clearReply();
    }

    await push(messagesRef, message);
    setInputText('');
    set(typingRef, null);
  }, [currentUser, activeReply, clearReply, messagesRef, typingRef, updateLastActive]);

  // ── Throttled typing indicator ────────────────────────────────────
  const handleTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingWriteRef.current < TYPING_THROTTLE_MS) return;
    lastTypingWriteRef.current = now;
    set(typingRef, { [currentUser.role]: now });
    // updateLastActive is already throttled internally
    updateLastActive();
  }, [currentUser, typingRef, updateLastActive]);

  // ── Mood ──────────────────────────────────────────────────────────
  const setUserMood = useCallback((moodKey) => {
    setMyMood(moodKey);
    set(ref(db, `${CHAT_ROOM}/moods/${currentUser.role}`), moodKey);
    setShowMoodPicker(false);
  }, [currentUser]);

  // ── Reaction ──────────────────────────────────────────────────────
  const addReaction = useCallback(async (messageId, emoji) => {
    if (!currentUser || !messageId) return;
    try {
      await set(
        ref(db, `${CHAT_ROOM}/messages/${messageId}/reactions/${currentUser.role}`),
        emoji ?? null
      );
      updateLastActive();
    } catch (e) {
      console.error('reaction failed:', e);
    }
  }, [currentUser, updateLastActive]);

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
    <div style={keyboardStyle} className="chat-root z-50 bg-[#080b10] flex flex-col font-sans">      {tabHidden && (
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
        setReply={setActiveReply}
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