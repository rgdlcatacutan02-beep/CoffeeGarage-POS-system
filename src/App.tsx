import React, { useState, useEffect } from 'react';
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from './lib/firebase';
import { useFirebase, FirebaseProvider } from './components/FirebaseProvider';
import { ToastProvider, useToast } from './components/ui/Toast';
import { 
  Coffee, LogOut, ShieldCheck, User as UserIcon, Lock, 
  Eye, EyeOff, Key, Users, Settings as SettingsIcon, LayoutGrid, Wrench
} from 'lucide-react';
import POSInterface from './components/POSInterface';
import KDS from './components/KDS';
import AdminDashboard from './components/AdminDashboard';
import { ErrorBoundary } from './components/ErrorBoundary';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { adminAuthService } from './services/adminAuthService';

function AppContent() {
  const { 
    user, adminProfile, staffProfile, isAuthReady, isAdmin, isManager, isOwner, 
    setAdminProfile, setStaffProfile, currentBranch, logout, shopSettings 
  } = useFirebase();
  const { toast } = useToast();

  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [activeView, setActiveView] = useState<'pos' | 'kds'>('pos');
  const [loginMode, setLoginMode] = useState<'admin' | 'staff'>('admin');
  
  // Admin Login Form
  const [adminUsernameInput, setAdminUsernameInput] = useState('');
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [showAdminPass, setShowAdminPass] = useState(false);
  const [isAdminLoggingIn, setIsAdminLoggingIn] = useState(false);
  const [adminLoginError, setAdminLoginError] = useState('');

  // Staff Login Form
  const [staffCredentials, setStaffCredentials] = useState({ username: '', passcode: '' });
  const [showStaffPass, setShowStaffPass] = useState(false);
  const [isStaffLoggingIn, setIsStaffLoggingIn] = useState(false);
  const [staffLoginError, setStaffLoginError] = useState('');

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminLoginError('');
    const user = adminUsernameInput.trim() || 'admin';
    const pass = adminPasswordInput.trim();

    if (!pass) {
      setAdminLoginError('Please enter the administrator password.');
      return;
    }

    setIsAdminLoggingIn(true);
    try {
      const res = await adminAuthService.verifyAdminLogin(user, pass);
      if (res && res.success) {
        setAdminProfile({ username: user });
        toast(`Welcome back, ${user}!`, 'success');
        setIsAdminOpen(true);
      } else {
        setAdminLoginError(res?.error || 'Invalid admin username or password. (Default is admin / admin123)');
      }
    } catch (err: any) {
      setAdminLoginError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsAdminLoggingIn(false);
    }
  };

  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setStaffLoginError('');
    const username = staffCredentials.username.trim();
    const passcode = staffCredentials.passcode.trim();

    if (!username || !passcode) {
      setStaffLoginError('Please provide both your staff username and passcode.');
      return;
    }

    setIsStaffLoggingIn(true);
    try {
      const q = query(collection(db, 'staff'));
      const snap = await getDocs(q);
      const staffDoc = snap.docs.find(d => 
        String(d.data().username || '').toLowerCase() === username.toLowerCase() && 
        String(d.data().passcode || '') === passcode
      );
      
      if (staffDoc) {
        const staffData = staffDoc.data();
        const role = staffData.role || 'cashier';
        setStaffProfile({ 
          id: staffDoc.id,
          username: staffData.username, 
          role,
          branchId: staffData.branchId || 'default'
        });
        toast(`Logged in as ${staffData.username} (${role})`, 'success');
        if (role === 'kitchen') {
          setActiveView('kds');
        } else {
          setActiveView('pos');
        }
      } else {
        setStaffLoginError('Invalid staff username or passcode. Please check with your manager or admin.');
      }
    } catch (err: any) {
      console.error('Staff Login Error:', err);
      setStaffLoginError(`Login failed: ${err.message || 'Check your connection.'}`);
    } finally {
      setIsStaffLoggingIn(false);
    }
  };

  useEffect(() => {
    if (staffProfile?.role === 'kitchen') {
      setActiveView('kds');
    }
  }, [staffProfile]);

  const isLoggedIn = Boolean(adminProfile || staffProfile || user);

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center"
        >
          <div className="w-16 h-16 bg-gray-900 rounded-3xl flex items-center justify-center mb-4 shadow-xl text-white">
            <Coffee className="w-8 h-8 animate-bounce" />
          </div>
          <p className="text-sm font-bold text-gray-800 mb-2">CoffeeGarage</p>
          <div className="h-1.5 w-32 bg-gray-200 rounded-full overflow-hidden">
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: '100%' }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
              className="h-full w-full bg-gray-900"
            />
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      {!isLoggedIn ? (
        <motion.div 
          key="login"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          className="min-h-screen flex items-center justify-center bg-gray-50 p-4"
        >
          <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl p-8 sm:p-10 text-center border border-gray-100 overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-amber-500 via-gray-900 to-amber-600" />
            
            {/* App Branding Header */}
            <div className="w-20 h-20 bg-gray-900 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-gray-200">
              <Coffee className="text-amber-400 w-10 h-10" />
            </div>
            
            <h1 className="text-3xl sm:text-4xl font-black text-gray-900 mb-1 tracking-tight">
              CoffeeGarage
            </h1>
            <p className="text-gray-500 mb-8 font-medium text-sm">
              Point of Sale & Store Operations
            </p>
            
            {/* Mode Switcher */}
            <div className="flex p-1 bg-gray-100 rounded-2xl mb-6">
              <button 
                type="button"
                onClick={() => {
                  setLoginMode('admin');
                  setAdminLoginError('');
                }}
                className={cn(
                  "flex-1 py-3 rounded-xl font-bold transition-all text-sm flex items-center justify-center gap-2", 
                  loginMode === 'admin' ? "bg-white text-gray-900 shadow-sm" : "text-gray-400 hover:text-gray-600"
                )}
              >
                <ShieldCheck className="w-4 h-4" />
                Admin Portal
              </button>
              <button 
                type="button"
                onClick={() => {
                  setLoginMode('staff');
                  setStaffLoginError('');
                }}
                className={cn(
                  "flex-1 py-3 rounded-xl font-bold transition-all text-sm flex items-center justify-center gap-2", 
                  loginMode === 'staff' ? "bg-white text-gray-900 shadow-sm" : "text-gray-400 hover:text-gray-600"
                )}
              >
                <Users className="w-4 h-4" />
                Staff Sign In
              </button>
            </div>

            {loginMode === 'admin' ? (
              <motion.form
                key="admin-form"
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                onSubmit={handleAdminLogin}
                className="space-y-4 text-left"
              >
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Admin Username</label>
                    <div className="relative">
                      <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input 
                        type="text"
                        placeholder="admin"
                        value={adminUsernameInput}
                        onChange={(e) => setAdminUsernameInput(e.target.value)}
                        className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-gray-900 focus:bg-white transition-all font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Admin Password</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input 
                        type={showAdminPass ? "text" : "password"}
                        placeholder="Enter password (default: admin123)"
                        value={adminPasswordInput}
                        onChange={(e) => setAdminPasswordInput(e.target.value)}
                        className="w-full pl-11 pr-11 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-gray-900 focus:bg-white transition-all font-mono"
                        required
                      />
                      <button 
                        type="button"
                        onClick={() => setShowAdminPass(!showAdminPass)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                      >
                        {showAdminPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {adminLoginError && (
                  <p className="text-xs font-bold text-red-500 bg-red-50 p-3 rounded-xl border border-red-100 animate-shake leading-relaxed">
                    {adminLoginError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isAdminLoggingIn}
                  className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold flex items-center justify-center hover:bg-gray-800 transition-all shadow-xl shadow-gray-200 active:scale-95 disabled:opacity-50 text-sm"
                >
                  <ShieldCheck className="w-5 h-5 mr-2" />
                  {isAdminLoggingIn ? 'Verifying Admin...' : 'Sign In to Admin Portal'}
                </button>

                <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200/70 text-center">
                  <p className="text-[11px] text-amber-900 font-medium">
                    Default: username <strong>admin</strong> &bull; password <strong>admin123</strong>
                  </p>
                  <p className="text-[10px] text-amber-700 mt-0.5">
                    Password can be changed inside the Admin Portal under <em>Admin Security</em>.
                  </p>
                </div>
              </motion.form>
            ) : (
              <motion.form
                key="staff-form"
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                onSubmit={handleStaffLogin}
                className="space-y-4 text-left"
              >
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Staff Member Name / Username</label>
                    <div className="relative">
                      <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input 
                        type="text"
                        placeholder="e.g. Maria Cashier"
                        value={staffCredentials.username}
                        onChange={(e) => setStaffCredentials({...staffCredentials, username: e.target.value})}
                        className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-gray-900 focus:bg-white transition-all font-medium"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Staff Passcode / PIN</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input 
                        type={showStaffPass ? "text" : "password"}
                        placeholder="e.g. 1234"
                        value={staffCredentials.passcode}
                        onChange={(e) => setStaffCredentials({...staffCredentials, passcode: e.target.value})}
                        className="w-full pl-11 pr-11 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-gray-900 focus:bg-white transition-all font-mono"
                        required
                      />
                      <button 
                        type="button"
                        onClick={() => setShowStaffPass(!showStaffPass)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                      >
                        {showStaffPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {staffLoginError && (
                  <p className="text-xs font-bold text-red-500 bg-red-50 p-3 rounded-xl border border-red-100 animate-shake leading-relaxed">
                    {staffLoginError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isStaffLoggingIn}
                  className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold flex items-center justify-center hover:bg-gray-800 transition-all shadow-xl shadow-gray-200 active:scale-95 disabled:opacity-50 text-sm"
                >
                  <Users className="w-5 h-5 mr-2" />
                  {isStaffLoggingIn ? 'Signing In...' : 'Staff Sign In'}
                </button>
                <p className="text-[11px] text-gray-400 text-center leading-relaxed">
                  For Cashiers, Managers, Kitchen Staff, and Baristas created by the Administrator.
                </p>
              </motion.form>
            )}
          </div>
        </motion.div>
      ) : (
        <motion.div 
          key="app"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="relative min-h-screen bg-gray-50"
        >
          {activeView === 'pos' ? (
            <POSInterface onOpenAdmin={() => setIsAdminOpen(true)} />
          ) : (
            <KDS />
          )}

          {/* View Toggle for Managers/Admins */}
          {(isManager || isAdmin) && (
            <div className="fixed bottom-6 right-6 z-40 flex items-center gap-2 bg-white/90 backdrop-blur-md p-1.5 rounded-2xl border border-gray-200 shadow-xl">
              <button 
                onClick={() => setActiveView('pos')}
                className={cn(
                  "px-3.5 py-2 rounded-xl text-xs font-bold transition-all", 
                  activeView === 'pos' ? "bg-gray-900 text-white shadow-sm" : "text-gray-600 hover:bg-gray-100"
                )}
              >
                POS
              </button>
              <button 
                onClick={() => setActiveView('kds')}
                className={cn(
                  "px-3.5 py-2 rounded-xl text-xs font-bold transition-all", 
                  activeView === 'kds' ? "bg-gray-900 text-white shadow-sm" : "text-gray-600 hover:bg-gray-100"
                )}
              >
                KDS
              </button>
              {isAdmin && (
                <button
                  onClick={() => setIsAdminOpen(true)}
                  className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-sm"
                  title="Open Admin Portal"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Admin
                </button>
              )}
            </div>
          )}
          
          <AnimatePresence>
            {isAdminOpen && (
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed inset-0 z-50"
              >
                <AdminDashboard onClose={() => setIsAdminOpen(false)} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Logged-In User Status / Floating Badge */}
          <div className="fixed bottom-6 left-6 z-40 hidden md:block">
            <div className="flex items-center space-x-3 bg-white/90 backdrop-blur-md p-2 rounded-full border border-gray-200 shadow-xl">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm",
                adminProfile ? "bg-gray-900" :
                staffProfile?.role === 'manager' ? "bg-purple-600" :
                staffProfile?.role === 'cashier' ? "bg-emerald-600" :
                staffProfile?.role === 'kitchen' ? "bg-amber-600" :
                "bg-blue-600"
              )}>
                {adminProfile ? (
                  <ShieldCheck className="w-5 h-5 text-amber-400" />
                ) : (
                  staffProfile?.username ? staffProfile.username.charAt(0).toUpperCase() : <UserIcon className="w-5 h-5" />
                )}
              </div>
              <div className="pr-3">
                <p className="text-xs font-bold text-gray-900 leading-none mb-1">
                  {adminProfile ? `Admin: ${adminProfile.username}` : staffProfile?.username || (user ? user.displayName : 'Staff')}
                </p>
                <p className="text-[10px] text-gray-500 leading-none uppercase tracking-wider font-semibold">
                  {adminProfile ? 'Master Administrator' : (staffProfile?.role || (isAdmin ? 'Administrator' : 'Staff'))}
                </p>
              </div>

              {isAdmin && (
                <button
                  onClick={() => setIsAdminOpen(true)}
                  className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-full text-[11px] font-bold transition-all flex items-center gap-1"
                >
                  <SettingsIcon className="w-3.5 h-3.5" />
                  Portal
                </button>
              )}

              <button 
                onClick={logout}
                title="Log Out"
                className="p-2 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-full transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Mobile Logout Toggle */}
          <div className="fixed bottom-4 left-4 z-[60] md:hidden">
            <button 
              onClick={logout}
              title="Log Out"
              className="w-12 h-12 bg-white rounded-2xl shadow-xl flex items-center justify-center border border-gray-100 active:scale-95"
            >
              <LogOut className="w-5 h-5 text-gray-700" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <FirebaseProvider>
        <ToastProvider>
          <AppContent />
        </ToastProvider>
      </FirebaseProvider>
    </ErrorBoundary>
  );
}
