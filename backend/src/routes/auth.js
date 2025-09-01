import express from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import HRUser from '../models/HRUser.js';
import { authenticateHR } from '../middleware/auth.js';

const router = express.Router();

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 5 login attempts per windowMs
  message: {
    success: false,
    error: 'Too many login attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Helper function to generate JWT token
const generateToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// Helper function to create response with user data
const createAuthResponse = (user, token) => {
  return {
    success: true,
    token,
    user: {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      lastLogin: user.lastLogin
    }
  };
};

// POST /api/auth/login - HR user login
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    // Validate email format
    const emailRegex = /\S+@\S+\.\S+/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }

    // Find user by email
    const user = await HRUser.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Account is deactivated. Please contact administrator.'
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT token
    const token = generateToken(user._id);

    // Log successful login
    console.log(`✅ HR user logged in: ${user.email} at ${new Date().toISOString()}`);

    res.json(createAuthResponse(user, token));

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed. Please try again.'
    });
  }
});

// PUT /api/auth/change-password - Change HR user password
router.put('/change-password', authLimiter, authenticateHR, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Current password and new password are required'
      });
    }

    // Validate new password strength
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 6 characters long'
      });
    }

    // Check if new password is different from current
    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        error: 'New password must be different from current password'
      });
    }

    // Get user with password
    const user = await HRUser.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    
    if (!isCurrentPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }

    // Update password (will be hashed by pre-save middleware)
    user.password = newPassword;
    await user.save();

    console.log(`✅ Password changed for HR user: ${user.email} at ${new Date().toISOString()}`);

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to change password. Please try again.'
    });
  }
});

// GET /api/auth/me - Get current HR user profile
router.get('/me', authenticateHR, async (req, res) => {
  try {
    res.json({
      success: true,
      user: {
        id: req.user._id,
        email: req.user.email,
        name: req.user.name,
        role: req.user.role,
        lastLogin: req.user.lastLogin,
        createdAt: req.user.createdAt
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get profile information'
    });
  }
});

// PUT /api/auth/profile - Update HR user profile
router.put('/profile', authLimiter, authenticateHR, async (req, res) => {
  try {
    const { name, email } = req.body;
    
    // Validate input
    if (!name || !email) {
      return res.status(400).json({
        success: false,
        error: 'Name and email are required'
      });
    }

    // Validate email format
    const emailRegex = /\S+@\S+\.\S+/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }

    // Check if email is already taken (by another user)
    if (email.toLowerCase() !== req.user.email) {
      const existingUser = await HRUser.findOne({ 
        email: email.toLowerCase(),
        _id: { $ne: req.user._id }
      });
      
      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: 'Email is already in use'
        });
      }
    }

    // Update user profile
    const user = await HRUser.findByIdAndUpdate(
      req.user._id,
      {
        name: name.trim(),
        email: email.toLowerCase()
      },
      { new: true, runValidators: true }
    ).select('-password');

    console.log(`✅ Profile updated for HR user: ${user.email} at ${new Date().toISOString()}`);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        lastLogin: user.lastLogin
      }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update profile. Please try again.'
    });
  }
});

// POST /api/auth/logout - Logout (client-side token removal)
router.post('/logout', authenticateHR, async (req, res) => {
  try {
    console.log(`✅ HR user logged out: ${req.user.email} at ${new Date().toISOString()}`);
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Logout failed'
    });
  }
});

// GET /api/auth/check - Check if default HR user exists (for initialization)
router.get('/check', async (req, res) => {
  try {
    const userCount = await HRUser.countDocuments();
    
    res.json({
      success: true,
      hasUsers: userCount > 0,
      userCount
    });
  } catch (error) {
    console.error('Check users error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check user status'
    });
  }
});

// POST /api/auth/init - Initialize default HR user (development only)
router.post('/init', async (req, res) => {
  try {
    // Only allow in development mode
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        error: 'User initialization not allowed in production'
      });
    }

    const existingUsers = await HRUser.countDocuments();
    
    if (existingUsers > 0) {
      return res.status(400).json({
        success: false,
        error: 'HR users already exist'
      });
    }

    const defaultUser = await HRUser.createDefaultUser();
    
    res.json({
      success: true,
      message: 'Default HR user created successfully',
      user: {
        email: defaultUser.email,
        name: defaultUser.name,
        role: defaultUser.role
      }
    });

  } catch (error) {
    console.error('Initialize user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initialize default user'
    });
  }
});

export default router;