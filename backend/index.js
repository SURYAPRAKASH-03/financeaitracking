import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import 'dotenv/config';
import { GoogleGenerativeAI } from "@google/generative-ai";

const app = express();
const PORT = process.env.PORT || 5000;
 
// Middleware
app.use(cors());
app.use(express.json());

// ---------------- MongoDB Connection ----------------
mongoose
  .connect("mongodb://127.0.0.1:27017/financeDB")
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// ---------------- Schemas & Models ----------------
const recordSchema = new mongoose.Schema({
  date: { type: String, required: true, unique: true },
  income: { type: Number, default: 0 },
  expense: { type: Number, default: 0 },
});

const loanSchema = new mongoose.Schema({
  person: { type: String, required: true },
  amount: { type: Number, required: true },
  interestRate: { type: Number, default: 0 }, // % per month
  paid: { type: Boolean, default: false },
  monthlyPaid: { type: Number, default: 0 },
  startDate: { type: String, default: new Date().toISOString().split("T")[0] },
});

const Record = mongoose.model("Record", recordSchema);
const Loan = mongoose.model("Loan", loanSchema);

// ---------------- API ROUTES ----------------

// 1️⃣ Records APIs
app.get("/api/records", async (req, res) => {
  try {
    const records = await Record.find().sort({ date: 1 });
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch records" });
  }
});

app.post("/api/records", async (req, res) => {
  try {
    const { date, income, expense } = req.body;

    let record = await Record.findOne({ date });
    if (record) {
      record.income = income;
      record.expense = expense;
      await record.save();
    } else {
      record = new Record({ date, income, expense });
      await record.save();
    }

    res.json(record);
  } catch (err) {
    res.status(500).json({ error: "Failed to save record" });
  }
});

// 2️⃣ Loans APIs
app.get("/api/loans", async (req, res) => {
  try {
    const loans = await Loan.find();
    res.json(loans);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch loans" });
  }
});

app.post("/api/loans", async (req, res) => {
  try {
    const { person, amount, interestRate } = req.body;
    const loan = new Loan({ person, amount, interestRate });
    await loan.save();
    res.json(loan);
  } catch (err) {
    res.status(500).json({ error: "Failed to save loan" });
  }
});

// Toggle Paid
app.put("/api/loans/:id/toggle", async (req, res) => {
  try {
    const loan = await Loan.findById(req.params.id);
    if (!loan) return res.status(404).json({ error: "Loan not found" });

    loan.paid = !loan.paid;
    await loan.save();
    res.json(loan);
  } catch (err) {
    res.status(500).json({ error: "Failed to toggle loan status" });
  }
});

// ---------------- Chatbot API ----------------
import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

app.post("/api/chatbot", async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) return res.json({ reply: "Please enter a query." });

    // Rule-based replies
    if (query.toLowerCase().includes("hello")) {
      return res.json({ reply: "Hello! 👋 I’m your finance assistant." });
    }

    // Date query
    if (query.match(/\d{4}-\d{2}-\d{2}/)) {
      const records = await Record.find({ date: query });
      if (records.length === 0)
        return res.json({ reply: `No records found for ${query}` });

      const { income, expense } = records[0];
      const balance = income - expense;
      return res.json({
        reply: `On ${query}: Income = ₹${income}, Expense = ₹${expense}, Balance = ₹${balance}`,
      });
    }

    // Year query
    if (query.match(/^\d{4}$/)) {
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

    // Fetch data for AI context
    const records = await Record.find().lean();
    const loans = await Loan.find().lean();
    const databaseContext = JSON.stringify({ records, loans });

    // Call Groq AI with context
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are a helpful financial assistant. The user has provided their financial data as a JSON object. Use this data to answer their questions. Here is the data: ${databaseContext}`
        },
        { 
          role: 'user', 
          content: query 
        }
      ],
      model: 'llama-3.3-70b-versatile',
    });

    const text = chatCompletion.choices[0]?.message?.content || "Sorry, I couldn't get a response.";

    return res.json({ reply: text });

  } catch (err) {
    console.error("Chatbot error:", err);
    res.status(500).json({ reply: "Server error while processing chatbot request" });
  }
});

// ---------------- Start Server ----------------
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});