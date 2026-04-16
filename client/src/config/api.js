// In production (Railway), frontend and backend are on the same domain,
// so use an empty string for relative URLs. In dev, proxy to localhost:5000.
const API_BASE_URL = process.env.REACT_APP_API_URL ||
  (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5000');

export { API_BASE_URL };
export default API_BASE_URL;
