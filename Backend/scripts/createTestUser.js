require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");

const createTestUser = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    const existingUser = await User.findOne({ email: "test@example.com" });
    if (existingUser) {
      console.log("Test user already exists");
      process.exit(0);
    }

    const testUser = new User({
      email: "test@example.com",
      password: "testpassword123",
      role: "user",
    });

    await testUser.save();
    console.log("Test user created successfully!");
    console.log("Email: test@example.com");
    console.log("Password: testpassword123");
    process.exit(0);
  } catch (error) {
    console.error("Error creating test user:", error);
    process.exit(1);
  }
};

createTestUser();
