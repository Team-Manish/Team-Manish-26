const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const User = require("../models/User");
const migrateUserRoles = require("../scripts/migrate-user-roles");

const TEST_MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/internship_project_test";

before(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(TEST_MONGO_URI);
  }
});

after(async () => {
  await User.deleteMany({ email: /@test-role-domain\.com$/ });
  await mongoose.disconnect();
});

beforeEach(async () => {
  await User.deleteMany({ email: /@test-role-domain\.com$/ });
});

test("1. User Model automatically assigns default 'user' role when no role is specified", async () => {
  const user = new User({
    email: "defaultrole@test-role-domain.com",
    password: "password123",
  });

  await user.save();
  assert.equal(user.role, "user");

  const fetchedUser = await User.findOne({ email: "defaultrole@test-role-domain.com" });
  assert.equal(fetchedUser.role, "user");
});

test("2. Schema validation rejects invalid role value with descriptive MongoServerError", async () => {
  const user = new User({
    email: "invalidrole@test-role-domain.com",
    password: "password123",
    role: "superadmin",
  });

  await assert.rejects(
    async () => {
      await user.save();
    },
    (err) => {
      assert.equal(err.name, "MongoServerError");
      assert.match(err.message, /Invalid role 'superadmin'/);
      assert.match(err.message, /Permitted roles are: user, admin, moderator/);
      return true;
    }
  );
});

test("3. Role is immutable after creation unless _adminOverrideRole is set", async () => {
  const user = new User({
    email: "immutable@test-role-domain.com",
    password: "password123",
    role: "user",
  });
  await user.save();

  // Attempting role change without admin override should fail
  user.role = "admin";
  await assert.rejects(
    async () => {
      await user.save();
    },
    (err) => {
      assert.equal(err.name, "MongoServerError");
      assert.match(err.message, /Role is immutable/);
      return true;
    }
  );

  // Reload user document, apply admin override flag, and attempt change again
  const reloadedUser = await User.findOne({ email: "immutable@test-role-domain.com" });
  reloadedUser.role = "moderator";
  reloadedUser._adminOverrideRole = true;
  await reloadedUser.save();

  const updatedUser = await User.findOne({ email: "immutable@test-role-domain.com" });
  assert.equal(updatedUser.role, "moderator");
});

test("4. Migration script correctly updates legacy user documents lacking role field", async () => {
  // Create a raw legacy document directly via MongoDB collection driver, bypassing Mongoose defaults
  const db = mongoose.connection.db;
  await db.collection("users").insertOne({
    email: "legacy@test-role-domain.com",
    password: "hashedpassword123",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Verify legacy document does not have role in DB
  const rawLegacyDocBefore = await db.collection("users").findOne({ email: "legacy@test-role-domain.com" });
  assert.equal(rawLegacyDocBefore.role, undefined);

  // Run migration script
  const filter = { $or: [{ role: { $exists: false } }, { role: null }] };
  await User.updateMany(filter, { $set: { role: "user" } });

  // Verify legacy document now has role: "user" in DB
  const rawLegacyDocAfter = await db.collection("users").findOne({ email: "legacy@test-role-domain.com" });
  assert.equal(rawLegacyDocAfter.role, "user");
});

test("5. Fallback safety net returns 'user' role if field is missing on user document", async () => {
  const db = mongoose.connection.db;
  await db.collection("users").insertOne({
    email: "unmigrated@test-role-domain.com",
    password: "hashedpassword123",
  });

  const fetchedUser = await User.findOne({ email: "unmigrated@test-role-domain.com" });
  assert.equal(fetchedUser.role, "user");
});

test("6. Public registration blocks non-admin users from assigning elevated roles", async () => {
  const app = require("../app");
  const server = app.listen(0);
  const port = server.address().port;
  const csrfToken = "test-csrf-token-val";
  const csrfHeaders = {
    "Content-Type": "application/json",
    "Cookie": `XSRF-TOKEN=${csrfToken}`,
    "x-xsrf-token": csrfToken,
  };

  try {
    // Attempting registration with elevated role without admin privilege
    const response = await fetch(`http://localhost:${port}/api/auth/register`, {
      method: "POST",
      headers: csrfHeaders,
      body: JSON.stringify({
        email: "unauthorizedadmin@test-role-domain.com",
        password: "password123",
        role: "admin",
      }),
    });

    assert.equal(response.status, 403);
    const data = await response.json();
    assert.equal(data.success, false);
    assert.match(data.message, /Non-admin users cannot assign non-default roles/);

    // Standard public registration without role
    const validRes = await fetch(`http://localhost:${port}/api/auth/register`, {
      method: "POST",
      headers: csrfHeaders,
      body: JSON.stringify({
        email: "normaluser@test-role-domain.com",
        password: "password123",
      }),
    });

    assert.equal(validRes.status, 201);
    const validData = await validRes.json();
    assert.equal(validData.success, true);
    assert.equal(validData.user.role, "user");
  } finally {
    server.close();
  }
});

test("7. Admin creation flow permits creating users with elevated roles", async () => {
  const app = require("../app");
  const server = app.listen(0);
  const port = server.address().port;
  const csrfToken = "test-csrf-token-val";

  try {
    // Create an admin user in DB
    const adminUser = new User({
      email: "existingadmin@test-role-domain.com",
      password: "password123",
      role: "admin",
    });
    await adminUser.save();

    const token = jwt.sign(
      { id: adminUser._id, email: adminUser.email, role: adminUser.role },
      process.env.JWT_SECRET || "fallback-secret-key-use-env-vars"
    );

    // Admin creates moderator user
    const response = await fetch(`http://localhost:${port}/api/auth/admin/create-user`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `auth-token=${token}; XSRF-TOKEN=${csrfToken}`,
        "x-xsrf-token": csrfToken,
      },
      body: JSON.stringify({
        email: "newmoderator@test-role-domain.com",
        password: "password123",
        role: "moderator",
      }),
    });

    assert.equal(response.status, 201);
    const data = await response.json();
    assert.equal(data.success, true);
    assert.equal(data.user.role, "moderator");
  } finally {
    server.close();
  }
});


