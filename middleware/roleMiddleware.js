/* =========================
   ADMIN ACCESS
========================= */
export const adminOnly = (req, res, next) => {
  if (!["admin", "superadmin"].includes(req.user.role)) {
    return res.status(403).json({ message: "Admin access only" });
  }
  next();
};

/* =========================
   SUPER ADMIN ONLY
========================= */
export const superAdminOnly = (req, res, next) => {
  if (req.user.role !== "superadmin") {
    return res.status(403).json({ message: "Super Admin only" });
  }
  next();
};
