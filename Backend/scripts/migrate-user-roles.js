require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");

const migrateUserRoles = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/internship_project";
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB for role migration...");

    // Find all users where role field is missing or null
    const filter = {
      $or: [
        { role: { $exists: false } },
        { role: null },
      ],
    };

    const countToUpdate = await User.countDocuments(filter);
    console.log(`Found ${countToUpdate} legacy user document(s) missing 'role'.`);

    if (countToUpdate > 0) {
      const result = await User.updateMany(filter, { $set: { role: "user" } });
      console.log(`Successfully migrated ${result.modifiedCount} user document(s) with default role 'user'.`);
    } else {
      console.log("No legacy user documents require migration.");
    }

    await mongoose.disconnect();
    console.log("Migration complete. Disconnected from MongoDB.");
    return { success: true, count: countToUpdate };
  } catch (error) {
    console.error("Error running user roles migration:", error);
    throw error;
  }
};

if (require.main === module) {
  migrateUserRoles()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = migrateUserRoles;
