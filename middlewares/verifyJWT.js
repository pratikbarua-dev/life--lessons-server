const { createRemoteJWKSet, jwtVerify } = require('jose-cjs');
const { getDb } = require('../config/db');
const { ObjectId } = require('mongodb');

const JWKS = createRemoteJWKSet(new URL(`${process.env.BETTER_AUTH_URL}/api/auth/jwks`));

const verifyJWT = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: process.env.BETTER_AUTH_URL,
      audience: process.env.BETTER_AUTH_URL,
    });

    const userId = payload?.session?.user?.id || payload?.user?.id || payload?.session?.userId || payload?.userId || payload?.id;
    
    if (userId) {
      const db = getDb();
      let userDoc;
      try {
        userDoc = await db.collection('user').findOne({ _id: new ObjectId(userId) });
      } catch (err) {
        // Fallback if userId is not a valid ObjectId but a string
        userDoc = await db.collection('user').findOne({ id: userId });
      }

      if (!userDoc) {
        return res.status(401).json({ message: 'Unauthorized: User not found in database' });
      }

      // Check both properties in case the schema uses either 'banned' or 'isBanned'
      if (userDoc.banned || userDoc.isBanned) {
        return res.status(403).json({ message: 'Forbidden: Account is banned' });
      }

      // Attach fresh user data
      req.user = userDoc;
      req.user.id = userDoc._id.toString();
    } else {
      // Fallback to payload if we can't determine userId
      req.user = payload; 
    }

    next(); // Proceed to the next middleware or route handler
  } catch (error) {
    console.error('JWT verification failed:', error);
    return res.status(401).json({ message: 'Unauthorized: Invalid token' });
  }
};

const optionalVerifyJWT = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(); // Proceed without setting req.user
  }

  const token = authHeader.split(' ')[1];

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: process.env.BETTER_AUTH_URL,
      audience: process.env.BETTER_AUTH_URL,
    });

    const userId = payload?.session?.user?.id || payload?.user?.id || payload?.session?.userId || payload?.userId || payload?.id;

    if (userId) {
      const db = getDb();
      let userDoc;
      try {
        userDoc = await db.collection('user').findOne({ _id: new ObjectId(userId) });
      } catch (err) {
        userDoc = await db.collection('user').findOne({ id: userId });
      }

      if (userDoc && !userDoc.banned && !userDoc.isBanned) {
        req.user = userDoc; // Attach fresh DB user if valid
        req.user.id = userDoc._id.toString();
      }
    } else {
      req.user = payload; // Fallback
    }
  } catch (error) {
    console.error('Optional JWT verification failed:', error);
    // Proceed anyway, just without req.user
  }
  next();
};

const verifyJWTAllowBanned = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: process.env.BETTER_AUTH_URL,
      audience: process.env.BETTER_AUTH_URL,
    });

    const userId = payload?.session?.user?.id || payload?.user?.id || payload?.session?.userId || payload?.userId || payload?.id;
    
    if (userId) {
      const db = getDb();
      let userDoc;
      try {
        userDoc = await db.collection('user').findOne({ _id: new ObjectId(userId) });
      } catch (err) {
        userDoc = await db.collection('user').findOne({ id: userId });
      }

      if (!userDoc) {
        return res.status(401).json({ message: 'Unauthorized: User not found in database' });
      }

      req.user = userDoc;
      req.user.id = userDoc._id.toString();
    } else {
      req.user = payload; 
    }

    next();
  } catch (error) {
    console.error('JWT verification failed (AllowBanned):', error);
    return res.status(401).json({ message: 'Unauthorized: Invalid token' });
  }
};

module.exports = { verifyJWT, optionalVerifyJWT, verifyJWTAllowBanned };