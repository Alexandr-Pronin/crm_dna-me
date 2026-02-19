import { API_URL } from './dataProvider';

const authProvider = {
  login: async ({ username, password, code }) => {
    const request = new Request(`${API_URL}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email: username, password }),
      headers: new Headers({ 'Content-Type': 'application/json' }),
    });
    const response = await fetch(request);
    if (response.status < 200 || response.status >= 300) {
      throw new Error(response.statusText);
    }
    const data = await response.json();
    
    if (data.require2fa) {
      if (code) {
        // If code is provided (second attempt), validate it
        const request2fa = new Request(`${API_URL}/auth/2fa/validate`, {
          method: 'POST',
          body: JSON.stringify({ userId: data.userId, token: code }),
          headers: new Headers({ 'Content-Type': 'application/json' }),
        });
        const response2fa = await fetch(request2fa);
        if (response2fa.status < 200 || response2fa.status >= 300) {
          throw new Error('Invalid 2FA code');
        }
        const data2fa = await response2fa.json();
        localStorage.setItem('auth_token', data2fa.token);
        localStorage.setItem('auth_user', JSON.stringify(data2fa.user));
        return Promise.resolve();
      } else {
        // First attempt, return error/state to prompt for code
        const error = new Error('2FA Required');
        error.require2fa = true;
        error.userId = data.userId;
        throw error;
      }
    }

    localStorage.setItem('auth_token', data.token);
    localStorage.setItem('auth_user', JSON.stringify(data.user));
    return Promise.resolve();
  },
  
  logout: () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    return Promise.resolve();
  },
  
  checkAuth: () => {
    // Add a small delay to ensure react-admin shows loading state instead of flashing content
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        localStorage.getItem('auth_token') ? resolve() : reject();
      }, 100);
    });
  },
  
  checkError: (error) => {
    const status = error.status;
    if (status === 401 || status === 403) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      return Promise.reject();
    }
    return Promise.resolve();
  },
  
  getIdentity: () => {
    try {
      const user = JSON.parse(localStorage.getItem('auth_user'));
      return user ? Promise.resolve(user) : Promise.reject();
    } catch (error) {
      return Promise.reject(error);
    }
  },
  
  getPermissions: () => {
    try {
      const user = JSON.parse(localStorage.getItem('auth_user'));
      return user ? Promise.resolve(user.role) : Promise.reject();
    } catch (error) {
      return Promise.reject(error);
    }
  },
};

export default authProvider;
