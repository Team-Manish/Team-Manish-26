const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const ALLOWED_ROLES = ["user", "admin", "moderator"];

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, "Email is required"],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, "Please enter a valid email"],
  },
  password: {
    type: String,
    required: [true, "Password is required"],
    minlength: [8, "Password must be at least 8 characters long"],
  },
  role: {
    type: String,
    required: [true, "Role is required"],
    enum: {
      values: ALLOWED_ROLES,
      message: "Invalid role '{VALUE}'. Permitted roles are: user, admin, moderator",
    },
    default: "user",
    get: (v) => v || "user",
  },
  status: {
    type: String,
    enum: ["active", "suspended", "pending", "deleted"],
    default: "active",
    get: (v) => v || "active",
  },
}, {
  timestamps: true,
  toObject: { getters: true },
  toJSON: { getters: true },
});

// Explicit index on role field for fast role-filtered searches
userSchema.index({ role: 1 });

// Schema-level validation throwing a descriptive MongoServerError on invalid role value
userSchema.pre("validate", function () {
  if (this.role && !ALLOWED_ROLES.includes(this.role)) {
    const err = new Error(`Invalid role '${this.role}'. Permitted roles are: ${ALLOWED_ROLES.join(", ")}`);
    err.name = "MongoServerError";
    throw err;
  }
});

// Pre-save hook: set default role on creation & enforce immutability on update unless admin override flag is present
userSchema.pre("save", async function () {
  if (this.isNew && !this.role) {
    this.role = "user";
  }

  if (!this.isNew && this.isModified("role")) {
    if (!this._adminOverrideRole) {
      const err = new Error("Role is immutable and cannot be modified without admin override permission");
      err.name = "MongoServerError";
      throw err;
    }
  }

  if (!this.isModified("password")) {
    return;
  }

  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

// Fallback safety net for legacy/unmigrated documents missing the role property
userSchema.post(["find", "findOne", "init"], function (docs) {
  if (!docs) return;
  const list = Array.isArray(docs) ? docs : [docs];
  list.forEach((doc) => {
    if (doc && doc._doc && !doc._doc.role) {
      doc._doc.role = "user";
    } else if (doc && !doc.role) {
      doc.role = "user";
    }
  });
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", userSchema);

