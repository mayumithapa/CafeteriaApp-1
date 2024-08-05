const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// MongoDB connection
mongoose
  .connect(
    "mongodb+srv://othervarma:vzu357OxzN78LyNG@cafeteriaapp.f1d3z24.mongodb.net/?retryWrites=true&w=majority&appName=CafeteriaApp"
  )
  .then(() => console.log("Connected to DB"))
  .catch((err) => console.log(err));

// Item Sub-schema for Breakfast
const breakfastSchema = new mongoose.Schema({
  itemName: String,
  cost: String,
  dailyOrders: {
    monday: { type: Number, default: 0 },
    tuesday: { type: Number, default: 0 },
    wednesday: { type: Number, default: 0 },
    thursday: { type: Number, default: 0 },
    friday: { type: Number, default: 0 },
  },
});

// Item Sub-schema for Lunch
const lunchSchema = new mongoose.Schema({
  itemName: String,
  cost: String,
  dailyOrders: {
    monday: { type: Number, default: 0 },
    tuesday: { type: Number, default: 0 },
    wednesday: { type: Number, default: 0 },
    thursday: { type: Number, default: 0 },
    friday: { type: Number, default: 0 },
  },
});

// Main Item Schema
const itemsSchema = new mongoose.Schema({
  breakfast: [breakfastSchema],
  lunch: [lunchSchema],
  mealType: { type: String, enum: ["breakfast", "lunch"], required: true },
});

const Item = mongoose.model("Item", itemsSchema, "items");

// DailyOrder Sub-schema
const dailyOrderSchema = new mongoose.Schema({
  itemName: String,
  orderCount: { type: Number, default: 0 },
});

// User Schema
const usersSchema = new mongoose.Schema({
  name: String,
  totalOrders: {
    monday: { type: Number, default: 0 },
    tuesday: { type: Number, default: 0 },
    wednesday: { type: Number, default: 0 },
    thursday: { type: Number, default: 0 },
    friday: { type: Number, default: 0 },
  },
  dailyOrders: {
    monday: [dailyOrderSchema],
    tuesday: [dailyOrderSchema],
    wednesday: [dailyOrderSchema],
    thursday: [dailyOrderSchema],
    friday: [dailyOrderSchema],
  },
});

const User = mongoose.model("User", usersSchema, "users");

// Handle requests to the root URL
app.get("/", (req, res) => {
  res.send("Welcome to the API! Use /item, /users, or other endpoints.");
});

// Create a new item
app.post("/item", async (req, res) => {
  try {
    const { itemName, cost, mealType } = req.body;
    const newItem = new Item({
      mealType,
      ...(mealType === "breakfast"
        ? { breakfast: [{ itemName, cost }] }
        : { lunch: [{ itemName, cost }] }),
    });
    await newItem.save();
    res.status(201).send(newItem);
  } catch (err) {
    console.log(err);
    res.status(500).send({ message: "Error creating item", error: err });
  }
});

// Get all items
app.get("/items/:mealType", async (req, res) => {
  const { mealType } = req.params;
  const dayOfWeek = new Date().getDay();
  const days = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  const orderField = `dailyOrders.${days[dayOfWeek]}`;

  try {
    if (!["breakfast", "lunch"].includes(mealType)) {
      return res.status(400).send({ message: "Invalid mealType" });
    }

    const items = await Item.find();
    let sortedItems;

    if (mealType === "breakfast") {
      sortedItems = items
        .flatMap((item) => item.breakfast)
        .sort((a, b) => b[orderField] - a[orderField]);
    } else {
      sortedItems = items
        .flatMap((item) => item.lunch)
        .sort((a, b) => b[orderField] - a[orderField]);
    }

    res.json(sortedItems);
  } catch (err) {
    console.log(err);
    res.status(500).send({ message: "Error fetching items", error: err });
  }
});

// Update item's daily order count
app.post("/item", async (req, res) => {
  try {
    const { itemName, cost, mealType } = req.body;

    // Check if the mealType is valid
    if (!["breakfast", "lunch"].includes(mealType)) {
      return res.status(400).send({ message: "Invalid mealType" });
    }

    const update = {};
    if (mealType === "breakfast") {
      update["breakfast"] = { itemName, cost };
    } else {
      update["lunch"] = { itemName, cost };
    }

    const item = await Item.findOneAndUpdate(
      { [`${mealType}.itemName`]: itemName },
      { $set: update },
      { new: true, upsert: true } // upsert will create the document if it doesn't exist
    );

    res.status(201).send(item);
  } catch (err) {
    console.log(err);
    res.status(500).send({ message: "Error creating item", error: err });
  }
});

// Create a new user
app.post("/users", async (req, res) => {
  try {
    const data = new User(req.body);
    await data.save();
    res.status(201).send(data);
  } catch (err) {
    console.log(err);
    res.status(500).send({ message: "Error creating user", error: err });
  }
});

// Get all users
app.get("/users", async (req, res) => {
  try {
    const dayOfWeek = new Date().getDay(); // Get the current day of the week (0-6)
    const days = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];
    const orderField = `totalOrders.${days[dayOfWeek]}`;

    const users = await User.find().sort({ [orderField]: -1 });
    res.json(users);
  } catch (err) {
    console.log(err);
    res.status(500).send({ message: "Error fetching users", error: err });
  }
});

// Update user's daily order count
app.post("/update-user-orders", async (req, res) => {
  try {
    const { name, itemName } = req.body;
    const dayOfWeek = new Date().getDay(); // Get the current day of the week (0-6)
    const days = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];
    const updateDay = days[dayOfWeek];

    const user = await User.findOne({ name });
    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }

    const itemIndex = user.dailyOrders[updateDay].findIndex(
      (item) => item.itemName === itemName
    );
    if (itemIndex > -1) {
      user.dailyOrders[updateDay][itemIndex].orderCount += 1;
    } else {
      user.dailyOrders[updateDay].push({ itemName, orderCount: 1 });
    }

    user.totalOrders[updateDay] += 1;
    await user.save();

    res.status(200).send({ message: `User ${updateDay} orders updated`, user });
  } catch (err) {
    console.log(err);
    res.status(500).send({ message: "Error updating user orders", error: err });
  }
});

// Example Express route to handle reset
// Example Express route to handle reset
app.post("/reset", async (req, res) => {
  try {
    // Reset item counts and user orders, but keep names
    await User.updateMany({}, { $set: { totalOrders: {} } });
    await User.updateMany({}, { $set: { dailyOrders: {} } }); // Reset totalOrders
    // Reset totalOrders
    await Item.updateMany({}, { $set: { dailyOrders: {} } }); // Reset dailyOrders

    // Respond with success message
    res.status(200).send("Data reset successfully.");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error resetting data.");
  }
});

// New endpoint to get items sorted by user's order counts
app.post("/items-sorted-by-user", async (req, res) => {
  try {
    const { userName } = req.body;
    const dayOfWeek = new Date().getDay(); // Get the current day of the week (0-6)
    const days = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];
    const day = days[dayOfWeek];

    // Find the user
    const user = await User.findOne({ name: userName });
    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }

    // Create a mapping of item names to their order counts by the user
    const itemOrderCounts = {};
    user.dailyOrders[day].forEach((order) => {
      itemOrderCounts[order.itemName] = order.orderCount;
    });

    // Get all items and sort by the user's order count
    const items = await Item.find();
    items.sort((a, b) => {
      const aCount = itemOrderCounts[a.itemName] || 0;
      const bCount = itemOrderCounts[b.itemName] || 0;
      return bCount - aCount; // Descending order
    });

    res.json(items);
  } catch (err) {
    console.log(err);
    res.status(500).send({ message: "Error fetching items", error: err });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
