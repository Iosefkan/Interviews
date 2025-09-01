import axios from 'axios';

// Create axios instance
const api = axios.create({
  baseURL: '/api',
  timeout: 100000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Helper function to get auth token from localStorage
const getAuthToken = (): string | null => {
  return localStorage.getItem('hr_token');
};

// Helper function to set auth token in localStorage
export const setAuthToken = (token: string): void => {
  localStorage.setItem('hr_token', token);
};

// Helper function to remove auth token from localStorage
export const removeAuthToken = (): void => {
  localStorage.removeItem('hr_token');
};

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add auth token to requests if available
    const token = getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    // Handle authentication errors
    if (error.response?.status === 401) {
      // Remove invalid token and redirect to login
      removeAuthToken();
      
      // Only redirect if we're not already on a public page
      if (!window.location.pathname.includes('/interview/') && 
          !window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    
    const message = error.response?.data?.error || error.message || 'An error occurred';
    return Promise.reject(new Error(message));
  }
);

export default api;