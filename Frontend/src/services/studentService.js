import { fetchCsrfToken } from "../auth/authService";

const getBackendOrigin = () => {
  if (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_BACKEND_URL) {
    return import.meta.env.VITE_BACKEND_URL;
  }
  return typeof window !== "undefined" ? window.location.origin : "http://localhost:5000";
};

const API_STUDENTS_URL = `${getBackendOrigin()}/students`;

export const getStudents = async () => {
  const response = await fetch(API_STUDENTS_URL, {
    credentials: "include",
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to fetch students");
  }
  return await response.json();
};

export const createStudent = async (studentData) => {
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
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to create student");
  }
  return await response.json();
};

export const updateStudent = async (id, studentData) => {
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
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to update student");
  }
  return await response.json();
};

export const deleteStudent = async (id) => {
  const token = await fetchCsrfToken();
  const response = await fetch(`${API_STUDENTS_URL}/${id}`, {
    method: "DELETE",
    headers: {
      "X-XSRF-TOKEN": token,
    },
    credentials: "include",
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to delete student");
  }
  return await response.json();
};
