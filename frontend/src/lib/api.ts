import axios from 'axios';

const api = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL });

// Attach JWT from localStorage on every request
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const auth = {
  getToken: (user_id: string, email?: string) =>
    api.post('/auth/token', { user_id, email }),
};

export const jobs = {
  submit: (source: string, source_type: string) =>
    api.post('/jobs', { source, source_type }),
  getStatus: (jobId: string) =>
    api.get(`/jobs/${jobId}`),
};

export const results = {
  list: (page = 1, page_size = 10) =>
    api.get('/results', { params: { page, page_size } }),
  get: (resultId: string) =>
    api.get(`/results/${resultId}`),
};