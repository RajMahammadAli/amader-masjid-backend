const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    donor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Donor",
      required: true,
    },

    category: {
      type: String,
      required: true,
      enum: ["imam", "maktab", "mosque", "other"],
    },

    amount: {
      type: Number,
      required: true,
      min: 1,
    },

    paymentMethod: {
      type: String,
      required: true,
      enum: ["bkash", "nagad", "cash"],
    },

    transactionId: {
      type: String,
      default: "",
    },

    paymentDate: {
      type: Date,
      default: Date.now,
    },

    status: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Payment", paymentSchema);
