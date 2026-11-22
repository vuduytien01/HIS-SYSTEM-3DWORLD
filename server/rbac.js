// Phân quyền theo vai — session đã được middleware của app gắn vào req.session.
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session) {
      res.status(401).json({ error: 'Chưa đăng nhập' });
      return;
    }
    if (!roles.includes(req.session.user.role)) {
      res.status(403).json({ error: 'Không đủ quyền' });
      return;
    }
    next();
  };
}
