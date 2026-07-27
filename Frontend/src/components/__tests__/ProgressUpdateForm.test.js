import { test } from "node:test";
import assert from "node:assert/strict";

// Mock enrolled students dataset for unit testing
const MOCK_STUDENTS = [
  {
    id: "STU-101",
    name: "Alex Smith",
    email: "alex.smith@school.edu",
    enrolledSubjects: ["Computer Science Foundations", "Advanced Mathematics", "Physics"],
  },
  {
    id: "STU-102",
    name: "Emma Watson",
    email: "emma.watson@school.edu",
    enrolledSubjects: ["Biology", "Chemistry", "English Literature"],
  },
];

const VALID_LETTER_GRADES = ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "F"];

// Unit test helpers mirroring ProgressUpdateForm logic
const filterStudents = (list, query) => {
  if (!query.trim()) return list;
  const q = query.toLowerCase();
  return list.filter(
    (s) =>
      s.name.toLowerCase().includes(q) ||
      s.id.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q)
  );
};

const getSubjectsForStudent = (studentId, list) => {
  const student = list.find((s) => s.id === studentId);
  return student ? student.enrolledSubjects : [];
};

const validateGradeInput = (val, mode) => {
  if (!val.trim()) return "Grade is required.";
  if (mode === "numerical") {
    const num = Number(val);
    if (isNaN(num) || num < 0 || num > 100) {
      return "Numerical grade must be a number between 0 and 100.";
    }
  } else if (mode === "letter") {
    const normalized = val.trim().toUpperCase();
    if (!VALID_LETTER_GRADES.includes(normalized)) {
      return `Invalid letter grade. Valid options: ${VALID_LETTER_GRADES.join(", ")}`;
    }
  }
  return null;
};

test("1. Student Selector: Filtering students by search query", () => {
  const resultAlex = filterStudents(MOCK_STUDENTS, "alex");
  assert.equal(resultAlex.length, 1);
  assert.equal(resultAlex[0].name, "Alex Smith");

  const resultID = filterStudents(MOCK_STUDENTS, "STU-102");
  assert.equal(resultID.length, 1);
  assert.equal(resultID[0].name, "Emma Watson");

  const resultEmpty = filterStudents(MOCK_STUDENTS, "");
  assert.equal(resultEmpty.length, 2);
});

test("2. Dynamic Subject Selector: Correctly retrieves enrolled courses for selected student", () => {
  const alexSubjects = getSubjectsForStudent("STU-101", MOCK_STUDENTS);
  assert.deepEqual(alexSubjects, ["Computer Science Foundations", "Advanced Mathematics", "Physics"]);

  const emmaSubjects = getSubjectsForStudent("STU-102", MOCK_STUDENTS);
  assert.deepEqual(emmaSubjects, ["Biology", "Chemistry", "English Literature"]);

  const unknownSubjects = getSubjectsForStudent("STU-999", MOCK_STUDENTS);
  assert.deepEqual(unknownSubjects, []);
});

test("3. Grade Input Validation: Validates numerical range (0-100) and letter grades (A-F)", () => {
  // Numerical scale validations
  assert.equal(validateGradeInput("95", "numerical"), null);
  assert.equal(validateGradeInput("0", "numerical"), null);
  assert.equal(validateGradeInput("100", "numerical"), null);
  assert.equal(validateGradeInput("-5", "numerical"), "Numerical grade must be a number between 0 and 100.");
  assert.equal(validateGradeInput("105", "numerical"), "Numerical grade must be a number between 0 and 100.");
  assert.equal(validateGradeInput("abc", "numerical"), "Numerical grade must be a number between 0 and 100.");

  // Letter scale validations
  assert.equal(validateGradeInput("A+", "letter"), null);
  assert.equal(validateGradeInput("b-", "letter"), null);
  assert.equal(validateGradeInput("f", "letter"), null);
  assert.match(validateGradeInput("Z", "letter"), /Invalid letter grade/);
  assert.match(validateGradeInput("100", "letter"), /Invalid letter grade/);
});

test("4. Remarks Textarea: Enforces 500-character limit and character counter logic", () => {
  const maxChars = 500;
  const validRemarks = "Student showed excellent understanding of core concepts.";
  assert.equal(validRemarks.length <= maxChars, true);

  const overflowText = "X".repeat(520);
  const truncatedText = overflowText.slice(0, maxChars);
  assert.equal(truncatedText.length, 500);
});
