const jwt = require("jsonwebtoken");

const adminProtect = (req, res, next) => {
  try {
    // adminToken cookie থেকে token নেওয়া
    const token = req.cookies.adminToken;

    // Token আছে কিনা check
    if (!token) {
      return res.status(401).json({
        message: "Admin authentication required.",
      });
    }

    // JWT verify
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // শুধুমাত্র admin access করতে পারবে
    if (decoded.role !== "admin") {
      return res.status(403).json({
        message: "Admin access required.",
      });
    }

    // Admin information request-এর সাথে রাখা
    req.admin = decoded;

    next();
  } catch (error) {
    console.error("Admin Auth Error:", error.message);

    return res.status(401).json({
      message: "Invalid or expired admin session.",
    });
  }
};

module.exports = adminProtect;
