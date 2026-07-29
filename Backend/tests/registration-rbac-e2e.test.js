const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const User = require("../models/User");
const Student = require("../models/Student");
const AcademicProgress = require("../models/AcademicProgress");
const app = require("../app");

const TEST_MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/internship_project_registration_test";
const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-key-use-env-vars";

let server;
let port;

before(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(TEST_MONGO_URI);
  }
  server = app.listen(0);
  port = server.address().port;
});

after(async () => {
  if (server) server.close();
  await User.deleteMany({ email: /@e2e-test-domain\.com$/ });
  await Student.deleteMany({ email: /@e2e-test-domain\.com$/ });
  await AcademicProgress.deleteMany({ studentId: /^STU-E2E/ });
  await mongoose.disconnect();
});

beforeEach(async () => {
  await User.deleteMany({ email: /@e2e-test-domain\.com$/ });
  await Student.deleteMany({ email: /@e2e-test-domain\.com$/ });
  await AcademicProgress.deleteMany({ studentId: /^STU-E2E/ });
});

// Helper function to get CSRF tokens and cookies
const getCsrfTokens = async () => {
  const res = await fetch(`http://localhost:${port}/api/csrf-token`);
  const data = await res.json();
  const setCookie = res.headers.get("set-cookie") || "";
  const match = setCookie.match(/XSRF-TOKEN=([^;]+)/);
  const cookieToken = match ? match[1] : data.csrfToken;
  return {
    csrfToken: data.csrfToken,
    cookieHeader: `XSRF-TOKEN=${cookieToken}`,
  };
};

// Helper function to generate auth token
const createTokenForUser = (userDoc) => {
  return jwt.sign(
    {
      id: userDoc._id,
      userId: userDoc.userId,
      email: userDoc.email,
      username: userDoc.username,
      role: userDoc.role,
      assignedStudentIds: userDoc.assignedStudentIds || [],
      linkedStudentIds: userDoc.linkedStudentIds || [],
    },
    JWT_SECRET
  );
};


test("E2E 1: Student Self-Registration and Unique Credential Validation", async () => {
  const csrf = await getCsrfTokens();
  const studentPayload = {
    name: "E2E Student One",
    email: "student1@e2e-test-domain.com",
    username: "e2estudent1",
    userId: "STU-E2E-001",
    password: "Password123!",
    age: 19,
    enrolledSubjects: ["Computer Science", "Physics"],
    assignedTeacherId: "TCH-E2E-100",
  };

  // 1. Successful student self-registration
  const res1 = await fetch(`http://localhost:${port}/api/auth/register-student`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-xsrf-token": csrf.csrfToken,
      Cookie: csrf.cookieHeader,
    },
    body: JSON.stringify(studentPayload),
  });

  assert.equal(res1.status, 201);
  const data1 = await res1.json();
  assert.equal(data1.success, true);
  assert.equal(data1.user.email, "student1@e2e-test-domain.com");

  // Verify MongoDB Atlas synchronization in Student collection
  const createdStudent = await Student.findOne({ email: "student1@e2e-test-domain.com" });
  assert.notEqual(createdStudent, null);
  assert.equal(createdStudent.studentId, "STU-E2E-001");
  assert.equal(createdStudent.name, "E2E Student One");

  // 2. Reject duplicate email attempt
  const resDuplicateEmail = await fetch(`http://localhost:${port}/api/auth/register-student`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-xsrf-token": csrf.csrfToken,
      Cookie: csrf.cookieHeader,
    },
    body: JSON.stringify({
      ...studentPayload,
      username: "unique_username_2",
      userId: "STU-E2E-002",
    }),
  });

  assert.equal(resDuplicateEmail.status, 400);
  const dataDupEmail = await resDuplicateEmail.json();
  assert.equal(dataDupEmail.success, false);
  assert.match(dataDupEmail.message, /Email address .* is already registered/);

  // 3. Reject duplicate username attempt
  const resDuplicateUsername = await fetch(`http://localhost:${port}/api/auth/register-student`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-xsrf-token": csrf.csrfToken,
      Cookie: csrf.cookieHeader,
    },
    body: JSON.stringify({
      ...studentPayload,
      email: "newstudent@e2e-test-domain.com",
      userId: "STU-E2E-003",
    }),
  });

  assert.equal(resDuplicateUsername.status, 400);
  const dataDupUser = await resDuplicateUsername.json();
  assert.equal(dataDupUser.success, false);
  assert.match(dataDupUser.message, /Username .* is already in use/);

  // 4. Reject duplicate userId attempt
  const resDuplicateUserId = await fetch(`http://localhost:${port}/api/auth/register-student`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-xsrf-token": csrf.csrfToken,
      Cookie: csrf.cookieHeader,
    },
    body: JSON.stringify({
      ...studentPayload,
      email: "anotherstudent@e2e-test-domain.com",
      username: "anotherstudent_uname",
    }),
  });

  assert.equal(resDuplicateUserId.status, 400);
  const dataDupId = await resDuplicateUserId.json();
  assert.equal(dataDupId.success, false);
  assert.match(dataDupId.message, /User ID .* is already in use/);
});

test("E2E 2: Admin Teacher Registration and Oversee Management", async () => {
  const csrf = await getCsrfTokens();
  // Create admin account
  const adminUser = new User({
    email: "admin@e2e-test-domain.com",
    username: "e2eadmin",
    userId: "ADM-E2E-001",
    password: "AdminPassword123!",
    role: "admin",
  });
  await adminUser.save();
  const adminToken = createTokenForUser(adminUser);

  // Admin registers new teacher account
  const teacherPayload = {
    name: "Dr. Alan Turing",
    email: "turing@e2e-test-domain.com",
    username: "alanturing",
    userId: "TCH-E2E-100",
    password: "TeacherPassword123!",
    department: "Computer Science",
  };

  const resRegTeacher = await fetch(`http://localhost:${port}/api/auth/admin/register-teacher`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
      "x-xsrf-token": csrf.csrfToken,
      Cookie: csrf.cookieHeader,
    },
    body: JSON.stringify(teacherPayload),
  });

  assert.equal(resRegTeacher.status, 201);
  const dataRegTeacher = await resRegTeacher.json();
  assert.equal(dataRegTeacher.success, true);
  assert.equal(dataRegTeacher.user.role, "teacher");

  // Admin oversees teacher profiles
  const resListTeachers = await fetch(`http://localhost:${port}/api/admin/teachers`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });

  assert.equal(resListTeachers.status, 200);
  const dataTeachers = await resListTeachers.json();
  assert.equal(dataTeachers.success, true);
  assert.ok(dataTeachers.count >= 1);
  assert.equal(dataTeachers.teachers.some(t => t.email === "turing@e2e-test-domain.com"), true);
});

test("E2E 3: Parent Access Control - Linked vs Unlinked Child Academic Progress", async () => {
  // Create student 1 (linked to parent)
  const student1 = new Student({
    studentId: "STU-E2E-LINKED",
    email: "linked_child@e2e-test-domain.com",
    username: "linked_child",
    name: "Linked Child",
    age: 15,
    enrolledSubjects: ["Mathematics"],
  });
  await student1.save();

  // Create academic progress record for student 1
  const progressDoc = new AcademicProgress({
    studentId: "STU-E2E-LINKED",
    subject: "Mathematics",
    grade: 95,
    date: new Date(),
  });
  await progressDoc.save();

  // Create student 2 (unlinked)
  const student2 = new Student({
    studentId: "STU-E2E-UNLINKED",
    email: "unlinked_child@e2e-test-domain.com",
    username: "unlinked_child",
    name: "Unlinked Child",
    age: 16,
    enrolledSubjects: ["History"],
  });
  await student2.save();

  // Create Parent User Account linked ONLY to STU-E2E-LINKED
  const parentUser = new User({
    email: "parent@e2e-test-domain.com",
    username: "e2eparent",
    userId: "PRN-E2E-001",
    password: "ParentPassword123!",
    role: "parent",
    linkedStudentIds: ["STU-E2E-LINKED"],
  });
  await parentUser.save();
  const parentToken = createTokenForUser(parentUser);

  // 1. Parent accesses linked child progress -> 200 OK
  const resLinked = await fetch(`http://localhost:${port}/api/parent/child-progress/STU-E2E-LINKED`, {
    headers: { Authorization: `Bearer ${parentToken}` },
  });

  assert.equal(resLinked.status, 200);
  const dataLinked = await resLinked.json();
  assert.equal(dataLinked.success, true);
  assert.equal(dataLinked.student.name, "Linked Child");

  // 2. Parent attempts to access UNLINKED child progress -> 403 Forbidden
  const resUnlinked = await fetch(`http://localhost:${port}/api/parent/child-progress/STU-E2E-UNLINKED`, {
    headers: { Authorization: `Bearer ${parentToken}` },
  });

  assert.equal(resUnlinked.status, 403);
  const dataUnlinked = await resUnlinked.json();
  assert.equal(dataUnlinked.success, false);
  assert.equal(dataUnlinked.error, "Forbidden");
  assert.match(dataUnlinked.message, /Parent account is not linked to this student/);
});

test("E2E 4: Teacher Access Control - Assigned vs Unassigned Student Edit Permissions", async () => {
  const csrf = await getCsrfTokens();

  // Create Teacher
  const teacherUser = new User({
    email: "teacher_eval@e2e-test-domain.com",
    username: "e2eteacher",
    userId: "TCH-E2E-EVAL",
    password: "TeacherPassword123!",
    role: "teacher",
    assignedStudentIds: ["STU-E2E-ASSIGNED"],
  });
  await teacherUser.save();
  const teacherToken = createTokenForUser(teacherUser);

  // Create Assigned Student
  const assignedStudent = new Student({
    studentId: "STU-E2E-ASSIGNED",
    email: "assigned_student@e2e-test-domain.com",
    name: "Assigned Student",
    age: 17,
    enrolledSubjects: ["Biology"],
    assignedTeacherId: "TCH-E2E-EVAL",
  });
  await assignedStudent.save();

  // Create Unassigned Student
  const unassignedStudent = new Student({
    studentId: "STU-E2E-OTHER",
    email: "other_student@e2e-test-domain.com",
    name: "Other Student",
    age: 17,
    enrolledSubjects: ["Chemistry"],
    assignedTeacherId: "TCH-DIFFERENT-TEACHER",
  });
  await unassignedStudent.save();

  // 1. Teacher edits assigned student -> 200 OK
  const resEditAssigned = await fetch(`http://localhost:${port}/api/teacher/students/STU-E2E-ASSIGNED`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${teacherToken}`,
      "x-xsrf-token": csrf.csrfToken,
      Cookie: csrf.cookieHeader,
    },
    body: JSON.stringify({ age: 18, name: "Assigned Student (Updated)" }),
  });

  assert.equal(resEditAssigned.status, 200);
  const dataEditAssigned = await resEditAssigned.json();
  assert.equal(dataEditAssigned.success, true);
  assert.equal(dataEditAssigned.student.name, "Assigned Student (Updated)");

  // 2. Teacher attempts to edit UNASSIGNED student -> 403 Forbidden
  const resEditUnassigned = await fetch(`http://localhost:${port}/api/teacher/students/STU-E2E-OTHER`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${teacherToken}`,
      "x-xsrf-token": csrf.csrfToken,
      Cookie: csrf.cookieHeader,
    },
    body: JSON.stringify({ age: 20 }),
  });

  assert.equal(resEditUnassigned.status, 403);
  const dataEditUnassigned = await resEditUnassigned.json();
  assert.equal(dataEditUnassigned.success, false);
  assert.equal(dataEditUnassigned.error, "Forbidden");
  assert.match(dataEditUnassigned.message, /Teachers can only edit details of their assigned students/);
});

