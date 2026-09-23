import CONFIG from '@/lib/config';

export type ManagementManager = {
  id?: string;
  email?: string;
  full_name?: string;
  name?: string;
};

// Management uses the exact same manager session as Import Admin.
// Keeping the same storage keys means signing in to either area keeps
// the same session alive.
const TOKEN_KEY = 'import_manager_token';
const MANAGER_KEY = 'import_manager';
const EDGE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/china-import`;

export function getManagementToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function getManagementManager(): ManagementManager | null {
  try {
    const value = sessionStorage.getItem(MANAGER_KEY);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

export function setManagementSession(token: string, manager: ManagementManager) {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(MANAGER_KEY, JSON.stringify(manager));
}

export function clearManagementSession() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(MANAGER_KEY);
  sessionStorage.removeItem('import_manager_source');
}

export function validateManagementSession(): ManagementManager | null {
  const token = getManagementToken();
  const manager = getManagementManager();

  if (!token || !manager || typeof manager.email !== 'string' || !manager.email.toLowerCase().endsWith('@qafrica.store')) {
    clearManagementSession();
    return null;
  }

  return manager;
}

export async function logoutManagementSession(): Promise<void> {
  const token = getManagementToken();

  if (token) {
    fetch(`${CONFIG.SUPABASE_URL}/functions/v1/china-import?action=admin-logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manager_token: token }),
    }).catch(() => {});
  }

  clearManagementSession();
}
