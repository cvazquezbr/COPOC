import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Pages
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import BriefingPage from './pages/BriefingPage';
import BriefingTemplatePage from './pages/BriefingTemplatePage';

// Context
import { useUserAuth } from './context/UserAuthContext';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useUserAuth();

  if (loading) {
    return <div>Carregando...</div>; // Or a loading spinner
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />

      {/* Protected Routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <BriefingPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/briefing-template"
        element={
          <ProtectedRoute>
            <BriefingTemplatePage />
          </ProtectedRoute>
        }
      />

      {/* Fallback for non-matching routes */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;

