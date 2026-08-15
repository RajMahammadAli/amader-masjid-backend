const mongoose = require("mongoose");

const donorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    mobile: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    donorType: {
      type: String,
      enum: ["regular", "flexible"],
      required: true,
    },

    // Total monthly commitment
    monthlyAmount: {
      type: Number,
      default: 0,
    },

    // Category-wise monthly commitment
    monthlyCommitment: {
      imam: {
        type: Number,
        default: 0,
      },

      maktab: {
        type: Number,
        default: 0,
      },

      mosque: {
        type: Number,
        default: 0,
      },

      other: {
        type: Number,
        default: 0,
      },
    },

    pin: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

const Donor = mongoose.model("Donor", donorSchema);

module.exports = Donor;
