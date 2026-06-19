// netlify/functions/heartbeat.js
const { admin, BUDGET_PATH } = require('./shared');

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
    const update = {};
    update[`lastHeartbeat${role.charAt(0).toUpperCase() + role.slice(1)}`] = Date.now();
    await ref.update(update);

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    };
  } catch (err) {
    console.error('heartbeat error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};