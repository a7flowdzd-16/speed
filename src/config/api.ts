// export const API_BASE_URL = 'https://api.a7flow.pro/api';
export const API_BASE_URL = 'http://192.168.100.9:3005/api'; // Local Development IP (Wi-Fi)
// export const API_BASE_URL = 'http://localhost:3005/api'; // Local Web only

// Helper function to build full URLs for files/images
export const getFileUrl = (path?: string) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  // If the backend returns /uploads/image.jpg, we prepend the base server URL AND /api
  // In the DB, path might be "/uploads/image.jpg"
  const serverBase = API_BASE_URL.endsWith('/api') ? API_BASE_URL.slice(0, -4) : API_BASE_URL;
  const normalizedPath = path.startsWith('/uploads') 
    ? `/api${path}` 
    : path.startsWith('/') ? `/api/uploads${path}` : `/api/uploads/${path}`;
  
  return `${serverBase}${normalizedPath}`;
};

// Generic fetch wrapper
export const apiClient = {
  get: async (endpoint: string, params: Record<string, any> = {}, headers = {}) => {
    try {
      const query = Object.keys(params)
        .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(params[k]))
        .join('&');
      const url = query ? `${API_BASE_URL}${endpoint}?${query}` : `${API_BASE_URL}${endpoint}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      });
      return await response.json();
    } catch (error) {
      console.error(`API GET Error [${endpoint}]:`, error);
      throw error;
    }
  },
  post: async (endpoint: string, data: any, headers = {}) => {
    try {
      const isFormData = data instanceof FormData;
      
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
          ...headers,
        },
        body: isFormData ? data : JSON.stringify(data),
      });
      return await response.json();
    } catch (error) {
      console.error(`API POST Error [${endpoint}]:`, error);
      throw error;
    }
  },
  put: async (endpoint: string, data: any, headers = {}) => {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify(data),
      });
      return await response.json();
    } catch (error) {
      console.error(`API PUT Error [${endpoint}]:`, error);
      throw error;
    }
  },
  delete: async (endpoint: string, headers = {}) => {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      });
      return await response.json();
    } catch (error) {
      console.error(`API DELETE Error [${endpoint}]:`, error);
      throw error;
    }
  },
};
