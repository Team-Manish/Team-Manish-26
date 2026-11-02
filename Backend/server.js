require("dotenv").config();
const http = require("http");
const mongoose = require("mongoose");
const app = require("./app");

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/internship_project_26";

const server = http.createServer(app);

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("Connected to MongoDB database successfully.");
    server.listen(PORT, () => {
      console.log(`Backend server listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.warn("Database connection warning:", err.message);
    server.listen(PORT, () => {
      console.log(`Backend server listening on port ${PORT} (Standalone mode)`);
    });
  });
