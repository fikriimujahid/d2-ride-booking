import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { ApiError } from './types';
import { authStore } from '../app/auth/authStore';
import { authClient } from '../services/authClient';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

function getAccessToken(): string | null {
  return authStore.getAccessToken();
}

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor
client.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Track if we're currently refreshing to avoid multiple refresh calls
let isRefreshing = false;
let refreshPromise: Promise<void> | null = null;

// Response Interceptor with automatic token refresh
client.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    const status = error.response?.status;
    
    // Handle 401 (Unauthorized) - Try to refresh token
    if (status === 401 && !originalRequest._retry) {
      // Only retry once
      originalRequest._retry = true;

      // Check if we have a refresh token
      const refreshToken = authStore.getRefreshToken();
      if (refreshToken) {
        try {
          // If already refreshing, wait for that to complete
          if (isRefreshing && refreshPromise) {
            await refreshPromise;
          } else {
            // Start refresh process
            isRefreshing = true;
            refreshPromise = authClient.refresh();
            await refreshPromise;
            isRefreshing = false;
            refreshPromise = null;
          }

          // Retry original request with new token
          const newToken = authStore.getAccessToken();
          if (newToken && originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
          }
          return client(originalRequest);
        } catch (refreshError) {
          // Refresh failed - logout user
          isRefreshing = false;
          refreshPromise = null;
          authClient.clear();
          window.location.href = '/login';
          return Promise.reject(refreshError);
        }
      } else {
        // No refresh token - logout
        authClient.clear();
        window.location.href = '/login';
      }
    }

    // Handle 403 (Forbidden) - User lacks permission
    if (status === 403) {
      // Don't auto-logout, let UI handle forbidden state
      console.warn('Access forbidden - insufficient permissions');
    }

    const data: any = error.response?.data;
    const message = (() => {
      // Backend may return various error shapes:
      // - { message: "..." }
      // - { error: "...", message: "..." }
      // - { message: { message: "...", error: { code, message } } }
      if (typeof data?.error?.message === 'string') return data.error.message;
      if (typeof data?.message === 'string') return data.message;
      if (typeof data?.message?.message === 'string') return data.message.message;
      if (typeof data?.message?.error?.message === 'string') return data.message.error.message;
      if (typeof error.message === 'string' && error.message) return error.message;
      return 'Unknown error';
    })();

    const apiError: ApiError = {
        status: status || 500,
        message,
        data
    };

    return Promise.reject(apiError);
  }
);

export default client;
