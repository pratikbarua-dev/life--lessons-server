const verifyAdmin = (req, res, next) => {
    // 1. Check if the user is authenticated (populated by express-jwt)
    if (!req.user) {
        return res.status(401).json({ message: "Unauthorized: No token provided" });
    }

    // 2. Check if user is banned (optional, but recommended based on your schema)
    if (req.user.isBanned) {
        return res.status(403).json({ message: "Forbidden: Account is banned" });
    }

    // 3. Verify the role
    if (req.user.role === 'admin') {
        next(); // User is an admin, proceed to the route handler
    } else {
        res.status(403).json({ message: "Forbidden: Admin access required" });
    }
};

module.exports = { verifyAdmin };