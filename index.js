import express from 'express';
import webpush from 'web-push';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;

let subscriptions = []; // Untuk menyimpan push subscription dari client

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
  subscriptions.push(subscription);
  res.status(201).json({ message: 'Berhasil subscribe!' });
});

// Endpoint untuk trigger notifikasi
app.post('/trigger-notification', async (req, res) => {
  const { title, message } = req.body;
  const payload = JSON.stringify({ title, message });

  const results = await Promise.allSettled(
    subscriptions.map(sub => webpush.sendNotification(sub, payload))
  );

  res.status(200).json({ success: true, results });
});

// Jalankan server
app.listen(port, () => {
  console.log(`🚀 Server berjalan di http://localhost:${port}`);
});
