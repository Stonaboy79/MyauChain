// index.js (GPS API backend)
// ---------------------------------------

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// --- MongoDB 接続 ---
mongoose.connect(process.env.MONGO_URI, {
})
.then(() => console.log("MongoDB Connected"))
.catch(err => console.error("MongoDB Error:", err));

// --- Schema & Model ---
const staySchema = new mongoose.Schema({
  walletAddress: String,
  lat: Number,
  lng: Number,
  timestamp: Number,
});

const Stay = mongoose.model("Stay", staySchema);

// --- GPS API ---
app.post("/api/stay", async (req, res) => {
  try {
    const { walletAddress, lat, lng, timestamp } = req.body;

    const record = new Stay({
      walletAddress,
      lat,
      lng,
      timestamp,
    });

    await record.save();

    res.json({ status: "ok", message: "Stay logged" });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ status: "error", message: "Server error" });
  }
});

// --- サーバー起動 ---
app.listen(5000, () => console.log("Backend running on port 5000"));