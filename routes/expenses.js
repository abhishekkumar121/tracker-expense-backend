const express = require("express");
const router = express.Router();
const Expense = require("../models/Expense");
const authMiddleware = require("../middleware/auth");
const isPremiumMiddleware = require("../middleware/isPremium");
const json2csv = require("json2csv").parse;
const fs = require("fs");
const path = require("path");

// @route   GET /api/expenses
// @desc    Get all expenses for a user
// @access  Private
router.get("/", authMiddleware, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1; // Default to page 1 if no page is provided
    const limit = parseInt(req.query.limit) || 5; // Default limit to 5 items per page
    const expenses = await Expense.find({ user: req.user.id })
      .sort({ date: -1 })
      .skip((page - 1) * limit) // Skip based on page
      .limit(limit); // Limit the results
    // res.json(expenses);
    const totalExpenses = await Expense.countDocuments({ user: req.user.id });

    res.json({
      expenses,
      currentPage: page,
      totalPages: Math.ceil(totalExpenses / limit),
      totalExpenses,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// @route   POST /api/expenses
// @desc    Add new expense
// @access  Private
router.post("/", authMiddleware, async (req, res) => {
  const { description, amount, category } = req.body;

  try {
    const newExpense = new Expense({
      user: req.user.id,
      description,
      amount,
      category,
    });

    const expense = await newExpense.save();
    res.json(expense);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// @route   PUT /api/expenses/:id
// @desc    Update expense
// @access  Private
router.put("/:id", authMiddleware, async (req, res) => {
  const { description, amount, category } = req.body;

  // Build expense object
  const expenseFields = {};
  if (description) expenseFields.description = description;
  if (amount) expenseFields.amount = amount;
  if (category) expenseFields.category = category;

  try {
    let expense = await Expense.findById(req.params.id);

    if (!expense) return res.status(404).json({ msg: "Expense not found" });

    // Ensure user owns expense
    if (expense.user.toString() !== req.user.id) {
      return res.status(401).json({ msg: "Not authorized" });
    }

    expense = await Expense.findByIdAndUpdate(
      req.params.id,
      { $set: expenseFields },
      { new: true }
    );

    res.json(expense);
  } catch (err) {
    console.error(err.message);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ msg: "Expense not found" });
    }
    res.status(500).send("Server error");
  }
});

// @route   DELETE /api/expenses/:id
// @desc    Delete expense
// @access  Private
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);

    if (!expense) return res.status(404).json({ msg: "Expense not found" });

    // Ensure user owns expense
    if (expense.user.toString() !== req.user.id) {
      return res.status(401).json({ msg: "Not authorized" });
    }

    // await expense.remove();
    await Expense.findByIdAndDelete(req.params.id);

    res.json({ msg: "Expense removed" });

    // res.json({ msg: "Expense removed" });
  } catch (err) {
    console.error(err.message);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ msg: "Expense not found" });
    }
    res.status(500).send("Server error");
  }
});
// @route   GET /api/expenses/download
// @desc    Download all expenses as CSV (Available for all users)
// @access  Private
router.get("/download", authMiddleware, async (req, res) => {
  try {
    const expenses = await Expense.find({ user: req.user.id }).sort({
      date: -1,
    });

    if (expenses.length === 0) {
      return res.status(404).json({ msg: "No expenses found" });
    }

    const csv = json2csv(expenses, {
      fields: ["description", "amount", "category", "date"],
    });

    const filePath = path.join(
      __dirname,
      "../downloads",
      `${req.user.id}_expenses.csv`
    );
    fs.writeFileSync(filePath, csv);

    res.download(filePath, (err) => {
      if (err) {
        console.error(err);
        res.status(500).send("Server error");
      }
      fs.unlinkSync(filePath); // Delete the file after download
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

module.exports = router;
