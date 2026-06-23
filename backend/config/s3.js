import { S3Client } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

dotenv.config();

const b2Endpoint = process.env.B2_ENDPOINT || '';
const b2Region = b2Endpoint.includes('.') ? b2Endpoint.split('.')[1] : 'us-east-005';

const s3 = new S3Client({
  endpoint: b2Endpoint ? `https://${b2Endpoint}` : undefined,
  region: b2Region,
  credentials: {
    accessKeyId: process.env.B2_ACCESS_KEY_ID || 'dummy',
    secretAccessKey: process.env.B2_SECRET_ACCESS_KEY || 'dummy',
  },
  forcePathStyle: true, // Crucial for Backblaze B2 path resolution
});

export default s3;
