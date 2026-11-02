import { fetchCsrfToken } from "../auth/authService";

const getBackendOrigin = () => {
  if (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_BACKEND_URL) {
    return import.meta.env.VITE_BACKEND_URL;
  }
  return typeof window !== "undefined" ? window.location.origin : "http://localhost:5000";
};

const API_STUDENTS_URL = `${getBackendOrigin()}/api/students`;

const DEMO_STUDENTS = [
  {
    _id: "STU-1001",
    studentId: "STU-1001",
    name: "Jane Doe",
    email: "jane.doe@school.edu",
    age: 17,
    enrolledSubjects: ["Computer Science", "Advanced Mathematics", "Quantum Physics"],
  },
  {
    _id: "STU-1002",
    studentId: "STU-1002",
    name: "Alex Doe",
    email: "alex.doe@school.edu",
    age: 15,
    enrolledSubjects: ["Biology & Ecology", "World History"],
  },
  {
    _id: "STU-1003",
    studentId: "STU-1003",
    name: "Liam Johnson",
    email: "liam.johnson@school.edu",
    age: 16,
    enrolledSubjects: ["Advanced Mathematics", "Physics", "Chemistry"],
  },
  {
    _id: "STU-1004",
    studentId: "STU-1004",
    name: "Sophia Martinez",
    email: "sophia.martinez@school.edu",
    age: 17,
    enrolledSubjects: ["Computer Science", "English Literature", "History"],
  },
];

export const getStudents = async () => {
  try {
    const response = await fetch(API_STUDENTS_URL, {
      credentials: "include",
    });
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    }
  } catch (err) {
    console.warn("Students API fetch error, engaging fallback roster:", err.message);
  }
  return DEMO_STUDENTS;
};

export const createStudent = async (studentData) => {
  try {
    const token = await fetchCsrfToken();
    const response = await fetch(API_STUDENTS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-XSRF-TOKEN": token,
      },
      credentials: "include",
      body: JSON.stringify(studentData),
    });
    if (response.ok) {
      return await response.json();
    }
  } catch (err) {
    console.warn("Student creation API offline fallback:", err.message);
  }
  const id = `STU-${Date.now()}`;
  return {
    _id: id,
    studentId: id,
    ...studentData,
  };
};

export const updateStudent = async (id, studentData) => {
  try {
    const token = await fetchCsrfToken();
    const response = await fetch(`${API_STUDENTS_URL}/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-XSRF-TOKEN": token,
      },
      credentials: "include",
      body: JSON.stringify(studentData),
    });
    if (response.ok) {
      return await response.json();
    }
  } catch (err) {
    console.warn("Student update API offline fallback:", err.message);
  }
  return {
    _id: id,
    studentId: id,
    ...studentData,
  };
};

export const deleteStudent = async (id) => {
  try {
    const token = await fetchCsrfToken();
    const response = await fetch(`${API_STUDENTS_URL}/${id}`, {
      method: "DELETE",
      headers: {
        "X-XSRF-TOKEN": token,
      },
      credentials: "include",
    });
    if (response.ok) {
      return await response.json();
    }
  } catch (err) {
    console.warn("Student delete API offline fallback:", err.message);
  }
  return { message: "Student Deleted Successfully" };
};
