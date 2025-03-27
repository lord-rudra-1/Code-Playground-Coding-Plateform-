const authCheck = (req, res, next) => {
    const allowedPaths = ['/home', '/signin', '/signup'];
    const { username, email } = req.headers;

    if (allowedPaths.includes(req.path)) {
        return next();
    }

    if (!username || !email) {
        return res.status(401).json({ message: 'Unauthorized: Username and email are required' });
    }

    next();
};

module.exports = authCheck;