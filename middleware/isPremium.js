module.exports = function (req, res, next) {
  if (!req.user.isPremium) {
    return res
      .status(403)
      .json({ msg: "Access denied. Premium membership required." });
  }
  next();
};
