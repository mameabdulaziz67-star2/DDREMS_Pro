// API Configuration — uses REACT_APP_API_URL env var in production (Railway)
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export { API_BASE_URL };
export default API_BASE_URL;
