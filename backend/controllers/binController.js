import { nanoid } from 'nanoid';
import Bin from '../models/binModel.js';
import s3 from '../config/s3.js';
import { DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';


 // Create a new randomized bin with an 8-character ID.

export const createBin = async (req, res) => {
  try {
    const binId = nanoid(8);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Default 7-day lifespan

    const bin = new Bin({
      userId: req.user.id,
      binId,
      expiresAt,
      files: []
    });

    await bin.save();
    return res.status(201).json(bin);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Server error creating bin' });
  }
};


const deleteB2File = async (key) => {
  try {
    const command = new DeleteObjectCommand({
      Bucket: process.env.B2_BUCKET_NAME,
      Key: key
    });
    await s3.send(command);
  } catch (err) {
    console.error('Failed to delete file from Backblaze B2:', err);
  }
};

// Upload file metadata and link physical files to a specific bin.
export const uploadFile = async (req, res) => {
  const { binId } = req.params;

  if (!req.file) {
    return res.status(400).json({ error: 'No file provided' });
  }

  try {
    const bin = await Bin.findOne({ binId });
    if (!bin) {
      await deleteB2File(req.file.key);
      return res.status(404).json({ error: 'Bin not found' });
    }

    if (bin.userId.toString() !== req.user.id) {
      await deleteB2File(req.file.key);
      return res.status(403).json({ error: 'Not authorized to upload files to this bin' });
    }

    if (new Date() > bin.expiresAt) {
      await deleteB2File(req.file.key);
      return res.status(410).json({ error: 'This bin has expired' });
    }

    const newFile = {
      fileName: req.file.originalname,
      filePath: req.file.key,   // stores Backblaze B2 S3 key
      size: req.file.size,
      type: req.file.mimetype,
      uploadDate: new Date(),
      expiresAt: bin.expiresAt
    };

    bin.files.push(newFile);
    await bin.save();

    return res.status(200).json(bin);
  } catch (error) {
    if (req.file) {
      await deleteB2File(req.file.key);
    }
    return res.status(500).json({ error: error.message || 'Server error uploading file' });
  }
};

 // Securely download a specific file.
export const downloadFile = async (req, res) => {
  const { binId, fileId } = req.params;

  try {
    const bin = await Bin.findOne({ binId });
    if (!bin) {
      return res.status(404).json({ error: 'Bin not found' });
    }

    if (new Date() > bin.expiresAt) {
      return res.status(410).json({ error: 'Bin has expired' });
    }

    const file = bin.files.id(fileId);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Generate a secure presigned download URL for private Backblaze B2 storage
    const command = new GetObjectCommand({
      Bucket: process.env.B2_BUCKET_NAME,
      Key: file.filePath,
      ResponseContentDisposition: `attachment; filename="${file.fileName.replace(/"/g, '\\"')}"`
    });

    const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 }); // Expires in 1 hour
    return res.redirect(presignedUrl);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Server error downloading file' });
  }
};

 // Fetch detailed file metadata for the bin owner.
export const getBinDetails = async (req, res) => {
  const { binId } = req.params;

  try {
    const bin = await Bin.findOne({ binId });
    if (!bin) {
      return res.status(404).json({ error: 'Bin not found' });
    }

    // Owner check
    if (bin.userId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to view bin details' });
    }

    // Check expiry
    if (new Date() > bin.expiresAt) {
      return res.status(410).json({ error: 'Bin has expired' });
    }

    return res.status(200).json(bin);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Server error getting bin details' });
  }
};

 // Fetch public metadata of files in a bin (anonymous access).
export const getPublicBin = async (req, res) => {
  const { binId } = req.params;

  try {
    const bin = await Bin.findOne({ binId }).select('-userId');
    if (!bin) {
      return res.status(404).json({ error: 'Bin not found' });
    }

    // Check expiry
    if (new Date() > bin.expiresAt) {
      return res.status(410).json({ error: 'Bin has expired' });
    }

    return res.status(200).json(bin);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Server error getting public bin details' });
  }
};

 // Delete a file from a bin (owner only) and remove it from the disk.
export const deleteFile = async (req, res) => {
  const { binId, fileId } = req.params;

  try {
    const bin = await Bin.findOne({ binId });
    if (!bin) {
      return res.status(404).json({ error: 'Bin not found' });
    }

    if (bin.userId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const file = bin.files.id(fileId);
    if (!file) {
      return res.status(404).json({ error: 'File not found in this bin' });
    }

    await deleteB2File(file.filePath);

    bin.files.pull(fileId);
    await bin.save();

    return res.status(200).json(bin);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Server error deleting file' });
  }
};

 // Manually destroy a bin and delete all physical files inside it immediately.
export const destroyBin = async (req, res) => {
  const { binId } = req.params;

  try {
    const bin = await Bin.findOne({ binId });
    if (!bin) {
      return res.status(404).json({ error: 'Bin not found' });
    }

    if (bin.userId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    for (const file of bin.files) {
      await deleteB2File(file.filePath);
    }

    await Bin.deleteOne({ binId });
    return res.status(200).json({ message: 'Bin and all files permanently destroyed' });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Server error destroying bin' });
  }
};
