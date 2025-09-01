import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AuthService } from '../services/hrService';
import { setAuthToken, removeAuthToken } from '../services/api';
import type { LoginCredentials, PasswordChangeRequest } from '../types';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

// Login mutation
export const useLogin = () => {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  
  return useMutation({
    mutationFn: (credentials: LoginCredentials) => AuthService.login(credentials),
    onSuccess: (data) => {
      setAuthToken(data.token);
      queryClient.setQueryData(['auth', 'user'], data.user);
      toast.success(t('toast.auth.welcomeBack', { name: data.user.name }));
    },
    onError: (error: Error) => {
      toast.error(t('toast.auth.loginFailed', { error: error.message }));
    },
  });
};

// Logout mutation
export const useLogout = () => {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  
  return useMutation({
    mutationFn: () => AuthService.logout(),
    onSuccess: () => {
      removeAuthToken();
      queryClient.clear();
      toast.success(t('toast.auth.loggedOut'));
    },
    onError: (error: Error) => {
      // Still clear local data even if server logout fails
      removeAuthToken();
      queryClient.clear();
      toast.error(t('toast.auth.logoutError', { error: error.message }));
    },
  });
};

// Change password mutation
export const useChangePassword = () => {
  const { t } = useTranslation();
  
  return useMutation({
    mutationFn: (passwords: PasswordChangeRequest) => AuthService.changePassword(passwords),
    onSuccess: () => {
      toast.success(t('toast.auth.passwordChanged'));
    },
    onError: (error: Error) => {
      toast.error(t('toast.auth.passwordChangeFailed', { error: error.message }));
    },
  });
};

// Get current user profile
export const useProfile = () => {
  return useQuery({
    queryKey: ['auth', 'user'],
    queryFn: () => AuthService.getProfile(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!localStorage.getItem('hr_token'), // Only run if token exists
    select: (data) => data.user,
  });
};

// Update profile mutation
export const useUpdateProfile = () => {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  
  return useMutation({
    mutationFn: (data: { name: string; email: string }) => AuthService.updateProfile(data),
    onSuccess: (data) => {
      queryClient.setQueryData(['auth', 'user'], data.user);
      toast.success(t('toast.auth.profileUpdated'));
    },
    onError: (error: Error) => {
      toast.error(t('toast.auth.profileUpdateFailed', { error: error.message }));
    },
  });
};

// Check if users exist (for initialization)
export const useCheckUsers = () => {
  return useQuery({
    queryKey: ['auth', 'check'],
    queryFn: () => AuthService.checkUsers(),
    staleTime: Infinity, // Only check once
  });
};

// Initialize default user (development only)
export const useInitializeDefault = () => {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  
  return useMutation({
    mutationFn: () => AuthService.initializeDefault(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth'] });
      toast.success(t('toast.auth.defaultUserCreated'));
    },
    onError: (error: Error) => {
      toast.error(t('toast.auth.initializationFailed', { error: error.message }));
    },
  });
};

// Custom hook to check authentication status
export const useAuthStatus = () => {
  const { data: user, isLoading, error } = useProfile();
  
  return {
    user,
    isAuthenticated: !!user && !error,
    isLoading,
    error,
  };
};