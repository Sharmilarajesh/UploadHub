import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'supercybersecretkey12345';

// Generate a JWT token for the authenticated user.
export const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, email: user.email, username: user.username },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// Verify the given JWT token.
export const verifyToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};
