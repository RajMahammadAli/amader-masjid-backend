const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const cookieParser = require("cookie-parser");

const connectDB = require("./config/db");
const donorRoutes = require("./routes/donorRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const adminRoutes = require("./routes/adminRoutes");

dotenv.config();

connectDB();

const app = express();

// ================================
// CORS Configuration
// ================================

// Local development + Netlify production
const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",

  // Netlify frontend
  "https://amader-masjid.netlify.app",
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests without origin
      // (Postman, server-to-server request etc.)
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.log("CORS blocked origin:", origin);

      return callback(new Error("CORS policy: This origin is not allowed."));
    },

    // Required for admin authentication cookie
    credentials: true,
  }),
);

// ================================
// Middleware
// ================================
app.use(express.json());
app.use(cookieParser());

// ================================
// Routes
// ================================
app.use("/api/donors", donorRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/admin", adminRoutes);

// ================================
// Health Check
// ================================
app.get("/", (req, res) => {
  res.status(200).send("আমাদের মসজিদ Backend Server চলছে!");
});

// ================================
// Server
// ================================
const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
