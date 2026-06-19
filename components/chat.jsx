// src/components/Chat.jsx
import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
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
import { useHeartbeat } from '../hooks/useHeartbeat'; // NEW
import './chat.css';

const CHAT_ROOM = 'privateChats/secret_blossom_chat';
const PAGE_SIZE = 20;
const TYPING_THROTTLE_MS = 3000;

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
  // NEW: token balance state
  const [tokenBalance, setTokenBalance]       = useState(null);

  // DOM refs
  const messagesContainerRef = useRef(null);
  const bottomSentinelRef    = useRef(null);

  // Logic refs — never cause re-renders
  const initialLoadDone      = useRef(false);
  const lastLoadedKeyRef     = useRef(null);   // newest Firebase key loaded so far
  const oldestLoadedKeyRef   = useRef(null);   // oldest Firebase key loaded so far
  const isInitialLoad        = useRef(true);
  const prevScrollHeightRef  = useRef(0);
  const heartbeatIntervalRef = useRef(null);
  const lastTypingWriteRef   = useRef(0);
  const lastActiveWriteRef   = useRef(0);
  
  // Ref-mirrors of state so the scroll handler never closes over stale values
  const loadingOlderRef      = useRef(false);
  const hasMoreRef           = useRef(true);
  
  // Guard flags to balance historical pagination against real-time additions
  const realtimeListenerRef  = useRef(false);

  // ── Memoised Firebase refs ────────────────────────────────────────
  const messagesRef = useMemo(() => ref(db, `${CHAT_ROOM}/messages`), []);
  const typingRef   = useMemo(() => ref(db, `${CHAT_ROOM}/typing`),   []);
  const presenceRef = useMemo(() => ref(db, `${CHAT_ROOM}/presence`), []);
  const moodRef     = useMemo(() => ref(db, `${CHAT_ROOM}/moods`),    []);
  // NEW: token budget ref
  const budgetRef   = useMemo(() => ref(db, `${CHAT_ROOM}/tokenBudget`), []);

  // Custom hooks
  const { activeReply, clearReply, attachSwipe, setActiveReply } = useSwipeToReply();
  const { requestPermission, showDiscreetNotification }          = useDiscreetNotifications(currentUser, isOpen);
  const keyboardStyle = useKeyboardAvoiding(isOpen, 0);
  usePreventSelection(isOpen);
  const tabHidden = useTabVisibilityBlur(isOpen);

  // NEW: heartbeat hook – sends heartbeats every 30s when active
  useHeartbeat(isOpen, currentUser);

  // ── Helpers ───────────────────────────────────────────────────────
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

  const updateLastActive = useCallback(async () => {
    if (!isOpen || !currentUser) return;
    const now = Date.now();
    if (now - lastActiveWriteRef.current < 25000) return;
    lastActiveWriteRef.current = now;
    try {
      await set(ref(db, `${CHAT_ROOM}/presence/${currentUser.role}/lastActive`), now);
    } catch (e) { console.error('lastActive write failed:', e); }
  }, [isOpen, currentUser]);

  const forceUpdateLastActive = useCallback(async () => {
    if (!isOpen || !currentUser) return;
    lastActiveWriteRef.current = Date.now();
    try {
      await set(ref(db, `${CHAT_ROOM}/presence/${currentUser.role}/lastActive`), Date.now());
    } catch (e) { console.error('heartbeat write failed:', e); }
  }, [isOpen, currentUser]);

  const batchMarkAsRead = useCallback(async (msgs) => {
    if (!currentUser) return;
    const unread = msgs.filter(m => m.role !== currentUser.role && !m.readBy?.[currentUser.role]);
    await Promise.all(
      unread.map(m =>
        set(ref(db, `${CHAT_ROOM}/messages/${m.id}/readBy/${currentUser.role}`), Date.now())
      )
    );
  }, [currentUser]);

  // ── NEW: Send message via Netlify Function ──────────────────────
  const sendMessage = useCallback(async (msgData = {}) => {
    const { text, imageUrl, videoUrl } = msgData;
    if (!text?.trim() && !imageUrl && !videoUrl) return;
    updateLastActive();

    const payload = {
      text: text?.trim() || '',
      imageUrl: imageUrl || '',
      videoUrl: videoUrl || '',
      role: currentUser.role,
      displayName: currentUser.displayName,
    };

    try {
      const response = await fetch('/.netlify/functions/sendMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        if (data.code === 'insufficient-tokens') {
          showToast(`⚠️ Not enough tokens! Balance: ${data.balance}`);
        } else {
          showToast('❌ Failed to send message: ' + (data.error || 'Unknown error'));
        }
        return;
      }

      // On success, the message will appear via real-time listener
      setInputText('');
      set(typingRef, null);
      // Update local balance if returned
      if (data.newBalance !== undefined) {
        setTokenBalance(data.newBalance);
      }
    } catch (err) {
      console.error('sendMessage error:', err);
      showToast('❌ Network error – please try again');
    }
  }, [currentUser, updateLastActive, typingRef, showToast]);

  // ── NEW: Record app open ──────────────────────────────────────────
  useEffect(() => {
    if (!isOpen || !currentUser) return;
    fetch('/.netlify/functions/recordOpen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: currentUser.role }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.balance !== undefined) setTokenBalance(data.balance);
        if (!data.success && data.error) {
          showToast('⚠️ ' + data.error);
        }
      })
      .catch(console.warn);
  }, [isOpen, currentUser, showToast]);

  // ── NEW: Subscribe to token balance ──────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const unsub = onValue(budgetRef, (snap) => {
      const data = snap.val() || {};
      setTokenBalance(data.balance ?? null);
    });
    return () => unsub();
  }, [isOpen, budgetRef]);

  // ── Load messages ─────────────────────────────────────────────────
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

      // If we got back fewer elements than the requested page size, 
      // we have truly hit the absolute beginning of history.
      if (loaded.length < PAGE_SIZE) {
        hasMoreRef.current = false;
        setHasMore(false);
      }

      if (loaded.length > 0) {
        // Set oldest key to the first item of the chunk loaded
        oldestLoadedKeyRef.current = loaded[0].id;
        
        // Only set the newest key boundary on the very first initial load
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

      batchMarkAsRead(loaded);

    } catch (e) {
      console.error('[loadMessages] Firebase error:', e);
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  }, [messagesRef, batchMarkAsRead]);

  // ── Initial load triggering ───────────────────────────────────────
  useEffect(() => {
    if (!isOpen || !currentUser || initialLoadDone.current) return;
    initialLoadDone.current = true;
    loadMessages();
  }, [isOpen, currentUser, loadMessages]);

  // ── Real-time new messages stream ─────────────────────────────────
  // IMPORTANT: messages.length MUST stay in the dep array.
  // The initial load is async — when this effect first runs, lastLoadedKeyRef
  // is still null so the guard below bails out. Adding messages.length means
  // the effect re-evaluates once loadMessages() finishes and populates
  // lastLoadedKeyRef, giving it a second chance to register the listener.
  // The realtimeListenerRef guard ensures it only ever registers once.
  useEffect(() => {
    if (!isOpen || !currentUser)           return;
    if (realtimeListenerRef.current)       return; // already registered — skip
    if (lastLoadedKeyRef.current === null) return; // initial load not done yet — wait

    realtimeListenerRef.current = true;

    // Empty chat: listen from the beginning. Non-empty: listen after last seen key.
    const q = lastLoadedKeyRef.current === ''
      ? query(messagesRef, orderByKey())
      : query(messagesRef, orderByKey(), startAfter(lastLoadedKeyRef.current));

    const unsub = onChildAdded(q, (snap) => {
      const msg = { id: snap.key, ...snap.val() };

      // Advance the high-water mark so pagination endBefore never overlaps
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

    return () => {
      unsub();
      realtimeListenerRef.current = false;
    };
  // messages.length is the trigger that fires this effect after the initial
  // async load sets lastLoadedKeyRef — do not remove it from deps.
  }, [isOpen, currentUser, messages.length, messagesRef, showDiscreetNotification]);

  // ── Message structural updates (Reactions, receipts) ─────────────
  useEffect(() => {
    if (!isOpen || !currentUser) return;
    const unsub = onChildChanged(messagesRef, (snap) => {
      const updated = { id: snap.key, ...snap.val() };
      setMessages(prev => prev.map(m => m.id === updated.id ? updated : m));
    });
    return () => unsub();
  }, [isOpen, currentUser, messagesRef]);

  // ── Typing indicator stream ───────────────────────────────────────
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

  // ── Presence Heartbeats ───────────────────────────────────────────
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

  // ── Partner Presence ──────────────────────────────────────────────
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

  // ── Mood handling ─────────────────────────────────────────────────
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

  // ── Layout Adjustments & Scroll Anchor Restorations ───────────────
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

  // ── Native Container Scroll Handling Listener ─────────────────────
  useEffect(() => {
    if (!isOpen || !currentUser) return;

    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const atTop        = container.scrollTop <= 60; // Slightly larger threshold buffer
      const canLoadMore  = hasMoreRef.current;
      const notLoading   = !loadingOlderRef.current;
      const hasOldestKey = oldestLoadedKeyRef.current !== null && oldestLoadedKeyRef.current !== undefined;

      if (atTop && canLoadMore && notLoading && hasOldestKey) {
        loadMessages(oldestLoadedKeyRef.current);
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [isOpen, currentUser, loadMessages]);

  // ── Body Scroll Locking Viewport Controls ─────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.cssText = 'overflow:hidden;position:fixed;width:100%';
    return () => { document.body.style.cssText = ''; };
  }, [isOpen]);

  // ── Interaction Registration Permissions ─────────────────────────
  useEffect(() => {
    const handle = () => { requestPermission(); document.removeEventListener('click', handle); };
    document.addEventListener('click', handle);
    return () => document.removeEventListener('click', handle);
  }, [requestPermission]);

  // ── Tab Hide/Blur Interceptors ────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const handle = () => { if (document.hidden) showToast('🔒 Chat hidden – content protected'); };
    document.addEventListener('visibilitychange', handle);
    return () => document.removeEventListener('visibilitychange', handle);
  }, [isOpen, showToast]);

  // ── Mutation: Typing Handlers ─────────────────────────────────────
  const handleTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingWriteRef.current < TYPING_THROTTLE_MS) return;
    lastTypingWriteRef.current = now;
    set(typingRef, { [currentUser.role]: now });
    updateLastActive();
  }, [currentUser, typingRef, updateLastActive]);

  // ── Mutation: Mood state writes ──────────────────────────────────
  const setUserMood = useCallback((moodKey) => {
    setMyMood(moodKey);
    set(ref(db, `${CHAT_ROOM}/moods/${currentUser.role}`), moodKey);
    setShowMoodPicker(false);
  }, [currentUser]);

  // ── Mutation: Write message reactions ─────────────────────────────
  const addReaction = useCallback(async (messageId, emoji) => {
    if (!currentUser || !messageId) return;
    try {
      await set(
        ref(db, `${CHAT_ROOM}/messages/${messageId}/reactions/${currentUser.role}`),
        emoji ?? null
      );
      updateLastActive();
    } catch (e) { console.error('reaction failed:', e); }
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
        tokenBalance={tokenBalance}  // NEW: pass token balance to header
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
        currentUser={currentUser}  // keep as is
        chatRoom={CHAT_ROOM}       // keep as is
      />
    </div>
  );
};

export default Chat;