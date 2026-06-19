// netlify/functions/processActiveTime.js
const {
  admin,
  BUDGET_PATH,
  ACTIVE_COST_PER_10_MIN,
  ACTIVE_WINDOW_MS,
} = require('./shared');

exports.handler = async (event) => {
  // This is a scheduled function; no request body needed.
  // Netlify calls it internally.
  try {
    const ref = admin.database().ref(BUDGET_PATH);
    const snapshot = await ref.once('value');
    let data = snapshot.val() || {};

    const now = Date.now();
    const lastProcess = data.lastActiveProcessTime || now;
    const elapsed = Math.min(now - lastProcess, 60000); // cap at 60s (safety)

    // Check if either user is active (heartbeat within ACTIVE_WINDOW_MS)
    const herActive = data.lastHeartbeatHer && (now - data.lastHeartbeatHer) < ACTIVE_WINDOW_MS;
    const himActive = data.lastHeartbeatHim && (now - data.lastHeartbeatHim) < ACTIVE_WINDOW_MS;
    const isActive = herActive || himActive;

    if (isActive) {
      // Add elapsed seconds to activeSeconds
      let activeSeconds = (data.activeSeconds || 0) + elapsed / 1000;

      // Deduct tokens in 10-minute blocks (600 seconds)
      let totalDeducted = 0;
      while (activeSeconds >= 600) {
        // Try to deduct 10 tokens
        // We need to run a transaction to deduct securely.
        // Since we are already in a transaction, we'll re-run a transaction inside the loop.
        // Simpler: use a transaction function that deducts 10 tokens if balance allows.
        const { success, newBalance } = await deductTokens(ACTIVE_COST_PER_10_MIN);
        if (!success) {
          // Not enough tokens – stop deducting, keep accumulated seconds for later?
          // We'll keep the seconds so they'll be tried again next minute.
          break;
        }
        activeSeconds -= 600;
        totalDeducted += ACTIVE_COST_PER_10_MIN;
        // Update balance is already done in transaction.
        // We need to read the new balance to keep track.
        // But we already have the newBalance from deductTokens.
        // We'll update data.balance = newBalance after loop.
      }

      // Update activeSeconds (remaining) in the database
      await ref.update({
        activeSeconds: activeSeconds,
        lastActiveProcessTime: now,
      });
    } else {
      // Not active – just update lastActiveProcessTime and keep activeSeconds as is
      await ref.update({
        lastActiveProcessTime: now,
      });
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    };
  } catch (err) {
    console.error('processActiveTime error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};