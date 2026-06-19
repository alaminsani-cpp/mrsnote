// netlify/functions/recordOpen.js
const { admin, BUDGET_PATH, OPEN_COST, deductTokens } = require('./shared');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { role } = JSON.parse(event.body);
    if (!['her', 'him'].includes(role)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid role' }) };
    }

    const ref = admin.database().ref(BUDGET_PATH);
    const snapshot = await ref.once('value');
    const data = snapshot.val() || {};

    const now = Date.now();
    const lastOpen = data.lastOpenTimestamp || 0;
    const tenMinutes = 10 * 60 * 1000;

    let balance = data.balance ?? 0;
    let deducted = false;

    if (now - lastOpen > tenMinutes) {
      // Try to deduct OPEN_COST tokens
      const { success, newBalance } = await deductTokens(OPEN_COST);
      if (!success) {
        return {
          statusCode: 403,
          body: JSON.stringify({
            error: 'Insufficient tokens for opening chat',
            code: 'insufficient-tokens',
            balance: newBalance,
          }),
        };
      }
      balance = newBalance;
      deducted = true;
    }

    // Always update lastOpenTimestamp
    await ref.update({ lastOpenTimestamp: now });

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        deducted,
        balance,
      }),
    };
  } catch (err) {
    console.error('recordOpen error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};