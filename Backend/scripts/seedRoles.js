require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");

const seedAccounts = [
  {
    email: "student@school.com",
    password: "Student123!",
    role: "user",
  },
  {
    email: "teacher@school.com",
    password: "Teacher123!",
    role: "teacher",
  },
  {
    email: "parent@school.com",
    password: "ParentPass2026!",
    role: "parent",
  },
  {
    email: "sarah.jenkins@parentportal.org",
    password: "ParentPass2026!",
    role: "parent",
  },
  {
    email: "admin@school.com",
    password: "Admin123!",
    role: "admin",
  },
];

const seedRoles = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB Atlas for Role Seeding...");

    for (const acc of seedAccounts) {
      let user = await User.findOne({ email: acc.email });
      if (!user) {
        user = new User(acc);
        await user.save();
        console.log(`Created [${acc.role}] account: ${acc.email}`);
      } else {
        console.log(`Account already exists: ${acc.email} (${user.role})`);
      }
    }

    console.log("Role seeding completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding role accounts:", error);
    process.exit(1);
  }
};

seedRoles();
