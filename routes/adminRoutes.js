const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");
const adminProtect = require("../middleware/adminAuthMiddleware");

const router = express.Router();

// ================================
// Create Admin
// ================================
router.post("/create", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email এবং password দিন।",
      });
    }

    // Check existing admin
    const existingAdmin = await Admin.findOne({ email });

    if (existingAdmin) {
      return res.status(409).json({
        message: "এই email দিয়ে ইতিমধ্যে Admin account আছে।",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create admin
    const admin = await Admin.create({
      name,
      email,
      password: hashedPassword,
      role: "admin",
    });

    res.status(201).json({
      message: "Admin account successfully created.",
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (error) {
    console.error("Admin Create Error:", error);

    res.status(500).json({
      message: "Admin account তৈরি করা যায়নি।",
    });
  }
});

// ================================
// Admin Login
// ================================
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Required fields
    if (!email || !password) {
      return res.status(400).json({
        message: "Email এবং password দিন।",
      });
    }

    // Find admin
    const admin = await Admin.findOne({ email });

    if (!admin) {
      return res.status(401).json({
        message: "Email অথবা password সঠিক নয়।",
      });
    }

    // Compare password
    const isPasswordCorrect = await bcrypt.compare(password, admin.password);

    if (!isPasswordCorrect) {
      return res.status(401).json({
        message: "Email অথবা password সঠিক নয়।",
      });
    }

    // Create JWT
    const token = jwt.sign(
      {
        adminId: admin._id,
        role: "admin",
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      },
    );

    // ================================
    // Production Cookie
    // ================================
    res.cookie("adminToken", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    console.log("Admin login successful:", admin.email);
    console.log("Admin authentication cookie created.");

    res.status(200).json({
      message: "Admin login successful.",

      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (error) {
    console.error("Admin Login Error:", error);

    res.status(500).json({
      message: "Admin login করা যায়নি।",
    });
  }
});

// ================================
// Cookie Test Route
// ================================
router.get("/cookie-test", (req, res) => {
  console.log("ADMIN COOKIES:", req.cookies);

  res.status(200).json({
    message: "Cookie test completed.",
    hasAdminToken: !!req.cookies.adminToken,
    cookies: req.cookies,
  });
});

// ================================
// Protected Admin Test Route
// ================================
router.get("/protected", adminProtect, async (req, res) => {
  res.status(200).json({
    message: "Admin protected route successfully accessed.",
    admin: req.admin,
  });
});

module.exports = router;
