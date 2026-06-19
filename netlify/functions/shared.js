// netlify/functions/shared.js
const admin = require('firebase-admin');

// --- Constants (tunable) ---
const DAILY_BUDGET = 300;
const TEXT_COST_PER_100_CHARS = 1;
const ACTIVE_COST_PER_10_MIN = 10;
const OPEN_COST = 3;
const PHOTO_COST = 8;
const IDLE_TIMEOUT_MS = 3 * 60 * 1000;       // 3 minutes – used client-side
const HEARTBEAT_INTERVAL_MS = 30 * 1000;     // client sends every 30s
const ACTIVE_WINDOW_MS = 90 * 1000;          // consider active if heartbeat within 90s
const TIMEZONE = 'America/New_York';          // daily reset timezone

// Paths
const CHAT_ROOM = 'privateChats/secret_blossom_chat';
const BUDGET_PATH = `${CHAT_ROOM}/tokenBudget`;

// --- Admin SDK initialization ---
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
  });
}

// --- Helpers ---

// Get today's date string in the chosen timezone
function getTodayStr() {
  return new Date().toLocaleDateString('en-US', { timeZone: TIMEZONE });
}

// Reset budget if day changed, and return the balance (or 0 if not set)
async function getOrResetBudget() {
  const ref = admin.database().ref(BUDGET_PATH);
  const snapshot = await ref.once('value');
  const data = snapshot.val() || {};

  const today = getTodayStr();
  if (data.lastResetDate !== today) {
    // Reset
    const newData = {
      balance: DAILY_BUDGET,
      lastResetDate: today,
      activeSeconds: 0,
      lastActiveProcessTime: Date.now(),
      // Keep heartbeats and open timestamp
    };
    await ref.update(newData);
    return DAILY_BUDGET;
  }
  return data.balance ?? 0;
}

// Deduct tokens via transaction – returns { success, newBalance, error? }
async function deductTokens(cost) {
  const ref = admin.database().ref(BUDGET_PATH);
  let newBalance = 0;
  let success = false;

  await ref.transaction((current) => {
    if (current === null) {
      // First time – init
      return {
        balance: DAILY_BUDGET - cost,
        lastResetDate: getTodayStr(),
        activeSeconds: 0,
        lastActiveProcessTime: Date.now(),
      };
    }

    // Reset if day changed
    const today = getTodayStr();
    if (current.lastResetDate !== today) {
      current.balance = DAILY_BUDGET;
      current.lastResetDate = today;
      current.activeSeconds = 0;
      current.lastActiveProcessTime = Date.now();
    }

    if (current.balance < cost) {
      // Not enough tokens – abort transaction (return undefined)
      return; // This aborts the transaction
    }

    current.balance -= cost;
    newBalance = current.balance;
    success = true;
    return current;
  });

  // If transaction was aborted, success remains false.
  // We can fetch the new balance to return it even on failure.
  if (!success) {
    const snapshot = await ref.once('value');
    const data = snapshot.val() || {};
    return { success: false, newBalance: data.balance ?? 0 };
  }
  return { success: true, newBalance };
}

module.exports = {
  admin,
  DAILY_BUDGET,
  TEXT_COST_PER_100_CHARS,
  ACTIVE_COST_PER_10_MIN,
  OPEN_COST,
  PHOTO_COST,
  ACTIVE_WINDOW_MS,
  BUDGET_PATH,
  getTodayStr,
  getOrResetBudget,
  deductTokens,
};