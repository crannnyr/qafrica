import CONFIG from '@/lib/config';

export type ManagementManager = {
  id?: string;
  email?: string;
  full_name?: string;
  name?: string;
};

const EDGE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/china-import`;
const TOKEN_KEY = 'management_token';
const MANAGER_KEY = 'management_manager';

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
}

export async function validateManagementSession(): Promise<ManagementManager | null> {
  const token = getManagementToken();
  if (!token) return null;

  try {
    const res = await fetch(`${EDGE_URL}?action=admin-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manager_token: token }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success || !data.manager) {
      clearManagementSession();
      return null;
    }

    sessionStorage.setItem(MANAGER_KEY, JSON.stringify(data.manager));
    return data.manager;
  } catch {
    // Keep the local session when the network is unavailable. Protected
    // management API calls still require the server-side session token.
    return getManagementManager();
  }
}

export async function logoutManagementSession(): Promise<void> {
  const token = getManagementToken();

  try {
    if (token) {
      await fetch(`${EDGE_URL}?action=admin-logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: token }),
      });
    }
  } finally {
    clearManagementSession();
  }
}
