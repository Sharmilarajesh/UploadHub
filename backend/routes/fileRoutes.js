import express from 'express';
import multer from 'multer';
import { protect } from '../middleware/authMiddleware.js';
import s3 from '../config/s3.js';
import multerS3 from 'multer-s3';
import {
  createBin,
  uploadFile,
  downloadFile,
  getBinDetails,
  getPublicBin,
  deleteFile,
  destroyBin
} from '../controllers/binController.js';

const router = express.Router();

const storage = multerS3({
  s3: s3,
  bucket: process.env.B2_BUCKET_NAME,
  metadata: (req, file, cb) => {
    cb(null, { fieldName: file.fieldname });
  },
  key: (req, file, cb) => {
    const uniquePrefix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const uniqueKey = `uploadhub/${uniquePrefix}-${file.originalname.replace(/\s+/g, '_')}`;
    cb(null, uniqueKey);
  }
});

const upload = multer({ storage });

// Bin creation (requires login)
router.post('/create-bin', protect, createBin);

// File uploading to a bin (owner-only auth, single file attachment)
router.post('/bins/:binId/upload', protect, upload.single('file'), uploadFile);

// Get private bin details for owner (requires auth)
router.get('/bins/:binId', protect, getBinDetails);

// Get public bin details (anonymous/download view)
router.get('/bins/:binId/public', getPublicBin);

// Public download file endpoint
router.get('/bins/:binId/files/:fileId/download', downloadFile);

// Delete file from bin (owner-only auth)
router.delete('/bins/:binId/files/:fileId', protect, deleteFile);

// Destroy bin completely (owner-only auth)
router.delete('/bins/:binId', protect, destroyBin);

export default router;
