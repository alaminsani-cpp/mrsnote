// netlify/functions/sendMessage.js
const { admin, deductTokens, TEXT_COST_PER_100_CHARS, PHOTO_COST } = require('./shared');

exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { text, imageUrl, videoUrl, role, displayName } = JSON.parse(event.body);

    // Validate role
    if (!['her', 'him'].includes(role)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid role' }) };
    }

    // Compute cost
    let cost = 0;
    if (text && text.trim()) {
      cost += Math.ceil(text.length / 100); // 1 token per 100 chars
    }
    if (imageUrl) {
      cost += PHOTO_COST; // 8 tokens per photo
    }
    // Video: no cost for now (or you can add VIDEO_COST)
    if (cost === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'No content to send' }) };
    }

    // Deduct tokens
    const { success, newBalance } = await deductTokens(cost);
    if (!success) {
      return {
        statusCode: 403,
        body: JSON.stringify({
          error: 'Insufficient tokens',
          code: 'insufficient-tokens',
          balance: newBalance,
        }),
      };
    }

    // Build message object
    const message = {
      role,
      displayName: displayName || (role === 'her' ? '🌸 Her' : '💙 Him'),
      ts: Date.now(),
    };
    if (text && text.trim()) message.text = text.trim();
    if (imageUrl) message.imageUrl = imageUrl;
    if (videoUrl) message.videoUrl = videoUrl;

    // Write to Firebase
    const messagesRef = admin.database().ref('privateChats/secret_blossom_chat/messages');
    const newMessageRef = messagesRef.push();
    await newMessageRef.set(message);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        newBalance,
        messageId: newMessageRef.key,
      }),
    };
  } catch (err) {
    console.error('sendMessage error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};