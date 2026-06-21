// netlify/functions/trigger-call.js
const admin = require('firebase-admin');
const webpush = require('web-push');

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
  });
}

// Set VAPID details
webpush.setVapidDetails(
  'mailto:your-email@example.com', // Replace with your email
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { partnerRole, callerRole } = JSON.parse(event.body);
    if (!partnerRole) {
      return { statusCode: 400, body: 'Missing partnerRole' };
    }

    // Get the partner's subscription
    const db = admin.database();
    const snapshot = await db.ref(`privateChats/secret_blossom_chat/pushSubscriptions/${partnerRole}`).once('value');
    const subscription = snapshot.val();

    if (!subscription) {
      return { statusCode: 404, body: 'No subscription for partner' };
    }

    // Determine the caller's display name
    const callerName = callerRole === 'her' ? '🌸 Her' : '💙 Him';

    // Create the push payload
    const payload = JSON.stringify({
      title: `📞 ${callerName} is calling`,
      body: 'Your Pakhi is waiting for you ❤️',
      icon: '/favicon.ico',
      data: {
        type: 'call',
        caller: callerRole,
      },
    });

    // Send the notification
    await webpush.sendNotification(subscription, payload);

    console.log(`✅ Notification sent to ${partnerRole}`);

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'Notification sent' }),
    };
  } catch (error) {
    console.error('Error sending notification:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};