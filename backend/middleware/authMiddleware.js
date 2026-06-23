import { verifyToken } from '../utils/jwtUtils.js';

// Protect routes by validating JWT Bearer token in the request headers.
export const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = verifyToken(token);
      
      // Attach the decoded token payload (user information) to req.user
      req.user = decoded;
      return next();
    } catch (error) {
      return res.status(401).json({ error: 'Not authorized, token validation failed' });
    }
  }

  return res.status(401).json({ error: 'Not authorized, no token provided' });
};
