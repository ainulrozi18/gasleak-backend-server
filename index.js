import express from 'express';
import webpush from 'web-push';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Use a Map to store subscriptions with endpoint as key to prevent duplicates
const subscriptionMap = new Map();

webpush.setVapidDetails(
  'mailto:you@example.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

app.use(cors());
app.use(bodyParser.json());

// Endpoint untuk menyimpan push subscription
app.post('/subscribe', (req, res) => {
  const subscription = req.body;
  
  // Use subscription endpoint as unique identifier
  if (subscription && subscription.endpoint) {
    subscriptionMap.set(subscription.endpoint, subscription);
    console.log(`Subscription added/updated. Total subscriptions: ${subscriptionMap.size}`);
    res.status(201).json({ message: 'Berhasil subscribe!' });
  } else {
    res.status(400).json({ message: 'Invalid subscription object' });
  }
});

// Added endpoint to unsubscribe
app.post('/unsubscribe', (req, res) => {
  const subscription = req.body;
  
  if (subscription && subscription.endpoint) {
    if (subscriptionMap.has(subscription.endpoint)) {
      subscriptionMap.delete(subscription.endpoint);
      console.log(`Subscription removed. Total subscriptions: ${subscriptionMap.size}`);
    }
    res.status(200).json({ message: 'Unsubscribed successfully' });
  } else {
    res.status(400).json({ message: 'Invalid subscription object' });
  }
});

// Added a debounce mechanism to prevent rapid-fire notifications
let lastNotificationTimestamp = {};
const NOTIFICATION_COOLDOWN = 5000; // 5 seconds cooldown

// Endpoint untuk trigger notifikasi
app.post('/trigger-notification', async (req, res) => {
  const { title, message } = req.body;
  
  // Create a notification key to track cooldown periods for specific notification types
  const notificationKey = `${title}-${message}`;
  const now = Date.now();
  
  // Check if we're still in cooldown period for this notification type
  if (lastNotificationTimestamp[notificationKey] && 
      (now - lastNotificationTimestamp[notificationKey]) < NOTIFICATION_COOLDOWN) {
    console.log(`Notification "${title}" skipped - still in cooldown period`);
    return res.status(200).json({ 
      success: true, 
      message: 'Notification skipped (cooldown period)',
      skipped: true 
    });
  }
  
  // Update the timestamp for this notification type
  lastNotificationTimestamp[notificationKey] = now;
  
  // Convert Map values to array
  const subscriptions = Array.from(subscriptionMap.values());
  
  if (subscriptions.length === 0) {
    return res.status(200).json({ 
      success: true, 
      message: 'No subscriptions to notify' 
    });
  }
  
  const payload = JSON.stringify({ title, message });
  
  try {
    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          return await webpush.sendNotification(sub, payload);
        } catch (error) {
          // If subscription is expired or invalid, remove it
          if (error.statusCode === 404 || error.statusCode === 410) {
            console.log(`Removing invalid subscription: ${sub.endpoint}`);
            subscriptionMap.delete(sub.endpoint);
          }
          throw error; // Re-throw to be caught by Promise.allSettled
        }
      })
    );
    
    console.log(`Notification "${title}" sent to ${subscriptions.length} subscribers`);
    res.status(200).json({ success: true, results });
  } catch (error) {
    console.error('Error sending notifications:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Jalankan server
app.listen(port, () => {
  console.log(`🚀 Server berjalan di http://localhost:${port}`);
});