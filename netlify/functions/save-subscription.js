// netlify/functions/save-subscription.js
const admin = require('firebase-admin');

// Initialize Firebase Admin (if you're using Firebase)
// You can also use Netlify's own key-value store or a simple JSON file
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
  });
}

exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { role, subscription } = JSON.parse(event.body);
    if (!role || !subscription) {
      return { statusCode: 400, body: 'Missing role or subscription' };
    }

    // Store in Firebase
    const db = admin.database();
    await db.ref(`privateChats/secret_blossom_chat/pushSubscriptions/${role}`).set(subscription);

    console.log(`✅ Subscription saved for ${role}`);

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'Subscription saved' }),
    };
  } catch (error) {
    console.error('Error saving subscription:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};