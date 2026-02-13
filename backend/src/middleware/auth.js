import { verifyFirebaseToken } from '../config/firebase-admin.js';

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
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Note: Role checking would need to query Firestore for user profile
    // For now, this middleware passes through if user is authenticated
    // Actual role validation should be done in route handlers by querying Firestore

    next();
  };
};
