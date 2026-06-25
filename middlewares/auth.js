// middlewares/auth.js
const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    // 1. Get the token from the Authorization header (e.g., "Bearer eyJhbG...")
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Unauthorized: No token provided' });
    }

    const token = authHeader.split(' ')[1];

    try {
        // 2. Verify the token using your secret
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // 3. Attach the decoded user payload to the request object
        req.user = decoded;

        // 4. Move to the next function (your actual route handler)
        next();
    } catch (error) {
        return res.status(403).json({ success: false, message: 'Forbidden: Invalid or expired token' });
    }
};

module.exports = { verifyToken };

