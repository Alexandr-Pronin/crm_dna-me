/**
 * DNA ME CRM Auth Provider
 * 
 * CRITICAL: Dev Mode - No Authentication
 * As per FRONTEND_PLAN.md: Skip all auth logic, assume user is always "Admin"
 */

const authProvider = {
  // Dev Mode: Always succeeds, no actual login
  login: async () => {
    console.log('[Dev Mode] Auth bypassed - auto-login as Admin');
    localStorage.setItem('auth_user', JSON.stringify({
      id: 'dev-admin',
      email: 'admin@dna-me.net',
      fullName: 'Admin (Dev Mode)',
      role: 'admin',
    }));
    return Promise.resolve();
  },
  
  // Dev Mode: Clear stored user
  logout: async () => {
    localStorage.removeItem('auth_user');
    return Promise.resolve();
  },
  
  // Dev Mode: Always authenticated
  checkAuth: async () => {
    // In dev mode, auto-create user if not exists
    if (!localStorage.getItem('auth_user')) {
      localStorage.setItem('auth_user', JSON.stringify({
        id: 'dev-admin',
        email: 'admin@dna-me.net',
        fullName: 'Admin (Dev Mode)',
        role: 'admin',
      }));
    }
    return Promise.resolve();
  },
  
  // Dev Mode: Never show errors
  checkError: async (error) => {
    // Only reject on 401/403 in production
    // In dev mode, ignore auth errors
    console.log('[Dev Mode] API Error ignored:', error?.status);
    return Promise.resolve();
  },
  
  // Dev Mode: Return hardcoded admin identity
  getIdentity: async () => {
    const storedUser = localStorage.getItem('auth_user');
    const user = storedUser 
      ? JSON.parse(storedUser)
      : {
          id: 'dev-admin',
          email: 'admin@dna-me.net',
          fullName: 'Admin (Dev Mode)',
          role: 'admin',
        };
    
    return {
      id: user.id,
      fullName: user.fullName,
      avatar: undefined, // Could add a default avatar URL
    };
  },
  
  // Dev Mode: Full admin permissions
  getPermissions: async () => {
    return ['*']; // Full access for dev mode
  },
};

export default authProvider;
