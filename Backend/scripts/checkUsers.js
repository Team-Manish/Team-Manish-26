require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");

const checkUsers = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    const users = await User.find();
    console.log("Users in database:");
    users.forEach((user) => {
      console.log("- Email:", user.email, "- Role:", user.role, "- ID:", user._id);
    });

    if (users.length === 0) {
      console.log("No users found!");
    }

    process.exit(0);
  } catch (error) {
    console.error("Error checking users:", error);
    process.exit(1);
  }
};

checkUsers();
