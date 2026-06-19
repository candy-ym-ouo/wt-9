import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import CalendarPage from './pages/CalendarPage';
import RolesPage from './pages/RolesPage';
import AnnotationsPage from './pages/AnnotationsPage';
import MaterialsPage from './pages/MaterialsPage';
import SearchPage from './pages/SearchPage';
import AdminPage from './pages/AdminPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" />;
  return <Layout>{children}</Layout>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { token, isAdmin } = useAuth();
  if (!token) return <Navigate to="/login" />;
  if (!isAdmin) return <Navigate to="/calendar" />;
  return <Layout>{children}</Layout>;
}

function AppRoutes() {
  const { token } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={token ? <Navigate to="/calendar" /> : <LoginPage />} />
      <Route path="/calendar" element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
      <Route path="/roles" element={<ProtectedRoute><RolesPage /></ProtectedRoute>} />
      <Route path="/annotations" element={<ProtectedRoute><AnnotationsPage /></ProtectedRoute>} />
      <Route path="/materials" element={<ProtectedRoute><MaterialsPage /></ProtectedRoute>} />
      <Route path="/search" element={<ProtectedRoute><SearchPage /></ProtectedRoute>} />
      <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
      <Route path="*" element={<Navigate to="/calendar" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
