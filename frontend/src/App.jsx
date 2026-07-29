import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Attendance from './pages/Attendance';
import Progress from './pages/Progress';
import ParentPortal from './pages/ParentPortal';
import Admin from './pages/Admin';
import ClassComparison from './pages/ClassComparison';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Navbar />
        <main className="container">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/attendance" element={
              <ProtectedRoute roles={['teacher', 'admin']}>
                <Attendance />
              </ProtectedRoute>
            } />
            <Route path="/progress" element={
              <ProtectedRoute roles={['teacher', 'admin']}>
                <Progress />
              </ProtectedRoute>
            } />
            <Route path="/parent" element={
              <ProtectedRoute roles={['parent']}>
                <ParentPortal />
              </ProtectedRoute>
            } />
            <Route path="/admin" element={
              <ProtectedRoute roles={['admin']}>
                <Admin />
              </ProtectedRoute>
            } />
            <Route path="/admin/students" element={
              <ProtectedRoute roles={['admin']}>
                <Admin />
              </ProtectedRoute>
            } />
            <Route path="/admin/class-comparison" element={
              <ProtectedRoute roles={['admin']}>
                <ClassComparison />
              </ProtectedRoute>
            } />
            <Route path="*" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          </Routes>
        </main>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
