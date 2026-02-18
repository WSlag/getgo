import { verifyFirebaseToken } from '../config/firebase-admin.js';
import { getUserDoc } from '../config/firestore.js';

// Verify Firebase token middleware (required authentication)
export const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  const result = await verifyFirebaseToken(token);

  if (!result.valid) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }

  // Set user info on request
  req.user = {
    uid: result.uid,
    phone: result.phone,
    email: result.email,
    firebaseUser: result.decodedToken
  };

  next();
};

// Optional authentication (doesn't fail if no token)
export const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    const result = await verifyFirebaseToken(token);
    if (result.valid) {
      req.user = {
        uid: result.uid,
        phone: result.phone,
        email: result.email,
        firebaseUser: result.decodedToken
      };
    }
  }

  next();
};

// Role-based access control (checks Firestore user profile)
export const requireRole = (...roles) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    try {
      const userProfile = await getUserDoc(req.user.uid);
      if (!userProfile || !roles.includes(userProfile.role)) {
        return res.status(403).json({ error: `Access restricted to: ${roles.join(', ')}` });
      }
      // Attach profile so route handlers don't need to re-fetch
      req.userProfile = userProfile;
      next();
    } catch (err) {
      console.error('requireRole error:', err);
      res.status(500).json({ error: 'Failed to verify user role' });
    }
  };
};
