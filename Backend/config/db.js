const mongoose = require("mongoose");

const connectDB = async () => {
  const mongoURI = process.env.MONGO_URI;

  if (!mongoURI) {
    console.error("FATAL ERROR: MONGO_URI is not defined in environment variables (.env).");
    process.exit(1);
  }

  // Configure Mongoose event listeners for persistent connection monitoring
  mongoose.connection.on("connected", () => {
    console.log("MongoDB Connection established successfully.");
  });

  mongoose.connection.on("error", (err) => {
    console.error(`MongoDB Connection Error: ${err.message}`);
  });

  mongoose.connection.on("disconnected", () => {
    console.warn("MongoDB Connection disconnected. Attempting reconnect...");
  });

  try {
    const options = {
      serverSelectionTimeoutMS: 10000, // Timeout after 10s instead of hanging
      socketTimeoutMS: 45000,
    };

    await mongoose.connect(mongoURI, options);
    console.log(`MongoDB Connected Successfully to cluster host: ${mongoose.connection.host}`);
  } catch (error) {
    console.error("=================================================");
    console.error("MongoDB Connection Failed:");
    console.error(`Error Message: ${error.message}`);
    
    if (error.message.includes("bad auth") || error.message.includes("Authentication failed")) {
      console.error("\n[DIAGNOSTIC GUIDANCE: Authentication Failure]");
      console.error("1. Verify database username & password in Atlas (Database Access).");
      console.error("2. Ensure special characters in password are percent-encoded (e.g. encodeURIComponent).");
      console.error("3. Verify the user has readWrite permissions on target database.");
    } else if (error.message.includes("querySrv") || error.message.includes("ENOTFOUND")) {
      console.error("\n[DIAGNOSTIC GUIDANCE: DNS / Network Failure]");
      console.error("1. Verify cluster hostname in MONGO_URI.");
      console.error("2. Check internet connection & DNS resolution.");
    } else if (error.message.includes("selection timed out") || error.message.includes("MongooseServerSelectionError")) {
      console.error("\n[DIAGNOSTIC GUIDANCE: Network / IP Whitelist Failure]");
      console.error("1. Ensure your IP address is whitelisted in MongoDB Atlas (Network Access -> 0.0.0.0/0 for dev).");
    }
    console.error("=================================================");
    
    // In production environment, fail fast on DB connection error
    if (process.env.NODE_ENV === "production") {
      process.exit(1);
    } else {
      throw error;
    }
  }
};

module.exports = connectDB;