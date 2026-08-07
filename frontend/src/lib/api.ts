import axios from 'axios';

const api = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL });

// Attach JWT from localStorage on every request
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Automatically handle expired or invalid token
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('user_id');
        window.location.href = '/';
      }
    }
    return Promise.reject(error);
  }
);

export const auth = {
  getToken: (user_id: string, email?: string) =>
    api.post('/api/auth/token', { user_id, email }),
};

export const jobs = {
  submit: (source: string, source_type: string) =>
    api.post('/api/jobs', { source, source_type }),
  getStatus: (jobId: string) =>
    api.get(`/api/jobs/${jobId}`),
};

export const results = {
  list: (page = 1, page_size = 10) =>
    api.get('/api/results', { params: { page, page_size } }),
  get: (resultId: string) =>
    api.get(`/api/results/${resultId}`),
};