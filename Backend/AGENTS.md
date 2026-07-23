# AGENTS.md

Welcome! This repository is configured to be agent-friendly. Please use this document to understand the codebase structure, coding guidelines, development workflow, and boundaries.

## 🚀 Project Overview
This project, `backend-26`, is a Node.js and Express-based backend application. It exposes a REST API for managing student records, storing and retrieving data using MongoDB via Mongoose.

- **Primary Stack:** Node.js, Express.js, Mongoose (MongoDB)
- **Port:** The server runs on port `5000` by default (defined in [bin/www](file:///D:/Coding/Internship/backend-26/backend-26/bin/www)).

---

## 📂 Directory Structure & Key Files

- [bin/www](file:///D:/Coding/Internship/backend-26/backend-26/bin/www) - Server entry point. Normalizes port, configures the HTTP server, and starts listening.
- [app.js](file:///D:/Coding/Internship/backend-26/backend-26/app.js) - Express application initialization. Configures middleware (logger, cookie parser, json/url-encoded parser, static assets), establishes MongoDB connection, and mounts API routers.
- [config/db.js](file:///D:/Coding/Internship/backend-26/backend-26/config/db.js) - Database connection utility. Connects to MongoDB using the URI specified in the environment variables.
- [models/Student.js](file:///D:/Coding/Internship/backend-26/backend-26/models/Student.js) - Mongoose schema and model definition for a `Student` entity (name, email, age).
- [routes/students.js](file:///D:/Coding/Internship/backend-26/backend-26/routes/students.js) - CRUD endpoints for managing student records.
- [.env](file:///D:/Coding/Internship/backend-26/backend-26/.env) - Holds environment variables such as `MONGO_URI`.

---

## 🛠️ Setup & Commands

### Installing Dependencies
```bash
npm install
```

### Starting the Server
```bash
npm start
```
By default, the server runs at `http://localhost:5000`.

---

## 📝 Coding Guidelines

When editing or extending this codebase, adhere to the following rules:

1. **Asynchronous Patterns:**
   - Always use `async/await` for database/Mongoose queries.
   - Wrap asynchronous blocks in `try/catch` and return clear error messages.
2. **Environment Variables:**
   - Do **NOT** hardcode sensitive configurations, credentials, or connection strings.
   - Always access variables via `process.env` (e.g. `process.env.MONGO_URI`).
3. **API Routing:**
   - Define all router logic under the [routes/](file:///D:/Coding/Internship/backend-26/backend-26/routes) directory.
   - Mount new routers in [app.js](file:///D:/Coding/Internship/backend-26/backend-26/app.js) following the existing patterns.
4. **Data Modeling:**
   - Define Mongoose schemas under [models/](file:///D:/Coding/Internship/backend-26/backend-26/models).
   - Ensure validations (e.g., `required`, types) are properly declared on schema properties.

---

## 🚫 Boundaries & Constraints

- **Env File Protection:** Do not modify the existing keys or overwrite credentials in [.env](file:///D:/Coding/Internship/backend-26/backend-26/.env) unless explicitly requested.
- **Port Conflicts:** Ensure any changes to port numbers or server configurations do not conflict with port `5000` unless requested.
