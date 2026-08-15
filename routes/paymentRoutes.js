const express = require("express");
const Payment = require("../models/Payment");
const Donor = require("../models/Donor");
const protect = require("../middleware/authMiddleware");
const adminProtect = require("../middleware/adminAuthMiddleware");

const router = express.Router();

// Create Payment
// Create Payment
router.post("/", protect, async (req, res) => {
  try {
    const { category, amount, paymentMethod, transactionId, paymentDate } =
      req.body;

    // Logged-in donor ID comes from JWT
    const donorId = req.user.donorId;

    // Required fields check
    if (!donorId || !category || !amount || !paymentMethod) {
      return res.status(400).json({
        message: "প্রয়োজনীয় তথ্য দিন।",
      });
    }

    // Check donor
    const donor = await Donor.findById(donorId);

    if (!donor) {
      return res.status(404).json({
        message: "Donor পাওয়া যায়নি।",
      });
    }

    // Create payment
    const payment = await Payment.create({
      donor: donorId,
      category,
      amount: Number(amount),
      paymentMethod,
      transactionId: transactionId || "",
      paymentDate: paymentDate || Date.now(),
      status: "pending",
    });

    res.status(201).json({
      message: "Payment successfully submitted.",
      payment,
    });
  } catch (error) {
    console.error("Payment Error:", error);

    res.status(500).json({
      message: "Payment save করা যায়নি।",
    });
  }
});

// Get payments by donor
router.get("/donor/:donorId", protect, async (req, res) => {
  try {
    const { donorId } = req.params;
    if (req.user.role !== "donor" || req.user.donorId.toString() !== donorId) {
      return res.status(403).json({
        message: "আপনি এই Donor-এর payment দেখতে পারবেন না।",
      });
    }

    const payments = await Payment.find({
      donor: donorId,
    }).sort({ paymentDate: -1 });

    res.status(200).json({
      payments,
    });
  } catch (error) {
    console.error("Get Payments Error:", error);

    res.status(500).json({
      message: "Payment history পাওয়া যায়নি।",
    });
  }
});

// ==================================================
// ADMIN: GET PAYMENTS BY DONOR
// ==================================================
router.get("/admin/donor/:donorId", adminProtect, async (req, res) => {
  try {
    const { donorId } = req.params;

    // Check donor exists
    const donor = await Donor.findById(donorId);

    if (!donor) {
      return res.status(404).json({
        message: "Donor পাওয়া যায়নি।",
      });
    }

    const payments = await Payment.find({
      donor: donorId,
    }).sort({
      paymentDate: -1,
    });

    res.status(200).json({
      payments,
    });
  } catch (error) {
    console.error("Admin Get Donor Payments Error:", error);

    res.status(500).json({
      message: "Payment history পাওয়া যায়নি।",
    });
  }
});

// Verify Payment
router.put("/:paymentId/verify", adminProtect, async (req, res) => {
  try {
    const { paymentId } = req.params;

    const payment = await Payment.findById(paymentId);

    if (!payment) {
      return res.status(404).json({
        message: "Payment পাওয়া যায়নি।",
      });
    }

    // Already verified
    if (payment.status === "verified") {
      return res.status(400).json({
        message: "এই payment ইতিমধ্যে verified হয়েছে।",
      });
    }

    payment.status = "verified";

    await payment.save();

    res.status(200).json({
      message: "Payment successfully verified.",
      payment,
    });
  } catch (error) {
    console.error("Verify Payment Error:", error);

    res.status(500).json({
      message: "Payment verify করা যায়নি।",
    });
  }
});

// Get all pending payments
router.get("/pending", adminProtect, async (req, res) => {
  try {
    const payments = await Payment.find({
      status: "pending",
    })
      .populate("donor", "name mobile")
      .sort({ paymentDate: -1 });

    res.status(200).json({
      payments,
    });
  } catch (error) {
    console.error("Get Pending Payments Error:", error);

    res.status(500).json({
      message: "Pending payments পাওয়া যায়নি।",
    });
  }
});

// Reject Payment
router.put("/:paymentId/reject", adminProtect, async (req, res) => {
  try {
    const { paymentId } = req.params;

    const payment = await Payment.findById(paymentId);

    if (!payment) {
      return res.status(404).json({
        message: "Payment পাওয়া যায়নি।",
      });
    }

    // Already rejected
    if (payment.status === "rejected") {
      return res.status(400).json({
        message: "এই payment ইতিমধ্যে rejected হয়েছে।",
      });
    }

    // Already verified
    if (payment.status === "verified") {
      return res.status(400).json({
        message: "Verified payment reject করা যাবে না।",
      });
    }

    payment.status = "rejected";

    await payment.save();

    res.status(200).json({
      message: "Payment successfully rejected.",
      payment,
    });
  } catch (error) {
    console.error("Reject Payment Error:", error);

    res.status(500).json({
      message: "Payment reject করা যায়নি।",
    });
  }
});

// Get payment statistics
router.get("/stats", adminProtect, async (req, res) => {
  try {
    const totalPayments = await Payment.countDocuments();

    const pendingPayments = await Payment.countDocuments({
      status: "pending",
    });

    const verifiedPayments = await Payment.countDocuments({
      status: "verified",
    });

    const rejectedPayments = await Payment.countDocuments({
      status: "rejected",
    });

    const verifiedAmountResult = await Payment.aggregate([
      {
        $match: {
          status: "verified",
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: {
            $sum: "$amount",
          },
        },
      },
    ]);

    const verifiedAmount =
      verifiedAmountResult.length > 0 ? verifiedAmountResult[0].totalAmount : 0;

    res.status(200).json({
      totalPayments,
      pendingPayments,
      verifiedPayments,
      rejectedPayments,
      verifiedAmount,
    });
  } catch (error) {
    console.error("Payment Stats Error:", error);

    res.status(500).json({
      message: "Payment statistics পাওয়া যায়নি।",
    });
  }
});

// Get all payments for admin
router.get("/all", adminProtect, async (req, res) => {
  try {
    const payments = await Payment.find()
      .populate("donor", "name mobile")
      .sort({ paymentDate: -1 });

    res.status(200).json({
      payments,
    });
  } catch (error) {
    console.error("Get All Payments Error:", error);

    res.status(500).json({
      message: "Payment history পাওয়া যায়নি।",
    });
  }
});
module.exports = router;
