import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { ApiError } from './types';
import { authStore } from '../app/auth/authStore';
import { authClient } from '../services/authClient';
import { getApiBaseUrl } from '../config/apiBaseUrl';
import { getRecord, getString, isRecord } from '../shared/typeGuards';

export const API_BASE_URL = getApiBaseUrl();

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

    const data: unknown = error.response?.data;
    const message = (() => {
      if (!isRecord(data)) {
        return typeof error.message === 'string' && error.message ? error.message : 'Unknown error';
      }

      const errObj = getRecord(data.error);
      const errMessage = errObj ? getString(errObj.message) : undefined;
      if (errMessage) return errMessage;

      const messageStr = getString(data.message);
      if (messageStr) return messageStr;

      const nestedMessage = getRecord(data.message);
      const nestedMessageStr = nestedMessage ? getString(nestedMessage.message) : undefined;
      if (nestedMessageStr) return nestedMessageStr;

      const nestedError = nestedMessage ? getRecord(nestedMessage.error) : undefined;
      const nestedErrorMessage = nestedError ? getString(nestedError.message) : undefined;
      if (nestedErrorMessage) return nestedErrorMessage;

      return typeof error.message === 'string' && error.message ? error.message : 'Unknown error';
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
