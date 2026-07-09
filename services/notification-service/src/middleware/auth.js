export const requireAuth = (req, res, next) => {
  const userId = req.headers['x-user-id'];
  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Unauthorized: Missing user identity header'
    });
  }

  req.user = {
    id: userId
  };

  next();
};
