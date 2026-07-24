const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
require("dotenv").config();

const AcademicProgress = require("../models/AcademicProgress");

const TEST_MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb://localhost:27017/internship_project_academic_progress_test";

before(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(TEST_MONGO_URI);
  }
  // Ensure compound unique indexes are properly built in MongoDB
  await AcademicProgress.init();
});

after(async () => {
  await AcademicProgress.deleteMany({});
  await mongoose.disconnect();
});

beforeEach(async () => {
  await AcademicProgress.deleteMany({});
});

test("1. Valid Record: Creates and saves academic progress record with numeric grade", async () => {
  const record = new AcademicProgress({
    studentId: "STU-1001",
    subject: "Computer Science",
    grade: 85.5,
    remarks: "Excellent progress in data structures",
  });

  const saved = await record.save();
  assert.ok(saved._id);
  assert.equal(saved.studentId, "STU-1001");
  assert.equal(saved.subject, "Computer Science");
  assert.equal(saved.grade, 85.5);
  assert.equal(saved.remarks, "Excellent progress in data structures");
  assert.ok(saved.date instanceof Date);
  assert.ok(saved.createdAt instanceof Date);
  assert.ok(saved.updatedAt instanceof Date);
});

test("2. Valid Record: Creates and saves academic progress record with letter grade", async () => {
  const record = new AcademicProgress({
    studentId: "STU-1002",
    subject: "Advanced Mathematics",
    grade: "a-",
    remarks: "Great problem solving skills",
  });

  const saved = await record.save();
  assert.ok(saved._id);
  assert.equal(saved.studentId, "STU-1002");
  assert.equal(saved.subject, "Advanced Mathematics");
  assert.equal(saved.grade, "A-"); // Normalized to uppercase letter grade
});

test("3. Default Date: Assigns current date when date parameter is omitted", async () => {
  const beforeTime = Date.now() - 1000;
  const record = new AcademicProgress({
    studentId: "STU-1003",
    subject: "Physics",
    grade: 92,
  });

  const saved = await record.save();
  const afterTime = Date.now() + 1000;

  assert.ok(saved.date instanceof Date);
  const time = saved.date.getTime();
  assert.ok(time >= beforeTime && time <= afterTime);
});

test("4. Normalization Hook: Subject name is normalized to Title Case pre-save", async () => {
  const record = new AcademicProgress({
    studentId: "STU-1004",
    subject: "organic chemistry lab",
    grade: "B+",
  });

  await record.validate();
  assert.equal(record.subject, "Organic Chemistry Lab");

  const saved = await record.save();
  assert.equal(saved.subject, "Organic Chemistry Lab");
});

test("5. Validation Rejection: Missing required fields (studentId, subject, grade)", async () => {
  const record = new AcademicProgress({});

  await assert.rejects(
    async () => {
      await record.save();
    },
    (err) => {
      assert.equal(err.name, "ValidationError");
      assert.ok(err.errors.studentId);
      assert.ok(err.errors.subject);
      assert.ok(err.errors.grade);
      return true;
    }
  );
});

test("6. Validation Rejection: Invalid studentId formats (empty string, illegal characters)", async () => {
  const invalidIds = ["", "   ", "STU@123!", "S", "A".repeat(35)];

  for (const invalidId of invalidIds) {
    const record = new AcademicProgress({
      studentId: invalidId,
      subject: "Biology",
      grade: 90,
    });

    await assert.rejects(
      async () => {
        await record.save();
      },
      (err) => {
        assert.equal(err.name, "ValidationError");
        assert.ok(err.errors.studentId);
        assert.match(
          err.errors.studentId.message,
          /Invalid studentId format|studentId is required/
        );
        return true;
      }
    );
  }
});

test("7. Validation Rejection: Out-of-range numeric grades (< 0 or > 100)", async () => {
  const invalidGrades = [-1, -0.1, 100.1, 150];

  for (const invalidGrade of invalidGrades) {
    const record = new AcademicProgress({
      studentId: "STU-1005",
      subject: "History",
      grade: invalidGrade,
    });

    await assert.rejects(
      async () => {
        await record.save();
      },
      (err) => {
        assert.equal(err.name, "ValidationError");
        assert.ok(err.errors.grade);
        assert.match(err.errors.grade.message, /Invalid grade/);
        return true;
      }
    );
  }
});

test("8. Validation Rejection: Invalid string letter grades or malformed objects", async () => {
  const invalidGrades = ["Z", "A++", "INVALID", "GRADE_100", {}, [90]];

  for (const invalidGrade of invalidGrades) {
    const record = new AcademicProgress({
      studentId: "STU-1006",
      subject: "Literature",
      grade: invalidGrade,
    });

    await assert.rejects(
      async () => {
        await record.save();
      },
      (err) => {
        assert.equal(err.name, "ValidationError");
        assert.ok(err.errors.grade);
        assert.match(err.errors.grade.message, /Invalid grade/);
        return true;
      }
    );
  }
});

test("9. Validation Rejection: Invalid date values outside academic calendar limits", async () => {
  const invalidDates = ["not-a-date", new Date("1960-01-01"), new Date("2150-01-01")];

  for (const invalidDate of invalidDates) {
    const record = new AcademicProgress({
      studentId: "STU-1007",
      subject: "Economics",
      grade: 88,
      date: invalidDate,
    });

    await assert.rejects(
      async () => {
        await record.save();
      },
      (err) => {
        assert.equal(err.name, "ValidationError");
        assert.ok(err.errors.date);
        assert.match(err.errors.date.message, /Invalid date|Cast to date failed/);
        return true;
      }
    );
  }
});

test("10. Validation Rejection: Remarks exceeding 500 characters limit", async () => {
  const longRemarks = "A".repeat(501);
  const record = new AcademicProgress({
    studentId: "STU-1008",
    subject: "Art",
    grade: "A",
    remarks: longRemarks,
  });

  await assert.rejects(
    async () => {
      await record.save();
    },
    (err) => {
      assert.equal(err.name, "ValidationError");
      assert.ok(err.errors.remarks);
      assert.match(err.errors.remarks.message, /Remarks cannot exceed 500 characters/);
      return true;
    }
  );
});

test("11. Compound Index: Rejects duplicate progress records for same student and subject", async () => {
  const firstRecord = new AcademicProgress({
    studentId: "STU-1009",
    subject: "World History",
    grade: 88,
  });
  await firstRecord.save();

  const duplicateRecord = new AcademicProgress({
    studentId: "STU-1009",
    subject: "world history", // Pre-save title case will match "World History"
    grade: 92,
  });

  await assert.rejects(
    async () => {
      await duplicateRecord.save();
    },
    (err) => {
      // Duplicate key error code in MongoDB is 11000
      assert.equal(err.code, 11000);
      return true;
    }
  );
});

test("12. Index Verification: Schema exports compound index and field indexes", async () => {
  const indexes = AcademicProgress.schema.indexes();
  // Check for compound index on { studentId: 1, subject: 1 } with unique: true
  const compoundIndex = indexes.find(
    (idx) =>
      idx[0] &&
      idx[0].studentId === 1 &&
      idx[0].subject === 1 &&
      idx[1] &&
      idx[1].unique === true
  );

  assert.ok(compoundIndex, "Compound unique index on { studentId: 1, subject: 1 } must exist");
});
