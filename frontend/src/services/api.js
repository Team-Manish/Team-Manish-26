import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
};

export const attendanceAPI = {
  mark: (data) => api.post('/attendance', data),
  getByClassAndDate: (classId, date) =>
    api.get('/attendance', { params: { classId, date } }),
  getSummary: (classId, startDate, endDate) =>
    api.get('/attendance/summary', { params: { classId, startDate, endDate } }),
  getStudentAttendance: (studentId, params) =>
    api.get(`/attendance/student/${studentId}`, { params }),
  delete: (id) => api.delete(`/attendance/${id}`),
  deleteByClassAndDate: (classId, date) =>
    api.delete('/attendance', { params: { classId, date } }),
};

export const studentAPI = {
  getAll: () => api.get('/students'),
  getByClass: (classId) => api.get(`/students/class/${classId}`),
  getOne: (id) => api.get(`/students/${id}`),
  create: (data) => api.post('/students', data),
  update: (id, data) => api.put(`/students/${id}`, data),
  delete: (id) => api.delete(`/students/${id}`),
};

export const classAPI = {
  getAll: () => api.get('/classes'),
  getOne: (id) => api.get(`/classes/${id}`),
  create: (data) => api.post('/classes', data),
};

export const progressAPI = {
  getByStudent: (studentId, params) => api.get(`/progress/student/${studentId}`, { params }),
  getParentChild: (params) => api.get('/progress/my-child', { params }),
  create: (data) => api.post('/progress', data),
  update: (id, data) => api.put(`/progress/${id}`, data),
  delete: (id) => api.delete(`/progress/${id}`),
  getClassComparison: (params) => api.get('/progress/class-comparison', { params }),
};

export const userAPI = {
  getAll: (params) => api.get('/users', { params }),
};

export default api;
