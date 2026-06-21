import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import RemindersPage from './pages/RemindersPage';
import CalendarPage from './pages/CalendarPage';
import PerformancesPage from './pages/PerformancesPage';
import RolesPage from './pages/RolesPage';
import AnnotationsPage from './pages/AnnotationsPage';
import MaterialsPage from './pages/MaterialsPage';
import SearchPage from './pages/SearchPage';
import AdminPage from './pages/AdminPage';
import LeavesPage from './pages/LeavesPage';
import AuditLogsPage from './pages/AuditLogsPage';
import ScriptsPage from './pages/ScriptsPage';
import ScriptDetailPage from './pages/ScriptDetailPage';
import ReportsPage from './pages/ReportsPage';
import DramasPage from './pages/DramasPage';
import TagsPage from './pages/TagsPage';
import DataExportPage from './pages/DataExportPage';

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
      <Route path="/login" element={token ? <Navigate to="/reminders" /> : <LoginPage />} />
      <Route path="/dramas" element={<ProtectedRoute><DramasPage /></ProtectedRoute>} />
      <Route path="/reminders" element={<ProtectedRoute><RemindersPage /></ProtectedRoute>} />
      <Route path="/calendar" element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
      <Route path="/performances" element={<ProtectedRoute><PerformancesPage /></ProtectedRoute>} />
      <Route path="/roles" element={<ProtectedRoute><RolesPage /></ProtectedRoute>} />
      <Route path="/leaves" element={<ProtectedRoute><LeavesPage /></ProtectedRoute>} />
      <Route path="/scripts" element={<ProtectedRoute><ScriptsPage /></ProtectedRoute>} />
      <Route path="/scripts/:id" element={<ProtectedRoute><ScriptDetailPage /></ProtectedRoute>} />
      <Route path="/annotations" element={<ProtectedRoute><AnnotationsPage /></ProtectedRoute>} />
      <Route path="/materials" element={<ProtectedRoute><MaterialsPage /></ProtectedRoute>} />
      <Route path="/search" element={<ProtectedRoute><SearchPage /></ProtectedRoute>} />
      <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
      <Route path="/audit-logs" element={<AdminRoute><AuditLogsPage /></AdminRoute>} />
      <Route path="/reports" element={<AdminRoute><ReportsPage /></AdminRoute>} />
      <Route path="/tags" element={<ProtectedRoute><TagsPage /></ProtectedRoute>} />
      <Route path="/data-export" element={<AdminRoute><DataExportPage /></AdminRoute>} />
      <Route path="*" element={<Navigate to="/reminders" />} />
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
