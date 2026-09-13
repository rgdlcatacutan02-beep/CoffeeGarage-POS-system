import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface AdminCredentials {
  username: string;
  password: string;
  updatedAt?: any;
}

const DEFAULT_ADMIN: AdminCredentials = {
  username: 'admin',
  password: 'admin123',
};

const LOCAL_STORAGE_KEY = 'coffeegarage_admin_creds';
const ADMIN_SESSION_KEY = 'coffeegarage_admin_session';

export const adminAuthService = {
  /**
   * Retrieves active admin credentials from Firestore (or fallback to localStorage / default).
   */
  async getCredentials(): Promise<AdminCredentials> {
    try {
      const docRef = doc(db, 'settings', 'admin');
      const snap = await getDoc(docRef);

      if (snap.exists()) {
        const data = snap.data() as AdminCredentials;
        if (data.username && data.password) {
          // Keep localStorage in sync for offline resiliency
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
          return data;
        }
      } else {
        // Initialize default admin in Firestore if first run
        await setDoc(docRef, {
          username: DEFAULT_ADMIN.username,
          password: DEFAULT_ADMIN.password,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(DEFAULT_ADMIN));
        return DEFAULT_ADMIN;
      }
    } catch (err) {
      console.warn('Could not read admin doc from Firestore, checking localStorage:', err);
    }

    // Check localStorage fallback
    const local = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (local) {
      try {
        return JSON.parse(local);
      } catch {
        // ignore parse error
      }
    }

    return DEFAULT_ADMIN;
  },

  /**
   * Validates username and password for Admin login.
   */
  async verifyAdminLogin(usernameInput: string, passwordInput: string): Promise<{ success: boolean; error?: string }> {
    const creds = await this.getCredentials();
    const cleanUsername = usernameInput.trim().toLowerCase();
    const cleanPassword = passwordInput.trim();

    if (cleanUsername === creds.username.trim().toLowerCase() && cleanPassword === creds.password.trim()) {
      return { success: true };
    }

    // In case of case sensitivity or default fallback
    if (cleanUsername === 'admin' && cleanPassword === creds.password.trim()) {
      return { success: true };
    }

    return { success: false, error: 'Invalid admin username or password.' };
  },

  /**
   * Changes the admin password inside the portal.
   */
  async changePassword(currentPassword: string, newPassword: string, newUsername?: string): Promise<{ success: boolean; error?: string }> {
    const currentCreds = await this.getCredentials();

    if (currentPassword.trim() !== currentCreds.password.trim()) {
      return { success: false, error: 'Current password is incorrect.' };
    }

    if (!newPassword || newPassword.trim().length < 4) {
      return { success: false, error: 'New password must be at least 4 characters long.' };
    }

    const updatedUsername = (newUsername && newUsername.trim()) ? newUsername.trim() : currentCreds.username;
    const updatedCreds: AdminCredentials = {
      username: updatedUsername,
      password: newPassword.trim(),
    };

    try {
      const docRef = doc(db, 'settings', 'admin');
      await setDoc(docRef, {
        username: updatedCreds.username,
        password: updatedCreds.password,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (err) {
      console.warn('Error saving new admin password to Firestore:', err);
      // We will still persist locally to ensure continuity
    }

    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedCreds));

    // Update session
    const currentSession = this.getAdminSession();
    if (currentSession) {
      this.saveAdminSession({
        ...currentSession,
        username: updatedCreds.username,
      });
    }

    return { success: true };
  },

  /**
   * Session helpers
   */
  getAdminSession(): { username: string; loggedInAt: string } | null {
    const session = localStorage.getItem(ADMIN_SESSION_KEY);
    if (!session) return null;
    try {
      return JSON.parse(session);
    } catch {
      return null;
    }
  },

  saveAdminSession(session: { username: string; loggedInAt: string }) {
    localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
  },

  clearAdminSession() {
    localStorage.removeItem(ADMIN_SESSION_KEY);
  },
};
