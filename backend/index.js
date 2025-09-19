import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import bodyParser from "body-parser";

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// MongoDB Connection
mongoose
  .connect("mongodb://127.0.0.1:27017/financeDB", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err));

// Schema & Model
const recordSchema = new mongoose.Schema({
  date: { type: String, required: true },
  income: { type: Number, default: 0 },
  expense: { type: Number, default: 0 },
});

const Record = mongoose.model("Record", recordSchema);

// ---------------- API ROUTES ----------------

// ✅ Get all records
app.get("/api/records", async (req, res) => {
  try {
    const records = await Record.find();
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch records" });
  }
});

// ✅ Add/Update record
app.post("/api/records", async (req, res) => {
  try {
    const { date, income, expense } = req.body;

    let record = await Record.findOne({ date });
    if (record) {
      // Update if exists
      record.income = income;
      record.expense = expense;
      await record.save();
    } else {
      // Create new
      record = new Record({ date, income, expense });
      await record.save();
    }

    res.json(record);
  } catch (err) {
    console.error("Record save error:", err);
    res.status(500).json({ error: "Failed to save record" });
  }
});

// ✅ Simple Chatbot
app.post("/api/chatbot", async (req, res) => {
  try {
    const { query } = req.body;

    if (!query) return res.json({ reply: "Please enter a query." });

    // Basic rule-based responses
    if (query.toLowerCase().includes("hello")) {
      return res.json({ reply: "Hello! 👋 I’m your finance assistant." });
    }

    if (query.match(/\d{4}-\d{2}-\d{2}/)) {
      // Search by exact date
      const records = await Record.find({ date: query });
      if (records.length === 0)
        return res.json({ reply: `No records found for ${query}` });

      const { income, expense } = records[0];
      const balance = income - expense;
      return res.json({
        reply: `On ${query}: Income = ₹${income}, Expense = ₹${expense}, Balance = ₹${balance}`,
      });
    }

    if (query.match(/^\d{4}$/)) {
      // Year search
      const year = Number(query);
      const records = await Record.find();
      let income = 0,
        expense = 0;
      records.forEach((r) => {
        if (new Date(r.date).getFullYear() === year) {
          income += r.income;
          expense += r.expense;
        }
      });
      return res.json({
        reply: `Year ${year}: Income = ₹${income}, Expense = ₹${expense}, Balance = ₹${
          income - expense
        }`,
      });
    }

    return res.json({
      reply: `I couldn’t understand your query: "${query}". Try giving a date (YYYY-MM-DD) or a year (YYYY).`,
    });
  } catch (err) {
    console.error("Chatbot error:", err);
    res.status(500).json({ reply: "Server error while processing chatbot request" });
  }
});

// Start Server
app.listen(PORT, () =>
  console.log(`🚀 Server running on http://localhost:${PORT}`)
);