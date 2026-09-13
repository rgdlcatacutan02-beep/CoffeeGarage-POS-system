import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, getDocFromServer } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

interface FirebaseContextType {
  user: User | null;
  adminProfile: { username: string } | null;
  staffProfile: { id: string; username: string; role: string; branchId: string } | null;
  isAuthReady: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isOwner: boolean;
  shopSettings: { shopName: string; logoUrl?: string; defaultBranch?: string; paymentQrUrl?: string } | null;
  currentBranch: string;
  setAdminProfile: (profile: { username: string } | null) => void;
  setStaffProfile: (profile: { id: string; username: string; role: string; branchId: string } | null) => void;
  setCurrentBranch: (branchId: string) => void;
  logout: () => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [adminProfile, setAdminProfileState] = useState<{ username: string } | null>(null);
  const [staffProfile, setStaffProfileState] = useState<{ id: string; username: string; role: string; branchId: string } | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isManager, setIsManager] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [shopSettings, setShopSettings] = useState<{ shopName: string; logoUrl?: string; defaultBranch?: string; paymentQrUrl?: string } | null>(null);
  const [currentBranch, setCurrentBranch] = useState<string>('default');

  // Persistence for sessions
  useEffect(() => {
    // Check admin session
    const savedAdmin = localStorage.getItem('coffeegarage_admin_session');
    if (savedAdmin) {
      try {
        const parsed = JSON.parse(savedAdmin);
        if (parsed.username) {
          setAdminProfileState(parsed);
          setIsAdmin(true);
          setIsManager(true);
          setIsOwner(true);
        }
      } catch (e) {
        localStorage.removeItem('coffeegarage_admin_session');
      }
    }

    // Check staff session
    const savedStaff = localStorage.getItem('pos_staff_session');
    if (savedStaff) {
      try {
        const profile = JSON.parse(savedStaff);
        setStaffProfileState(profile);
        if (profile.branchId) setCurrentBranch(profile.branchId);
        
        const role = profile.role;
        setIsOwner(role === 'owner');
        setIsAdmin(role === 'admin' || role === 'owner');
        setIsManager(role === 'manager' || role === 'admin' || role === 'owner');
      } catch (e) {
        localStorage.removeItem('pos_staff_session');
      }
    }

    setIsAuthReady(true);
  }, []);

  const setAdminProfile = (profile: { username: string } | null) => {
    setAdminProfileState(profile);
    if (profile) {
      localStorage.setItem('coffeegarage_admin_session', JSON.stringify({
        username: profile.username,
        loggedInAt: new Date().toISOString()
      }));
      setIsAdmin(true);
      setIsManager(true);
      setIsOwner(true);
    } else {
      localStorage.removeItem('coffeegarage_admin_session');
      if (!staffProfile) {
        setIsAdmin(false);
        setIsManager(false);
        setIsOwner(false);
      }
    }
  };

  const setStaffProfile = (profile: { id: string; username: string; role: string; branchId: string } | null) => {
    setStaffProfileState(profile);
    if (profile) {
      localStorage.setItem('pos_staff_session', JSON.stringify(profile));
      if (profile.branchId) setCurrentBranch(profile.branchId);
      const role = profile.role;
      setIsOwner(role === 'owner');
      setIsAdmin(role === 'admin' || role === 'owner');
      setIsManager(role === 'manager' || role === 'admin' || role === 'owner');
    } else {
      localStorage.removeItem('pos_staff_session');
      if (!adminProfile) {
        setIsAdmin(false);
        setIsManager(false);
        setIsOwner(false);
      }
    }
  };

  const logout = async () => {
    if (user) {
      await auth.signOut();
    }
    setAdminProfile(null);
    setStaffProfile(null);
  };

  const OWNER_EMAIL = 'rgdlcatacutan02@gmail.com';

  const resetRoles = () => {
    if (adminProfile) {
      setIsAdmin(true);
      setIsManager(true);
      setIsOwner(true);
      return;
    }
    if (staffProfile) {
      const role = staffProfile.role;
      setIsOwner(role === 'owner');
      setIsAdmin(role === 'admin' || role === 'owner');
      setIsManager(role === 'manager' || role === 'admin' || role === 'owner');
      return;
    }
    setIsAdmin(false);
    setIsManager(false);
    setIsOwner(false);
  };

  useEffect(() => {
    let unsubscribeUserDoc: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      
      if (unsubscribeUserDoc) {
        unsubscribeUserDoc();
        unsubscribeUserDoc = null;
      }

      if (u) {
        const isEmailOwner = u.email?.trim().toLowerCase() === OWNER_EMAIL.toLowerCase();
        
        if (isEmailOwner) {
          setIsOwner(true);
          setIsAdmin(true);
          setIsManager(true);
        } else {
          unsubscribeUserDoc = onSnapshot(doc(db, 'users', u.uid), (snapshot) => {
            if (snapshot.exists()) {
              const data = snapshot.data();
              const role = data.role || 'staff';
              setIsOwner(role === 'owner');
              setIsAdmin(role === 'admin' || role === 'owner');
              setIsManager(role === 'manager' || role === 'admin' || role === 'owner');
            } else {
              resetRoles();
            }
          });
        }
      } else {
        resetRoles();
      }
      
      setIsAuthReady(true);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeUserDoc) unsubscribeUserDoc();
    };
  }, [staffProfile, adminProfile]);

  useEffect(() => {
    const unsubscribeSettings = onSnapshot(doc(db, 'settings', 'config'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as any;
        setShopSettings(data);
        if (data.defaultBranch && !staffProfile) {
          setCurrentBranch(data.defaultBranch);
        }
      } else {
        setShopSettings({ shopName: 'CoffeeGarage' });
      }
    });

    return () => unsubscribeSettings();
  }, [staffProfile]);

  return (
    <FirebaseContext.Provider value={{ 
      user, 
      adminProfile,
      staffProfile, 
      isAuthReady, 
      isAdmin, 
      isManager,
      isOwner, 
      shopSettings, 
      currentBranch,
      setAdminProfile,
      setStaffProfile,
      setCurrentBranch,
      logout
    }}>
      {children}
    </FirebaseContext.Provider>
  );
}

export function useFirebase() {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
}
