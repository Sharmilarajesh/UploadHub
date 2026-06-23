import User from '../models/userModel.js';
import { generateToken } from '../utils/jwtUtils.js';


 // Register a new user.
 
export const registerUser = async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email, and password are required' });
  }

  try {
    const userExists = await User.findOne({ email: email.toLowerCase() });
    if (userExists) {
      return res.status(400).json({ error: 'A user with that email already exists' });
    }

    const user = new User({
      username,
      email: email.toLowerCase(),
      password
    });

    await user.save();
    const token = generateToken(user);

    return res.status(201).json({
      _id: user._id,
      username: user.username,
      email: user.email,
      token
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Server error during registration' });
  }
};


 // Authenticate a user and issue JWT.

export const loginUser = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = generateToken(user);

    return res.status(200).json({
      _id: user._id,
      username: user.username,
      email: user.email,
      token
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Server error during login' });
  }
};


 // Retrieve user profile info based on token validation.
 
export const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.status(200).json(user);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Server error retrieving profile' });
  }
};
