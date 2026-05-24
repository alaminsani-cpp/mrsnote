import { useState, useEffect } from 'react';

const Journal = ({ onSecretWordDetected }) => {
  const [note, setNote] = useState('');
  const [wordCount, setWordCount] = useState(0);
  const [activeTab, setActiveTab] = useState('write');
  const [selectedMood, setSelectedMood] = useState(null);
  const [stats, setStats] = useState({
    totalWords: 0,
    days: 1,
    streak: 1,
    todayWords: 0,
  });
  const [streakDots, setStreakDots] = useState([]);

  // Load saved note from localStorage
  useEffect(() => {
    const savedNote = localStorage.getItem('journal_note') || '';
    setNote(savedNote);
    updateWordCount(savedNote);
    loadStats();
    generateStreakDots();
    
    const todayStr = new Date().toDateString();
    const savedMood = localStorage.getItem(`mood_${todayStr}`);
    if (savedMood) setSelectedMood(savedMood);
  }, []);

  const updateWordCount = (text) => {
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    setWordCount(words);
  };

  const loadStats = () => {
    const total = parseInt(localStorage.getItem('total_words') || '0');
    const days = parseInt(localStorage.getItem('journal_days') || '1');
    const streak = parseInt(localStorage.getItem('journal_streak') || '1');
    const today = parseInt(localStorage.getItem('today_words') || '0');
    setStats({ totalWords: total, days, streak, todayWords: today });
  };

  const generateStreakDots = () => {
    const daysLabels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    const todayDate = new Date();
    const dots = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(todayDate);
      d.setDate(todayDate.getDate() - i);
      const hasMood = !!localStorage.getItem(`mood_${d.toDateString()}`);
      dots.push({ label: daysLabels[d.getDay()], active: hasMood });
    }
    setStreakDots(dots);
  };

  const handleNoteChange = (e) => {
    const newNote = e.target.value;
    setNote(newNote);
    updateWordCount(newNote);
    localStorage.setItem('journal_note', newNote);
    
    // Update today's word count and total stats
    const words = newNote.trim().split(/\s+/).filter(Boolean).length;
    const prevToday = parseInt(localStorage.getItem('today_words') || '0');
    const delta = words - prevToday;
    localStorage.setItem('today_words', words);
    const newTotal = Math.max(0, stats.totalWords + delta);
    localStorage.setItem('total_words', newTotal);
    setStats(prev => ({ ...prev, todayWords: words, totalWords: newTotal }));
  };

  const handleKeyDown = (e) => {
    if (e.key !== 'Enter') return;
    const val = note;
    const words = val.split(/\s+/);
    for (const w of words) {
      const lower = w.toLowerCase().replace(/[^a-z]/g, '');
      if (['totapakhi', 'pakhi'].includes(lower)) {
        e.preventDefault();
        // Remove the secret word from the note
        const newNote = val.replace(new RegExp(w, 'i'), '').trim();
        setNote(newNote);
        updateWordCount(newNote);
        localStorage.setItem('journal_note', newNote);
        onSecretWordDetected(lower);
        break;
      }
    }
  };

  const selectMood = (mood) => {
    setSelectedMood(mood);
    const todayStr = new Date().toDateString();
    localStorage.setItem(`mood_${todayStr}`, mood);
    generateStreakDots(); // refresh streak display
  };

  const moods = [
    { emoji: '😊', label: 'Happy', key: 'happy' },
    { emoji: '😌', label: 'Calm', key: 'calm' },
    { emoji: '🥰', label: 'Loved', key: 'loved' },
    { emoji: '🤩', label: 'Excited', key: 'excited' },
    { emoji: '😢', label: 'Sad', key: 'sad' },
    { emoji: '😰', label: 'Anxious', key: 'anxious' },
    { emoji: '😴', label: 'Tired', key: 'tired' },
    { emoji: '😤', label: 'Angry', key: 'angry' },
  ];

  // Update day tracking on mount and each day
  useEffect(() => {
    const todayStr = new Date().toDateString();
    if (localStorage.getItem('last_journal_day') !== todayStr) {
      const newDays = (parseInt(localStorage.getItem('journal_days') || '0') + 1);
      const newStreak = (parseInt(localStorage.getItem('journal_streak') || '0') + 1);
      localStorage.setItem('journal_days', newDays);
      localStorage.setItem('journal_streak', newStreak);
      localStorage.setItem('last_journal_day', todayStr);
      localStorage.setItem('today_words', '0');
      setStats(prev => ({ ...prev, days: newDays, streak: newStreak, todayWords: 0 }));
    }
  }, []);

  return (
    <div className="fixed inset-0 bg-[#f9f3e8] flex flex-col z-10">
      {/* Header */}
      <div className="flex justify-between items-center px-5 py-4 border-b border-[#ddd0b8] bg-[#f9f3e8]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-[#4a7c59] to-[#2e5239] rounded-lg flex items-center justify-center text-white shadow-md">
            📖
          </div>
          <span className="font-['DM_Serif_Display'] text-xl text-[#28211a]">My Journal</span>
        </div>
        <div className="text-right">
          <div className="text-xs text-[#9a8268] uppercase tracking-wide">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#ddd0b8] bg-[#f0e8d5]">
        {['write', 'mood', 'stats'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 text-xs uppercase tracking-wide font-serif transition-all ${
              activeTab === tab
                ? 'text-[#2e5239] border-b-2 border-[#4a7c59] font-semibold'
                : 'text-[#9a8268]'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-auto relative">
        {/* Write tab */}
        <textarea
          value={note}
          onChange={handleNoteChange}
          onKeyDown={handleKeyDown}
          placeholder="Dear journal… how was your day?"
          className={`w-full min-h-full p-5 pl-16 pb-16 font-['Lora'] text-[16.5px] leading-8 text-[#28211a] bg-transparent border-none outline-none resize-none ${
            activeTab === 'write' ? 'block' : 'hidden'
          }`}
          style={{
            backgroundImage: `
              linear-gradient(#ddd0b8 1px, transparent 1px),
              linear-gradient(90deg, #e8b4a0 1px, transparent 1px)
            `,
            backgroundSize: '100% 32px, 44px 100%',
            backgroundPosition: '0 20px, 48px 0',
          }}
        />

        {/* Mood tab */}
        <div className={`p-6 flex flex-col gap-4 ${activeTab === 'mood' ? 'block' : 'hidden'}`}>
          <h2 className="font-['DM_Serif_Display'] text-2xl text-[#28211a]">How are you feeling?</h2>
          <p className="text-sm text-[#9a8268] italic -mt-2">Track your emotions, one day at a time.</p>
          <div className="grid grid-cols-4 gap-2.5">
            {moods.map(mood => (
              <button
                key={mood.key}
                onClick={() => selectMood(mood.key)}
                className={`aspect-square rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all ${
                  selectedMood === mood.key
                    ? 'border-[#4a7c59] bg-[#e8f0eb]'
                    : 'border-[#ddd0b8] bg-[#f0e8d5]'
                }`}
              >
                <span className="text-2xl">{mood.emoji}</span>
                <span className="text-[10px] text-[#9a8268]">{mood.label}</span>
              </button>
            ))}
          </div>
          <div className="bg-[#f0e8d5] border border-[#ddd0b8] rounded-xl p-4">
            <div className="text-xs uppercase tracking-wide text-[#9a8268] mb-2">This week's streak</div>
            <div className="flex gap-1.5">
              {streakDots.map((dot, i) => (
                <div
                  key={i}
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs border ${
                    dot.active
                      ? 'bg-[#4a7c59] border-[#2e5239] text-white'
                      : 'bg-[#e4d6be] border-[#ddd0b8] text-[#9a8268]'
                  }`}
                >
                  {dot.label}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Stats tab */}
        <div className={`p-6 flex flex-col gap-3.5 ${activeTab === 'stats' ? 'block' : 'hidden'}`}>
          {[
            { icon: '✍️', label: 'Total words written', value: stats.totalWords },
            { icon: '📅', label: 'Days journaling', value: stats.days },
            { icon: '🔥', label: 'Day streak', value: stats.streak },
            { icon: '📝', label: 'Words written today', value: stats.todayWords },
          ].map(stat => (
            <div key={stat.label} className="bg-[#f0e8d5] border border-[#ddd0b8] rounded-xl p-4 flex items-center gap-3.5">
              <span className="text-3xl">{stat.icon}</span>
              <div>
                <div className="font-['DM_Serif_Display'] text-2xl text-[#28211a]">{stat.value}</div>
                <div className="text-xs text-[#9a8268]">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-2.5 border-t border-[#ddd0b8] flex justify-between text-xs text-[#9a8268] font-serif bg-[#f9f3e8]">
        <span>{wordCount} word{wordCount !== 1 ? 's' : ''}</span>
        <span className="italic">auto‑saved ✓</span>
      </div>
    </div>
  );
};

export default Journal;