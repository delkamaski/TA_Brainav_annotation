import axios from 'axios';

// Create a configured axios instance
export const api = axios.create({
  // Use empty string to rely on your Vite/CRA proxy, or set a full URL like 'http://localhost:8080'
  baseURL: 'http://localhost:8080', 
});

// Request Interceptor: Automatically inject the Bearer token into every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response Interceptor: Basic error logging and token expiration handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // If unauthorized, you could potentially trigger a token refresh here
      // or clear local storage and redirect to login.
      console.warn("Unauthorized API call - token may be invalid or expired.");
    }
    return Promise.reject(error);
  }
);