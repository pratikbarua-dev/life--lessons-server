const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");

const JWKS = createRemoteJWKSet(new URL(`https://${process.env.BETTER_AUTH_URL}/api/auth/jwks`));

const verifyJWT = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://${process.env.BETTER_AUTH_URL}/api/auth`,
      audience: process.env.BETTER_AUTH_AUDIENCE,
    });

    req.user = payload; // Attach the decoded payload to the request object
    next(); // Proceed to the next middleware or route handler
  } catch (error) {
    console.error('JWT verification failed:', error);
    return res.status(401).json({ message: 'Unauthorized: Invalid token' });
  }
};

module.exports = { verifyJWT };