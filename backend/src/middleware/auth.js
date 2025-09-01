import jwt from 'jsonwebtoken';
import HRUser from '../models/HRUser.js';

// Middleware to authenticate HR users using JWT
export const authenticateHR = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Access denied. No token provided or invalid format.'
      });
    }

    const token = authHeader.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access denied. No token provided.'
      });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: 'Token has expired. Please login again.'
        });
      } else if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          error: 'Invalid token. Please login again.'
        });
      } else {
        return res.status(401).json({
          success: false,
          error: 'Token verification failed.'
        });
      }
    }

    // Check if user still exists
    const user = await HRUser.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User no longer exists. Please login again.'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Account is deactivated. Please contact administrator.'
      });
    }

    // Check if user changed password after token was issued
    if (user.changedPasswordAfter(decoded.iat)) {
      return res.status(401).json({
        success: false,
        error: 'Password was recently changed. Please login again.'
      });
    }

    // Grant access to protected route
    req.user = user;
    next();

  } catch (error) {
    console.error('Authentication middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication failed. Please try again.'
    });
  }
};

// Middleware to validate session key for public interview access
export const validateSessionKey = async (req, res, next) => {
  try {
    const { sessionKey } = req.body;
    
    if (!sessionKey) {
      return res.status(400).json({
        success: false,
        error: 'Session key is required'
      });
    }

    // Import Candidate model dynamically to avoid circular dependency
    const { default: Candidate } = await import('../models/Candidate.js');
    
    const candidate = await Candidate.findOne({
      'interviewInvitation.sessionKey': sessionKey,
      'interviewInvitation.expiresAt': { $gt: new Date() }
    }).populate('jobId', 'title description requiredSkills');

    if (!candidate) {
      return res.status(404).json({
        success: false,
        error: 'Invalid or expired session key. Please check your invitation email.'
      });
    }

    // Check if invitation is valid
    if (!candidate.isInvitationValid()) {
      return res.status(400).json({
        success: false,
        error: 'Interview invitation has expired. Please contact HR for assistance.'
      });
    }

    // Attach candidate to request object
    req.candidate = candidate;
    req.sessionKey = sessionKey;
    next();

  } catch (error) {
    console.error('Session validation error:', error);
    res.status(500).json({
      success: false,
      error: 'Session validation failed. Please try again.'
    });
  }
};

// Middleware for optional authentication (for endpoints that can work with or without auth)
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // No auth header, continue without authentication
    }

    const token = authHeader.replace('Bearer ', '');
    
    if (!token) {
      return next(); // No token, continue without authentication
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await HRUser.findById(decoded.id).select('-password');
      
      if (user && user.isActive && !user.changedPasswordAfter(decoded.iat)) {
        req.user = user;
      }
    } catch (error) {
      // Token is invalid, but we continue without authentication
      console.log('Optional auth failed, continuing without auth:', error.message);
    }

    next();
    
  } catch (error) {
    console.error('Optional auth middleware error:', error);
    next(); // Continue without authentication on error
  }
};

// Middleware to check if user has specific role (extensible for future roles)
export const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const userRoles = Array.isArray(req.user.role) ? req.user.role : [req.user.role];
    const requiredRoles = Array.isArray(roles) ? roles : [roles];

    const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role));

    if (!hasRequiredRole) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    next();
  };
};

// WebSocket authentication helper
export const authenticateWebSocket = async (token) => {
  try {
    if (!token) {
      return null;
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if user still exists
    const user = await HRUser.findById(decoded.id).select('-password');
    
    if (!user || !user.isActive || user.changedPasswordAfter(decoded.iat)) {
      return null;
    }

    return user;
    
  } catch (error) {
    console.error('WebSocket authentication error:', error);
    return null;
  }
};