import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import cron from 'node-cron';
import s3 from './config/s3.js';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';

import authRoutes from './routes/authRoutes.js';
import fileRoutes from './routes/fileRoutes.js';
import Bin from './models/binModel.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, postman)
    if (!origin) return callback(null, true);

    const allowed = process.env.FRONTEND_URL 
      ? process.env.FRONTEND_URL.split(',').map(o => o.trim().replace(/\/$/, ''))
      : [];

    const normalizedOrigin = origin.trim().replace(/\/$/, '');

    if (allowed.length === 0 || allowed.includes(normalizedOrigin) || allowed.includes('*')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());

// Register API Routes
app.use('/api/auth', authRoutes);
app.use('/api', fileRoutes);

// Default test route
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', time: new Date() });
});

// Connect to Database with Memory Server failover
const connectDB = async () => {
  const uri = process.env.MONGO_URI;
  try {
    console.log('Attempting to connect to MongoDB...');
    await mongoose.connect(uri);
    console.log('Successfully connected to MongoDB.');
  } catch (error) {
    console.error('Fatal: MongoDB connection failed. Error:', error.message);
    process.exit(1);
  }
};

// Daily cron job at midnight (0 0 * * *) to delete expired bins and clean up disk uploads
cron.schedule('0 0 * * *', async () => {
  console.log('[Cron Job] Executing expired bins clean up...');
  try {
    const now = new Date();
    const expiredBins = await Bin.find({ expiresAt: { $lte: now } });
    console.log(`[Cron Job] Found ${expiredBins.length} expired bins.`);

    for (const bin of expiredBins) {
      for (const file of bin.files) {
        try {
          const deleteCommand = new DeleteObjectCommand({
            Bucket: process.env.B2_BUCKET_NAME,
            Key: file.filePath,
          });
          await s3.send(deleteCommand);
          console.log(`[Cron Job] Deleted from Backblaze B2: ${file.filePath}`);
        } catch (err) {
          console.error(`[Cron Job] Failed to delete from Backblaze B2: ${file.fileName}`, err);
        }
      }
      await Bin.deleteOne({ _id: bin._id });
      console.log(`[Cron Job] Removed bin record: ${bin.binId}`);
    }
    console.log('[Cron Job] Expired bins cleanup finished.');
  } catch (error) {
    console.error('[Cron Job] Error during expired bins database cleanup:', error);
  }
});

// Admin helper endpoint to manually trigger a cleanup for verification
app.post('/api/admin/cleanup', async (req, res) => {
  try {
    const now = new Date();
    const expiredBins = await Bin.find({ expiresAt: { $lte: now } });
    let unlinkedCount = 0;

    for (const bin of expiredBins) {
      for (const file of bin.files) {
        try {
          const deleteCommand = new DeleteObjectCommand({
            Bucket: process.env.B2_BUCKET_NAME,
            Key: file.filePath,
          });
          await s3.send(deleteCommand);
          unlinkedCount++;
        } catch (err) {
          console.error(`Failed to delete from Backblaze B2: ${file.fileName}`, err);
        }
      }
      await Bin.deleteOne({ _id: bin._id });
    }
    return res.status(200).json({
      message: `Manually triggered cleanup complete. Bins destroyed: ${expiredBins.length}, Files deleted: ${unlinkedCount}`
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error('[Global Error Handler]:', err);
  res.status(500).json({ error: err.message || 'An unexpected error occurred on the server' });
});

// Start express server
app.listen(PORT, async () => {
  await connectDB();
  console.log(`UploadHub backend listening on port ${PORT}`);
});
