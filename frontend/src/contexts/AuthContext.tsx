import React, { createContext, useContext, useEffect, useState } from 'react';
import { useLogin, useLogout, useChangePassword, useUpdateProfile, useAuthStatus } from '../hooks/useAuthQueries';

import type { LoginCredentials, PasswordChangeRequest, AuthContextType } from '../types';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [token, setTokenState] = useState<string | null>(() => {
    return localStorage.getItem('hr_token');
  });

  const { user, isAuthenticated, isLoading: isLoadingUser } = useAuthStatus();
  const loginMutation = useLogin();
  const logoutMutation = useLogout();
  const changePasswordMutation = useChangePassword();
  const updateProfileMutation = useUpdateProfile();

  // Update token state when localStorage changes
  useEffect(() => {
    const handleStorageChange = () => {
      const newToken = localStorage.getItem('hr_token');
      setTokenState(newToken);
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const login = async (credentials: LoginCredentials): Promise<boolean> => {
    try {
      const result = await loginMutation.mutateAsync(credentials);
      setTokenState(result.token);
      return true;
    } catch (error) {
      console.error('Login failed:', error);
      return false;
    }
  };

  const logout = () => {
    logoutMutation.mutate();
    setTokenState(null);
  };

  const changePassword = async (passwords: PasswordChangeRequest): Promise<boolean> => {
    try {
      await changePasswordMutation.mutateAsync(passwords);
      return true;
    } catch (error) {
      console.error('Password change failed:', error);
      return false;
    }
  };

  const updateProfile = async (data: { name: string; email: string }): Promise<boolean> => {
    try {
      await updateProfileMutation.mutateAsync(data);
      return true;
    } catch (error) {
      console.error('Profile update failed:', error);
      return false;
    }
  };

  const contextValue: AuthContextType = {
    user: user || null,
    token,
    login,
    logout,
    changePassword,
    updateProfile,
    isAuthenticated: isAuthenticated || !!token, // Consider both user data and token
    isLoading: isLoadingUser || loginMutation.isPending || logoutMutation.isPending,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Hook to check if user is authenticated (for route protection)
export const useRequireAuth = () => {
  const { isAuthenticated, isLoading } = useAuth();
  
  return {
    isAuthenticated,
    isLoading,
    shouldRedirect: !isLoading && !isAuthenticated
  };
};