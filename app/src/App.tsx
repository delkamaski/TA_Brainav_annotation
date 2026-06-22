import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Toaster } from './components/ui/sonner';

import LoginPage from './pages/login'; 
import RegisterPage from './pages/register';
import HomePage from './pages/home';
import ProjectsPage from './pages/ProjectPage';
import GroupPage from './pages/GroupPage';
import DataPage from './pages/DataPage';
import DataDetailedPage from './pages/DataDetailedPage';
import ModelsPage from './pages/ModelsPage';
import ModelEditorPage from './pages/ModelEditorPage';
import TrainingPage from './pages/TrainingPage';
import InferencePage from './pages/InferencePage';

// Protected Route Wrapper
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />                
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      
      {/* Protected Routes */}
      <Route path="/home" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
      <Route path="/projects" element={<ProtectedRoute><ProjectsPage /></ProtectedRoute>} />
      <Route path="/projects/:projectId/groups" element={<ProtectedRoute><GroupPage /></ProtectedRoute>} />
      <Route path="/projects/:projectId/groups/:groupId/data" element={<ProtectedRoute><DataPage /></ProtectedRoute>} />
      <Route path="/projects/:projectId/groups/:groupId/data/:id" element={<ProtectedRoute><DataDetailedPage /></ProtectedRoute>} />
      <Route path="/models" element={<ProtectedRoute><ModelsPage /></ProtectedRoute>} />
      <Route path="/models/:modelId/editor" element={<ProtectedRoute><ModelEditorPage /></ProtectedRoute>} />
      <Route path="/training" element={<ProtectedRoute><TrainingPage /></ProtectedRoute>} />
      <Route path="/inference" element={<ProtectedRoute><InferencePage /></ProtectedRoute>} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        <Toaster position="top-right" richColors />
      </BrowserRouter>
    </AuthProvider>
  );
}