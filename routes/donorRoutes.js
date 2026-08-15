const express = require("express");
const jwt = require("jsonwebtoken");
const Donor = require("../models/Donor");
const bcrypt = require("bcrypt");
const Payment = require("../models/Payment");
const protect = require("../middleware/authMiddleware");
const adminProtect = require("../middleware/adminAuthMiddleware");

const router = express.Router();

// ==================================================
// CREATE NEW DONOR
// ==================================================
router.post("/register", async (req, res) => {
  try {
    const { name, mobile, donorType, monthlyAmount, pin } = req.body;

    // Check required fields
    if (!name || !mobile || !donorType || !pin) {
      return res.status(400).json({
        message: "প্রয়োজনীয় তথ্যগুলো পূরণ করুন।",
      });
    }

    // Check if mobile already exists
    const existingDonor = await Donor.findOne({ mobile });

    if (existingDonor) {
      return res.status(409).json({
        message: "এই মোবাইল নম্বর দিয়ে ইতিমধ্যে একটি একাউন্ট আছে।",
      });
    }

    // Hash PIN
    const hashedPin = await bcrypt.hash(pin, 10);

    // Create donor
    const donor = await Donor.create({
      name,
      mobile,
      donorType,
      monthlyAmount: donorType === "regular" ? Number(monthlyAmount) || 0 : 0,
      pin: hashedPin,
    });

    res.status(201).json({
      message: "একাউন্ট সফলভাবে তৈরি হয়েছে।",
      donor: {
        id: donor._id,
        name: donor.name,
        mobile: donor.mobile,
        donorType: donor.donorType,
      },
    });
  } catch (error) {
    console.error("Registration Error:", error.message);

    res.status(500).json({
      message: "Server error হয়েছে।",
    });
  }
});

// ==================================================
// DONOR LOGIN
// ==================================================
router.post("/login", async (req, res) => {
  try {
    const { mobile, pin } = req.body;

    // Check required fields
    if (!mobile || !pin) {
      return res.status(400).json({
        message: "মোবাইল নম্বর ও PIN দিন।",
      });
    }

    // Find donor
    const donor = await Donor.findOne({ mobile });

    if (!donor) {
      return res.status(401).json({
        message: "মোবাইল নম্বর অথবা PIN সঠিক নয়।",
      });
    }

    // Compare PIN
    const isPinCorrect = await bcrypt.compare(pin, donor.pin);

    if (!isPinCorrect) {
      return res.status(401).json({
        message: "মোবাইল নম্বর অথবা PIN সঠিক নয়।",
      });
    }

    // Create JWT
    const token = jwt.sign(
      {
        donorId: donor._id,
        role: "donor",
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      },
    );

    res.status(200).json({
      message: "লগইন সফল হয়েছে.",

      token,

      donor: {
        id: donor._id,
        name: donor.name,
        mobile: donor.mobile,
        donorType: donor.donorType,
        monthlyAmount: donor.monthlyAmount,
      },
    });
  } catch (error) {
    console.error("Login Error:", error.message);

    res.status(500).json({
      message: "Server error হয়েছে।",
    });
  }
});

// ==================================================
// UPDATE DONOR MONTHLY COMMITMENTS
// ==================================================
router.put("/:donorId/commitment", async (req, res) => {
  try {
    const { donorId } = req.params;

    const { monthlyCommitment } = req.body;

    const { imam, maktab, mosque, other } = monthlyCommitment || {};

    const donor = await Donor.findById(donorId);

    if (!donor) {
      return res.status(404).json({
        message: "Donor পাওয়া যায়নি।",
      });
    }

    donor.monthlyCommitment = {
      imam: Number(imam) || 0,
      maktab: Number(maktab) || 0,
      mosque: Number(mosque) || 0,
      other: Number(other) || 0,
    };

    // Calculate total monthly commitment
    donor.monthlyAmount =
      donor.monthlyCommitment.imam +
      donor.monthlyCommitment.maktab +
      donor.monthlyCommitment.mosque +
      donor.monthlyCommitment.other;

    await donor.save();

    res.status(200).json({
      message: "Monthly commitment successfully updated.",
      donor: {
        id: donor._id,
        name: donor.name,
        monthlyAmount: donor.monthlyAmount,
        monthlyCommitment: donor.monthlyCommitment,
      },
    });
  } catch (error) {
    console.error("Commitment Update Error:", error.message);

    res.status(500).json({
      message: "Monthly commitment update করা যায়নি।",
    });
  }
});

// ==================================================
// ADMIN: GET MONTHLY DONOR REPORT
// ==================================================
router.get("/monthly-report", adminProtect, async (req, res) => {
  try {
    const { year, month } = req.query;

    const selectedYear = Number(year);
    const selectedMonth = Number(month);

    // Validate year and month
    if (
      !selectedYear ||
      !selectedMonth ||
      selectedMonth < 1 ||
      selectedMonth > 12
    ) {
      return res.status(400).json({
        message: "সঠিক বছর ও মাস নির্বাচন করুন।",
      });
    }

    // Month start
    const monthStart = new Date(selectedYear, selectedMonth - 1, 1);

    // Next month start
    const monthEnd = new Date(selectedYear, selectedMonth, 1);

    // Get all donors
    const donors = await Donor.find().select("-pin").sort({ name: 1 });

    // Get verified payments of selected month
    const payments = await Payment.find({
      status: "verified",
      paymentDate: {
        $gte: monthStart,
        $lt: monthEnd,
      },
    });

    // Create donor payment map
    const paymentMap = {};

    payments.forEach((payment) => {
      const donorId = payment.donor.toString();

      if (!paymentMap[donorId]) {
        paymentMap[donorId] = {
          imam: 0,
          maktab: 0,
          mosque: 0,
          other: 0,
          total: 0,
        };
      }

      const amount = Number(payment.amount || 0);

      if (paymentMap[donorId][payment.category] !== undefined) {
        paymentMap[donorId][payment.category] += amount;
      }

      paymentMap[donorId].total += amount;
    });

    // Create report
    const report = donors.map((donor) => {
      const donorId = donor._id.toString();

      const commitment = {
        imam: Number(donor.monthlyCommitment?.imam || 0),

        maktab: Number(donor.monthlyCommitment?.maktab || 0),

        mosque: Number(donor.monthlyCommitment?.mosque || 0),

        other: Number(donor.monthlyCommitment?.other || 0),
      };

      commitment.total =
        commitment.imam +
        commitment.maktab +
        commitment.mosque +
        commitment.other;

      const paid = paymentMap[donorId] || {
        imam: 0,
        maktab: 0,
        mosque: 0,
        other: 0,
        total: 0,
      };

      const due = {
        imam: Math.max(commitment.imam - paid.imam, 0),

        maktab: Math.max(commitment.maktab - paid.maktab, 0),

        mosque: Math.max(commitment.mosque - paid.mosque, 0),

        other: Math.max(commitment.other - paid.other, 0),
      };

      due.total = due.imam + due.maktab + due.mosque + due.other;

      return {
        donorId: donor._id,
        name: donor.name,
        mobile: donor.mobile,
        donorType: donor.donorType,

        commitment,

        paid: {
          imam: paid.imam,
          maktab: paid.maktab,
          mosque: paid.mosque,
          other: paid.other,
          total: paid.total,
        },

        due,
      };
    });

    // Overall summary
    const summary = report.reduce(
      (total, donor) => {
        total.commitment += donor.commitment.total;
        total.paid += donor.paid.total;
        total.due += donor.due.total;

        return total;
      },
      {
        commitment: 0,
        paid: 0,
        due: 0,
      },
    );

    // Bengali month name
    const monthName = monthStart.toLocaleDateString("bn-BD", {
      year: "numeric",
      month: "long",
    });

    res.status(200).json({
      year: selectedYear,
      month: selectedMonth,
      monthName,

      summary,

      report,
    });
  } catch (error) {
    console.error("Monthly Donor Report Error:", error);

    res.status(500).json({
      message: "Monthly donor report তৈরি করা যায়নি।",
    });
  }
});

// ==================================================
// ADMIN: GET ALL DONORS
// ==================================================
router.get("/all", adminProtect, async (req, res) => {
  try {
    const donors = await Donor.find().select("-pin").sort({ createdAt: -1 });

    res.status(200).json({
      donors,
    });
  } catch (error) {
    console.error("Get All Donors Error:", error);

    res.status(500).json({
      message: "Donor list পাওয়া যায়নি।",
    });
  }
});

// ==================================================
// DONOR: GET OWN DETAILS
// ==================================================
// এটি Donor-এর জন্য।
// এখানে protect থাকবে।
// ==================================================
router.get("/:donorId", protect, async (req, res) => {
  try {
    const { donorId } = req.params;

    if (req.user.role !== "donor" || req.user.donorId.toString() !== donorId) {
      return res.status(403).json({
        message: "আপনি এই Donor-এর তথ্য দেখতে পারবেন না।",
      });
    }

    const donor = await Donor.findById(donorId).select("-pin");

    if (!donor) {
      return res.status(404).json({
        message: "Donor পাওয়া যায়নি।",
      });
    }

    res.status(200).json({
      donor,
    });
  } catch (error) {
    console.error("Get Donor Details Error:", error);

    res.status(500).json({
      message: "Donor details পাওয়া যায়নি।",
    });
  }
});

// ==================================================
// ADMIN: GET SINGLE DONOR DETAILS
// ==================================================
// গুরুত্বপূর্ণ:
// Donor-এর আগের route-এর সাথে এটি আলাদা।
// Admin এখানে adminProtect ব্যবহার করবে.
// ==================================================
router.get("/admin/:donorId", adminProtect, async (req, res) => {
  try {
    const { donorId } = req.params;

    // Find donor
    const donor = await Donor.findById(donorId).select("-pin");

    if (!donor) {
      return res.status(404).json({
        message: "Donor পাওয়া যায়নি।",
      });
    }

    res.status(200).json({
      donor,
    });
  } catch (error) {
    console.error("Admin Get Donor Details Error:", error);

    res.status(500).json({
      message: "Donor details পাওয়া যায়নি।",
    });
  }
});

// ==================================================
// ADMIN: GET DONOR MONTHLY PAYMENT SUMMARY
// ==================================================
router.get("/:donorId/monthly-summary", adminProtect, async (req, res) => {
  try {
    const { donorId } = req.params;

    // Find donor
    const donor = await Donor.findById(donorId).select("-pin");

    if (!donor) {
      return res.status(404).json({
        message: "Donor পাওয়া যায়নি।",
      });
    }

    // Get verified payments
    const payments = await Payment.find({
      donor: donorId,
      status: "verified",
    }).sort({
      paymentDate: -1,
    });

    // Donor account creation date
    const startDate = new Date(donor.createdAt);

    // Current date
    const now = new Date();

    const monthlyData = [];

    // Start from registration month
    let currentYear = startDate.getFullYear();

    let currentMonth = startDate.getMonth();

    while (
      currentYear < now.getFullYear() ||
      (currentYear === now.getFullYear() && currentMonth <= now.getMonth())
    ) {
      const monthStart = new Date(currentYear, currentMonth, 1);

      const monthEnd = new Date(currentYear, currentMonth + 1, 1);

      // Payments of this month
      const monthlyPayments = payments.filter((payment) => {
        const paymentDate = new Date(payment.paymentDate);

        return paymentDate >= monthStart && paymentDate < monthEnd;
      });

      // Category-wise paid
      const paid = {
        imam: 0,
        maktab: 0,
        mosque: 0,
        other: 0,
      };

      monthlyPayments.forEach((payment) => {
        if (paid[payment.category] !== undefined) {
          paid[payment.category] += Number(payment.amount || 0);
        }
      });

      // Monthly commitment
      const commitment = {
        imam: Number(donor.monthlyCommitment?.imam || 0),

        maktab: Number(donor.monthlyCommitment?.maktab || 0),

        mosque: Number(donor.monthlyCommitment?.mosque || 0),

        other: Number(donor.monthlyCommitment?.other || 0),
      };

      // Total commitment
      commitment.total =
        commitment.imam +
        commitment.maktab +
        commitment.mosque +
        commitment.other;

      // Total paid
      paid.total = paid.imam + paid.maktab + paid.mosque + paid.other;

      // Due
      const due = {
        imam: Math.max(commitment.imam - paid.imam, 0),

        maktab: Math.max(commitment.maktab - paid.maktab, 0),

        mosque: Math.max(commitment.mosque - paid.mosque, 0),

        other: Math.max(commitment.other - paid.other, 0),
      };

      due.total = due.imam + due.maktab + due.mosque + due.other;

      monthlyData.push({
        year: currentYear,
        month: currentMonth + 1,

        monthName: monthStart.toLocaleDateString("bn-BD", {
          year: "numeric",
          month: "long",
        }),

        commitment,
        paid,
        due,
      });

      // Next month
      currentMonth++;

      if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
      }
    }

    // Latest month first
    monthlyData.reverse();

    res.status(200).json({
      donor: {
        id: donor._id,
        name: donor.name,
        mobile: donor.mobile,
      },

      monthlySummary: monthlyData,
    });
  } catch (error) {
    console.error("Monthly Summary Error:", error);

    res.status(500).json({
      message: "Monthly payment summary পাওয়া যায়নি।",
    });
  }
});

// ==================================================
// ADMIN: GET DONOR PAYMENT SUMMARY
// ==================================================
router.get("/:donorId/payment-summary", adminProtect, async (req, res) => {
  try {
    const { donorId } = req.params;

    // Check donor
    const donor = await Donor.findById(donorId).select("-pin");

    if (!donor) {
      return res.status(404).json({
        message: "Donor পাওয়া যায়নি।",
      });
    }

    // Get only verified payments
    const payments = await Payment.find({
      donor: donorId,
      status: "verified",
    });

    // Category-wise paid amount
    const paid = {
      imam: 0,
      maktab: 0,
      mosque: 0,
      other: 0,
    };

    payments.forEach((payment) => {
      if (paid[payment.category] !== undefined) {
        paid[payment.category] += Number(payment.amount || 0);
      }
    });

    // Category-wise due
    const due = {
      imam: Math.max(Number(donor.monthlyCommitment?.imam || 0) - paid.imam, 0),

      maktab: Math.max(
        Number(donor.monthlyCommitment?.maktab || 0) - paid.maktab,
        0,
      ),

      mosque: Math.max(
        Number(donor.monthlyCommitment?.mosque || 0) - paid.mosque,
        0,
      ),

      other: Math.max(
        Number(donor.monthlyCommitment?.other || 0) - paid.other,
        0,
      ),
    };

    // Total commitment
    const totalCommitment =
      Number(donor.monthlyCommitment?.imam || 0) +
      Number(donor.monthlyCommitment?.maktab || 0) +
      Number(donor.monthlyCommitment?.mosque || 0) +
      Number(donor.monthlyCommitment?.other || 0);

    const totalPaid = paid.imam + paid.maktab + paid.mosque + paid.other;

    const totalDue = due.imam + due.maktab + due.mosque + due.other;

    res.status(200).json({
      donor: {
        id: donor._id,
        name: donor.name,
        mobile: donor.mobile,
      },

      commitment: {
        imam: Number(donor.monthlyCommitment?.imam || 0),

        maktab: Number(donor.monthlyCommitment?.maktab || 0),

        mosque: Number(donor.monthlyCommitment?.mosque || 0),

        other: Number(donor.monthlyCommitment?.other || 0),

        total: totalCommitment,
      },

      paid: {
        ...paid,
        total: totalPaid,
      },

      due: {
        ...due,
        total: totalDue,
      },
    });
  } catch (error) {
    console.error("Payment Summary Error:", error);

    res.status(500).json({
      message: "Payment summary পাওয়া যায়নি।",
    });
  }
});

module.exports = router;
