import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 120000, // 120 second timeout
});

api.interceptors.request.use((config) => {
  // If an Authorization header is already explicitly provided, keep it
  if (config.headers?.Authorization) {
    return config;
  }

  // Use founderToken for founder routes, and adminToken for everything else
  if (config.url?.startsWith('/founder')) {
    const founderToken = localStorage.getItem('founderToken');
    if (founderToken) {
      config.headers.Authorization = `Bearer ${founderToken}`;
    }
  } else {
    const adminToken = localStorage.getItem('adminToken');
    if (adminToken) {
      config.headers.Authorization = `Bearer ${adminToken}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error Details:', {
      message: error.message,
      config: error.config?.url,
      code: error.code,
      status: error.response?.status,
    });
    return Promise.reject(error);
  }
);

export default api;
