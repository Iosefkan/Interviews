import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { LoadingStates } from '../ui/LoadingStates';
import type { ProtectedRouteProps } from '../../types';

/**
 * ProtectedRoute component that requires HR authentication
 * Redirects to login page if user is not authenticated
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <LoadingStates.Spinner size="lg" />
          <p className="mt-4 text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return (
      <Navigate 
        to="/login" 
        state={{ from: location.pathname }} 
        replace 
      />
    );
  }

  // Render protected content if authenticated
  return <>{children}</>;
};

/**
 * PublicRoute component for routes that don't require authentication
 * Redirects authenticated users to dashboard
 */
export const PublicRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <LoadingStates.Spinner size="lg" />
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to home if already authenticated (except for interview routes)
  if (isAuthenticated && !location.pathname.includes('/interview/')) {
    const from = (location.state as any)?.from || '/';
    return <Navigate to={from} replace />;
  }

  // Render public content
  return <>{children}</>;
};

/**
 * InterviewRoute component for public interview access
 * No authentication required, but validates session keys
 */
export const InterviewRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  // Interview routes are completely public - no authentication checks
  return <>{children}</>;
};

/**
 * ConditionalRoute component that renders different content based on auth status
 */
interface ConditionalRouteProps {
  authenticated: React.ReactNode;
  unauthenticated: React.ReactNode;
}

export const ConditionalRoute: React.FC<ConditionalRouteProps> = ({
  authenticated,
  unauthenticated,
}) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <LoadingStates.Spinner size="lg" />
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return <>{isAuthenticated ? authenticated : unauthenticated}</>;
};