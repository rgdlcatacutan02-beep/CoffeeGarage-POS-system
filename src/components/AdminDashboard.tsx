import React, { useState, useEffect } from 'react';
import { Timestamp, collection, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc, doc, setDoc, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useFirebase } from './FirebaseProvider';
import { 
  X, Save, Plus, Trash2, Image as ImageIcon, LayoutGrid, Coffee, ArrowLeft, 
  Pencil, Printer, Bluetooth, BluetoothOff, Zap, Users, BarChart3, Package, 
  Store, Wallet, Heart, Key, Lock, ShieldCheck, Eye, EyeOff, CheckCircle2, UserCheck,
  ChefHat, RefreshCw, AlertTriangle, Layers, CreditCard, Search, Award
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie } from 'recharts';
import { format } from 'date-fns';
import { cn, safeToDate, formatPHP } from '../lib/utils';
import { printerService } from '../services/printerService';
import { adminAuthService } from '../services/adminAuthService';
import { inventoryService } from '../services/inventoryService';
import { loyaltyService } from '../services/loyaltyService';
import { Customer } from '../types';

const NavTabs = ({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (t: any) => void }) => (
  <>
    {[
      { id: 'analytics', label: 'Analytics', icon: BarChart3 },
      { id: 'inventory', label: 'Inventory', icon: Package },
      { id: 'menu', label: 'Menu & Recipes', icon: Coffee },
      { id: 'branches', label: 'Branches', icon: Store },
      { id: 'branding', label: 'Branding', icon: LayoutGrid },
      { id: 'customers', label: 'Loyalty', icon: Heart },
      { id: 'expenses', label: 'Expenses', icon: Wallet },
      { id: 'staff', label: 'Staff', icon: Users },
      { id: 'security', label: 'Admin Security', icon: Key },
      { id: 'hardware', label: 'Hardware', icon: Printer }
    ].map(tab => (
      <button 
        key={tab.id}
        onClick={() => setActiveTab(tab.id)}
        className={cn(
          "px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2", 
          activeTab === tab.id ? "bg-gray-900 text-white shadow-md" : "text-gray-500 hover:bg-gray-100"
        )}
      >
        <tab.icon className="w-4 h-4" />
        {tab.label}
      </button>
    ))}
  </>
);

import { useFirestoreCollection } from '../hooks/useFirestore';
import { useToast } from './ui/Toast';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';

export default function AdminDashboard({ onClose }: { onClose: () => void }) {
  const { shopSettings, currentBranch, isOwner, adminProfile, setAdminProfile, setCurrentBranch } = useFirebase();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'branding' | 'menu' | 'hardware' | 'staff' | 'analytics' | 'inventory' | 'expenses' | 'customers' | 'security' | 'branches'>('analytics');
  
  // Use custom hooks for data fetching
  const { data: staffMembers } = useFirestoreCollection<any>('staff');
  const { data: branches } = useFirestoreCollection<any>('branches');
  const { data: categories } = useFirestoreCollection<any>('categories', [orderBy('order', 'asc')]);
  const { data: products } = useFirestoreCollection<any>('products');
  const { data: orders } = useFirestoreCollection<any>('orders');
  const { data: customers } = useFirestoreCollection<any>('customers');
  const { data: expenses } = useFirestoreCollection<any>('expenses');
  const { data: inventory } = useFirestoreCollection<any>(`branches/${currentBranch}/inventory`);

  const [staffForm, setStaffForm] = useState({ username: '', passcode: '', role: 'cashier', branchId: 'default' });
  const [editingStaff, setEditingStaff] = useState<any>(null);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [productForm, setProductForm] = useState({ name: '', price: '', categoryId: '', imageUrl: '', description: '' });

  // Inventory Management State
  const [isIngredientModalOpen, setIsIngredientModalOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<any>(null);
  const [ingredientForm, setIngredientForm] = useState<{ name: string; unit: 'g' | 'ml' | 'pcs' | 'bottle'; stock: string; minThreshold: string }>({
    name: '', unit: 'g', stock: '', minThreshold: '10'
  });
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
  const [restockingItem, setRestockingItem] = useState<any>(null);
  const [restockAmount, setRestockAmount] = useState('');

  // Expenses State
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState<{ category: 'utilities' | 'ingredients' | 'salaries' | 'rent' | 'maintenance' | 'other'; amount: string; description: string }>({
    category: 'ingredients', amount: '', description: ''
  });

  // Recipe Linking State
  const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false);
  const [selectedRecipeProduct, setSelectedRecipeProduct] = useState<any>(null);
  const [recipeIngredients, setRecipeIngredients] = useState<Array<{ ingredientId: string; quantity: number }>>([]);
  const [newRecipeItem, setNewRecipeItem] = useState<{ ingredientId: string; quantity: string }>({
    ingredientId: '', quantity: ''
  });

  // Branch Management State
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [branchForm, setBranchForm] = useState({ name: '', address: '' });

  // Loyalty Management State
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [customerForm, setCustomerForm] = useState({
    name: '',
    cardNumber: '',
    phone: '',
    points: '0'
  });
  const [isAdjustPointsModalOpen, setIsAdjustPointsModalOpen] = useState(false);
  const [customerForPoints, setCustomerForPoints] = useState<Customer | null>(null);
  const [pointsDelta, setPointsDelta] = useState('');

  const openAddCustomerModal = () => {
    setEditingCustomer(null);
    setCustomerForm({
      name: '',
      cardNumber: `CG-${Math.floor(1000 + Math.random() * 9000)}`,
      phone: '',
      points: '0'
    });
    setIsCustomerModalOpen(true);
  };

  const openEditCustomerModal = (c: Customer) => {
    setEditingCustomer(c);
    setCustomerForm({
      name: c.name || '',
      cardNumber: c.cardNumber || '',
      phone: c.phone || '',
      points: (c.points ?? 0).toString()
    });
    setIsCustomerModalOpen(true);
  };

  const handleSaveCustomer = async () => {
    if (!customerForm.name.trim()) {
      toast('Customer full name is required', 'error');
      return;
    }
    try {
      if (editingCustomer) {
        await loyaltyService.updateCustomer(editingCustomer.id, {
          name: customerForm.name.trim(),
          cardNumber: customerForm.cardNumber.trim(),
          phone: customerForm.phone.trim(),
          points: parseInt(customerForm.points, 10) || 0
        });
        toast('Loyalty Card updated successfully', 'success');
      } else {
        await loyaltyService.registerCustomer(
          customerForm.cardNumber || customerForm.phone || '',
          customerForm.name.trim(),
          {
            cardNumber: customerForm.cardNumber.trim(),
            phone: customerForm.phone.trim(),
            points: parseInt(customerForm.points, 10) || 0
          }
        );
        toast('New Loyalty Card issued successfully!', 'success');
      }
      setIsCustomerModalOpen(false);
    } catch {
      toast('Failed to save loyalty card', 'error');
    }
  };

  const handleDeleteCustomer = (c: Customer) => {
    confirmAction(`Delete loyalty card for ${c.name} (${c.cardNumber || 'Member'})?`, async () => {
      await loyaltyService.deleteCustomer(c.id);
      toast('Loyalty card deleted', 'info');
    });
  };

  const openPointsAdjustmentModal = (c: Customer) => {
    setCustomerForPoints(c);
    setPointsDelta('');
    setIsAdjustPointsModalOpen(true);
  };

  const handleApplyPointsAdjustment = async () => {
    if (!customerForPoints || !pointsDelta) return;
    const delta = parseInt(pointsDelta, 10);
    if (isNaN(delta) || delta === 0) {
      toast('Please enter a valid number', 'error');
      return;
    }
    try {
      if (delta > 0) {
        await loyaltyService.updateCustomer(customerForPoints.id, {
          points: (customerForPoints.points || 0) + delta
        });
      } else {
        await loyaltyService.redeemPoints(customerForPoints.id, Math.abs(delta));
      }
      toast(`Updated points balance by ${delta > 0 ? '+' : ''}${delta} pts`, 'success');
      setIsAdjustPointsModalOpen(false);
    } catch {
      toast('Failed to adjust points', 'error');
    }
  };

  // Admin Security / Password State
  const [adminUsername, setAdminUsername] = useState(adminProfile?.username || 'admin');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  useEffect(() => {
    adminAuthService.getCredentials().then(creds => {
      if (creds.username) setAdminUsername(creds.username);
    });
  }, []);

  // Hardware State
  const [isPrinterConnecting, setIsPrinterConnecting] = useState(false);
  const [connectedPrinterName, setConnectedPrinterName] = useState<string | null>(printerService.isConnected() ? 'Connected Printer' : null);
  
  // Branding State
  const [shopName, setShopName] = useState(shopSettings?.shopName || '');
  const [logoUrl, setLogoUrl] = useState(shopSettings?.logoUrl || '');
  const [paymentQrUrl, setPaymentQrUrl] = useState(shopSettings?.paymentQrUrl || '');

  // Menu State
  const [newCategory, setNewCategory] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<{isOpen: boolean, message: string, onConfirm: () => void}>({isOpen: false, message: '', onConfirm: () => {}});

  const confirmAction = (message: string, action: () => void) => {
    setConfirmDialog({ isOpen: true, message, onConfirm: action });
  };

  const saveBranding = async () => {
    const path = 'settings/config';
    try {
      await setDoc(doc(db, 'settings', 'config'), {
        shopName,
        logoUrl,
        paymentQrUrl
      });
      toast('Branding & settings saved!', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const addCategory = async () => {
    if (!newCategory) return;
    const path = 'categories';
    try {
      await addDoc(collection(db, path), {
        name: newCategory,
        order: categories.length
      });
      setNewCategory('');
      toast('Category added', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const deleteCategory = async (id: string) => {
    confirmAction('Are you sure? This will not delete products in this category.', async () => {
      const path = `categories/${id}`;
      try {
        await deleteDoc(doc(db, 'categories', id));
        toast('Category deleted', 'info');
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
    });
  };

  // Ingredient Handlers
  const openAddIngredientModal = () => {
    setEditingIngredient(null);
    setIngredientForm({ name: '', unit: 'g', stock: '', minThreshold: '10' });
    setIsIngredientModalOpen(true);
  };

  const openEditIngredientModal = (item: any) => {
    setEditingIngredient(item);
    setIngredientForm({
      name: item.name,
      unit: item.unit || 'g',
      stock: String(item.stock ?? 0),
      minThreshold: String(item.minThreshold ?? 10)
    });
    setIsIngredientModalOpen(true);
  };

  const openRestockModal = (item: any) => {
    setRestockingItem(item);
    setRestockAmount('');
    setIsRestockModalOpen(true);
  };

  const handleSaveIngredient = async () => {
    if (!ingredientForm.name.trim() || !ingredientForm.stock) {
      toast('Please provide ingredient name and stock', 'error');
      return;
    }
    const stockNum = parseFloat(ingredientForm.stock) || 0;
    const minNum = parseFloat(ingredientForm.minThreshold) || 10;

    try {
      if (editingIngredient) {
        await inventoryService.updateIngredient(currentBranch, editingIngredient.id, {
          name: ingredientForm.name.trim(),
          unit: ingredientForm.unit,
          stock: stockNum,
          minThreshold: minNum,
        });
        toast('Ingredient updated', 'success');
      } else {
        await inventoryService.addIngredient(currentBranch, {
          name: ingredientForm.name.trim(),
          unit: ingredientForm.unit,
          stock: stockNum,
          minThreshold: minNum,
        });
        toast('Ingredient added', 'success');
      }
      setIsIngredientModalOpen(false);
      setEditingIngredient(null);
      setIngredientForm({ name: '', unit: 'g', stock: '', minThreshold: '10' });
    } catch (e: any) {
      toast(e.message || 'Error saving ingredient', 'error');
    }
  };

  const handleRestockSubmit = async () => {
    if (!restockingItem || !restockAmount) return;
    const amt = parseFloat(restockAmount);
    if (isNaN(amt) || amt === 0) {
      toast('Please enter a valid non-zero amount', 'error');
      return;
    }
    try {
      await inventoryService.restockIngredient(currentBranch, restockingItem.id, amt);
      toast(`Stock adjusted by ${amt > 0 ? '+' : ''}${amt} ${restockingItem.unit}`, 'success');
      setIsRestockModalOpen(false);
      setRestockingItem(null);
      setRestockAmount('');
    } catch (e: any) {
      toast('Error adjusting stock', 'error');
    }
  };

  const handleDeleteIngredient = (id: string) => {
    confirmAction('Are you sure you want to delete this ingredient?', async () => {
      await inventoryService.deleteIngredient(currentBranch, id);
      toast('Ingredient removed', 'info');
    });
  };

  // Expense Handlers
  const handleAddExpense = async () => {
    if (!expenseForm.amount || !expenseForm.description.trim()) {
      toast('Please provide amount and description', 'error');
      return;
    }
    const amt = parseFloat(expenseForm.amount);
    if (isNaN(amt) || amt <= 0) {
      toast('Amount must be greater than 0', 'error');
      return;
    }
    try {
      await addDoc(collection(db, 'expenses'), {
        category: expenseForm.category,
        amount: amt,
        description: expenseForm.description.trim(),
        branchId: currentBranch,
        date: Timestamp.now()
      });
      toast('Expense logged successfully', 'success');
      setIsExpenseModalOpen(false);
      setExpenseForm({ category: 'ingredients', amount: '', description: '' });
    } catch (e) {
      toast('Failed to log expense', 'error');
    }
  };

  const handleDeleteExpense = (id: string) => {
    confirmAction('Delete this expense log?', async () => {
      try {
        await deleteDoc(doc(db, 'expenses', id));
        toast('Expense deleted', 'info');
      } catch (e) {
        toast('Failed to delete expense', 'error');
      }
    });
  };

  // Recipe Linking Handlers
  const openRecipeModal = async (product: any) => {
    setSelectedRecipeProduct(product);
    try {
      const rec = await inventoryService.getRecipe(product.id);
      setRecipeIngredients(rec?.ingredients || []);
    } catch {
      setRecipeIngredients([]);
    }
    setIsRecipeModalOpen(true);
  };

  const handleSaveRecipe = async () => {
    if (!selectedRecipeProduct) return;
    try {
      await inventoryService.saveRecipe(selectedRecipeProduct.id, recipeIngredients);
      toast(`Recipe for ${selectedRecipeProduct.name} saved!`, 'success');
      setIsRecipeModalOpen(false);
    } catch {
      toast('Failed to save recipe', 'error');
    }
  };

  const handleAddIngredientToRecipe = () => {
    if (!newRecipeItem.ingredientId || !newRecipeItem.quantity) return;
    const qty = parseFloat(newRecipeItem.quantity);
    if (isNaN(qty) || qty <= 0) return;

    setRecipeIngredients(prev => {
      const filtered = prev.filter(item => item.ingredientId !== newRecipeItem.ingredientId);
      return [...filtered, { ingredientId: newRecipeItem.ingredientId, quantity: qty }];
    });
    setNewRecipeItem({ ingredientId: '', quantity: '' });
  };

  const handleRemoveIngredientFromRecipe = (ingredientId: string) => {
    setRecipeIngredients(prev => prev.filter(item => item.ingredientId !== ingredientId));
  };

  // Branch Handlers
  const handleAddBranch = async () => {
    if (!branchForm.name.trim()) {
      toast('Branch name is required', 'error');
      return;
    }
    try {
      await addDoc(collection(db, 'branches'), {
        name: branchForm.name.trim(),
        address: branchForm.address.trim(),
        status: 'active',
        createdAt: Timestamp.now()
      });
      toast('New branch created!', 'success');
      setIsBranchModalOpen(false);
      setBranchForm({ name: '', address: '' });
    } catch (e) {
      toast('Failed to create branch', 'error');
    }
  };

  const handleTestPrint = async () => {
    try {
      setIsPrinterConnecting(true);
      await printerService.printTestReceipt(shopSettings?.shopName || 'CoffeeGarage');
      toast('Test receipt printed!', 'success');
    } catch (err: any) {
      toast(err.message || 'Printer failed or not connected', 'error');
    } finally {
      setIsPrinterConnecting(false);
    }
  };

  const handleProductSubmit = async () => {
    if (!productForm.name || !productForm.price || !productForm.categoryId) return;
    const path = editingProduct ? `products/${editingProduct.id}` : 'products';
    try {
      const productData = {
        ...productForm,
        price: parseFloat(productForm.price as string)
      };

      if (editingProduct) {
        await updateDoc(doc(db, 'products', editingProduct.id), productData);
        setEditingProduct(null);
        toast('Product updated', 'success');
      } else {
        await addDoc(collection(db, 'products'), productData);
        toast('Product added', 'success');
      }
      setProductForm({ name: '', price: '', categoryId: '', imageUrl: '', description: '' });
    } catch (error) {
      handleFirestoreError(error, editingProduct ? OperationType.UPDATE : OperationType.CREATE, path);
    }
  };

  const startEdit = (product: any) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      price: product.price.toString(),
      categoryId: product.categoryId,
      imageUrl: product.imageUrl || '',
      description: product.description || ''
    });
    // Scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingProduct(null);
    setProductForm({ name: '', price: '', categoryId: '', imageUrl: '', description: '' });
  };

  const handleConnectPrinter = async () => {
    setIsPrinterConnecting(true);
    try {
      const name = await printerService.connect();
      setConnectedPrinterName(name);
    } catch (error: any) {
      toast(error instanceof Error ? error.message : 'Failed to connect to printer', 'error');
    } finally {
      setIsPrinterConnecting(false);
    }
  };

  const handleDisconnectPrinter = () => {
    printerService.disconnect();
    setConnectedPrinterName(null);
  };

  const handleSaveStaff = async () => {
    const username = staffForm.username.trim();
    const passcode = staffForm.passcode.trim();
    if (!username || !passcode) {
      toast('Please enter staff name and passcode', 'error');
      return;
    }
    const path = editingStaff ? `staff/${editingStaff.id}` : 'staff';
    try {
      if (editingStaff) {
        await updateDoc(doc(db, 'staff', editingStaff.id), {
          ...staffForm,
          username,
          passcode
        });
        setEditingStaff(null);
        toast('Staff member updated successfully', 'success');
      } else {
        await addDoc(collection(db, path), {
          ...staffForm,
          username,
          passcode,
          createdAt: Timestamp.now()
        });
        toast('Staff member added successfully', 'success');
      }
      setStaffForm({ username: '', passcode: '', role: 'cashier', branchId: 'default' });
    } catch (e) {
      handleFirestoreError(e, editingStaff ? OperationType.UPDATE : OperationType.CREATE, path);
    }
  };

  const startEditStaff = (staff: any) => {
    setEditingStaff(staff);
    setStaffForm({
      username: staff.username,
      passcode: staff.passcode,
      role: staff.role || 'cashier',
      branchId: staff.branchId || 'default'
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEditStaff = () => {
    setEditingStaff(null);
    setStaffForm({ username: '', passcode: '', role: 'cashier', branchId: 'default' });
  };

  const handleUpdateAdminPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordFeedback(null);

    if (!currentPassword) {
      setPasswordFeedback({ type: 'error', text: 'Please enter your current admin password.' });
      return;
    }
    if (!newPassword || newPassword.trim().length < 4) {
      setPasswordFeedback({ type: 'error', text: 'New password must be at least 4 characters long.' });
      return;
    }
    if (newPassword.trim() !== confirmPassword.trim()) {
      setPasswordFeedback({ type: 'error', text: 'New password and confirmation do not match.' });
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const res = await adminAuthService.changePassword(currentPassword, newPassword, adminUsername);
      if (res.success) {
        setPasswordFeedback({ type: 'success', text: 'Admin password updated successfully! You can now use your new password.' });
        toast('Admin password updated successfully!', 'success');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        if (setAdminProfile) {
          setAdminProfile({ username: adminUsername.trim() || 'admin' });
        }
      } else {
        setPasswordFeedback({ type: 'error', text: res.error || 'Failed to update admin password.' });
        toast(res.error || 'Failed to update admin password', 'error');
      }
    } catch (err: any) {
      setPasswordFeedback({ type: 'error', text: err.message || 'Error updating password.' });
      toast('Error updating password', 'error');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const deleteStaff = async (id: string) => {
    confirmAction('Delete staff member?', async () => {
      const path = `staff/${id}`;
      try {
        await deleteDoc(doc(db, 'staff', id));
        toast('Staff member removed', 'info');
      } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, path);
      }
    });
  };

  const deleteProduct = async (id: string) => {
    confirmAction('Are you sure you want to delete this product?', async () => {
      const path = `products/${id}`;
      try {
        await deleteDoc(doc(db, 'products', id));
        toast('Product removed', 'info');
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
    });
  };

  const handleTestDrawer = async () => {
    try {
      await printerService.openDrawer();
    } catch (error: any) {
      toast(error instanceof Error ? error.message : 'Printer not connected', 'error');
    }
  };

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      <header className="shrink-0 border-b border-gray-200 bg-white">
        <div className="h-16 flex items-center justify-between px-4 md:px-6">
          <div className="flex items-center space-x-2 md:space-x-4">
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <ArrowLeft className="w-5 h-5 md:w-6 h-6" />
            </button>
            <h1 className="text-lg md:text-xl font-bold truncate">Admin</h1>
          </div>
          <div className="hidden sm:flex space-x-1 lg:space-x-2">
            <NavTabs activeTab={activeTab} setActiveTab={setActiveTab} />
          </div>
          <div className="sm:hidden">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{activeTab}</span>
          </div>
        </div>
        <div className="sm:hidden px-4 pb-3 flex overflow-x-auto space-x-2 no-scrollbar">
          <NavTabs activeTab={activeTab} setActiveTab={setActiveTab} />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 md:p-8 max-w-6xl mx-auto w-full">
        {activeTab === 'analytics' ? (
          <div className="space-y-8 animate-in fade-in duration-500">
            {(() => {
              const totalRevenue = orders.reduce((s, o) => s + (o.total || 0), 0);
              const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
              const netProfit = totalRevenue - totalExpenses;
              const lowStockCount = inventory.filter(i => (i.stock ?? 0) < (i.minThreshold ?? 10)).length;
              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: 'Total Revenue', value: formatPHP(totalRevenue), color: 'bg-blue-500', trend: `${orders.length} orders` },
                    { label: 'Total Expenses', value: formatPHP(totalExpenses), color: 'bg-red-500', trend: `${expenses.length} logs` },
                    { label: 'Net Profit', value: formatPHP(netProfit), color: netProfit >= 0 ? 'bg-emerald-500' : 'bg-rose-500', trend: netProfit >= 0 ? 'Profitable' : 'Loss' },
                    { label: 'Low Stock Items', value: `${lowStockCount} items`, color: 'bg-amber-500', trend: lowStockCount > 0 ? 'Needs restock' : 'Healthy' }
                  ].map((stat, i) => (
                    <div key={i} className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-md transition-all group overflow-hidden relative">
                      <div className={cn("absolute top-0 right-0 w-24 h-24 blur-3xl opacity-10 rounded-full -translate-y-1/2 translate-x-1/2", stat.color)} />
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{stat.label}</p>
                      <div className="flex items-end justify-between">
                        <p className="text-2xl lg:text-3xl font-black text-gray-900">{stat.value}</p>
                        <span className={cn(
                          "text-[10px] font-bold px-2 py-1 rounded-lg",
                          stat.trend === 'Profitable' || stat.trend === 'Healthy' ? "bg-green-50 text-green-600" :
                          stat.trend === 'Needs restock' || stat.trend === 'Loss' ? "bg-red-50 text-red-600" : "bg-gray-100 text-gray-600"
                        )}>
                          {stat.trend}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm relative overflow-hidden">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-bold">Revenue Trend</h3>
                  <div className="flex gap-2">
                    <span className="w-3 h-3 bg-gray-900 rounded-full" />
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Recent Orders</span>
                  </div>
                </div>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={orders.slice(-20).map(o => ({ name: format(safeToDate(o.createdAt), 'HH:mm'), total: o.total }))}>
                      <defs>
                        <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#111827" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#111827" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9CA3AF'}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9CA3AF'}} />
                      <Tooltip contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }} />
                      <Area type="monotone" dataKey="total" stroke="#111827" strokeWidth={4} fillOpacity={1} fill="url(#colorTotal)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
                <h3 className="text-xl font-bold mb-8">Sales by Staff</h3>
                <div className="space-y-6">
                  {staffMembers.slice(0, 5).map((staff, i) => {
                    const staffSales = orders.filter(o => o.userId === staff.username || o.userId === staff.id).reduce((s, o) => s + (o.total || 0), 0);
                    return (
                      <div key={i} className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center font-black text-gray-400 text-xs shadow-inner">
                          {staff.username.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between items-center mb-1">
                            <p className="text-sm font-bold text-gray-900">{staff.username}</p>
                            <p className="text-xs font-black">₱{staffSales.toFixed(0)}</p>
                          </div>
                          <div className="w-full bg-gray-50 h-1.5 rounded-full">
                            <div 
                              className="h-full bg-gray-900 rounded-full transition-all duration-1000"
                              style={{ width: `${Math.min(100, (staffSales / (orders.reduce((s, o) => s + (o.total || 0), 0) || 1)) * 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'inventory' ? (
          <div className="space-y-8 animate-in fade-in duration-300">
             <section className="bg-gray-50 p-6 md:p-8 rounded-[2rem] border border-gray-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-2xl font-bold flex items-center text-gray-900">
                      <Package className="w-6 h-6 mr-2 text-gray-900" />
                      Stock Management
                    </h2>
                    <p className="text-xs text-gray-500 mt-1">
                      Monitor beans, milk, syrups, powders, and packaging. Stock auto-deducts upon customer orders.
                    </p>
                  </div>
                  <button 
                    onClick={openAddIngredientModal}
                    className="px-5 py-3 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-gray-800 transition-all flex items-center gap-2 self-start sm:self-auto shadow-md"
                  >
                    <Plus className="w-4 h-4" />
                    Add Ingredient
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                   {inventory.map(item => {
                     const isLow = (item.stock ?? 0) <= (item.minThreshold ?? 10);
                     return (
                       <div key={item.id} className="bg-white p-6 rounded-2xl border border-gray-200 flex flex-col justify-between shadow-sm hover:border-gray-300 transition-all">
                          <div>
                            <div className="flex justify-between items-start mb-2">
                               <h4 className="font-bold text-gray-900 text-base">{item.name}</h4>
                               <span className={cn(
                                 "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider",
                                 isLow ? "bg-red-50 text-red-600 border border-red-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                               )}>
                                 {item.stock} {item.unit}
                               </span>
                            </div>
                            <div className="w-full bg-gray-100 h-2 rounded-full mb-3 overflow-hidden">
                               <div 
                                 className={cn("h-full rounded-full transition-all", isLow ? "bg-red-500" : "bg-emerald-500")}
                                 style={{ width: `${Math.min(100, (item.stock / (Math.max(item.minThreshold * 2, 1))) * 100)}%` }}
                               />
                            </div>
                            <p className="text-xs text-gray-400">Min Alert Threshold: {item.minThreshold} {item.unit}</p>
                          </div>

                          <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between">
                            <button
                              onClick={() => openRestockModal(item)}
                              className="px-3 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              Restock
                            </button>
                            <div className="flex items-center space-x-1">
                              <button
                                onClick={() => openEditIngredientModal(item)}
                                className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                                title="Edit Ingredient"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteIngredient(item.id)}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete Ingredient"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                       </div>
                     );
                   })}
                   <button 
                     onClick={openAddIngredientModal}
                     className="border-2 border-dashed border-gray-200 rounded-2xl p-6 flex flex-col items-center justify-center text-gray-400 hover:border-gray-900 hover:text-gray-900 transition-all min-h-[160px]"
                   >
                      <Plus className="w-8 h-8 mb-2" />
                      <span className="font-bold">Add Ingredient</span>
                   </button>
                </div>
             </section>
          </div>
        ) : activeTab === 'branches' ? (
          <div className="space-y-8 animate-in fade-in duration-300">
            <section className="bg-gray-50 p-6 md:p-8 rounded-[2rem] border border-gray-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-2xl font-bold flex items-center text-gray-900">
                    <Store className="w-6 h-6 mr-2 text-gray-900" />
                    Branches & Multi-Location Management
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">
                    Manage store branches, locations, and warehouse assignments.
                  </p>
                </div>
                <button
                  onClick={() => setIsBranchModalOpen(true)}
                  className="px-5 py-3 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-gray-800 transition-all flex items-center gap-2 self-start sm:self-auto shadow-md"
                >
                  <Plus className="w-4 h-4" />
                  Add Branch
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Default main branch card */}
                <div className="bg-white p-6 rounded-2xl border border-gray-200 flex flex-col justify-between shadow-sm">
                  <div>
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-bold text-gray-900 text-base">Main Store / Garage</h4>
                      <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase rounded-full border border-emerald-200">
                        Default
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mb-3">Primary Café Branch</p>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <Users className="w-3.5 h-3.5" />
                      <span>{staffMembers.filter(s => !s.branchId || s.branchId === 'default').length} Staff Assigned</span>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-[11px] font-mono text-gray-400">ID: default</span>
                    <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Active
                    </span>
                  </div>
                </div>

                {/* Dynamic branches */}
                {branches.map(b => (
                  <div key={b.id} className="bg-white p-6 rounded-2xl border border-gray-200 flex flex-col justify-between shadow-sm">
                    <div>
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-bold text-gray-900 text-base">{b.name}</h4>
                        <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold uppercase rounded-full border border-blue-200">
                          {b.status || 'Active'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mb-3">{b.address || 'No physical address specified'}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <Users className="w-3.5 h-3.5" />
                        <span>{staffMembers.filter(s => s.branchId === b.id).length} Staff Assigned</span>
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                      <span className="text-[11px] font-mono text-gray-400">ID: {b.id.slice(0, 8)}...</span>
                      <button
                        onClick={() => {
                          confirmAction(`Delete branch ${b.name}?`, async () => {
                            await deleteDoc(doc(db, 'branches', b.id));
                            toast('Branch deleted', 'info');
                          });
                        }}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Branch"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : activeTab === 'customers' ? (
          <div className="space-y-8 animate-in fade-in duration-300">
            <section className="bg-gray-50 p-6 md:p-8 rounded-[2rem] border border-gray-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-2xl font-bold flex items-center text-gray-900">
                    <Heart className="w-6 h-6 mr-2 text-rose-500" />
                    Loyalty Program &amp; Membership Cards
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">
                    Manage member cards, search card numbers, and reward frequent café customers.
                  </p>
                </div>
                <button
                  onClick={openAddCustomerModal}
                  className="px-5 py-3 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-gray-800 transition-all flex items-center gap-2 self-start sm:self-auto shadow-md"
                >
                  <Plus className="w-4 h-4" />
                  Issue Loyalty Card
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative mb-6">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={customerSearchQuery}
                  onChange={(e) => setCustomerSearchQuery(e.target.value)}
                  placeholder="Search by Card Number (e.g. CG-1001), Customer Name, or Phone..."
                  className="w-full pl-11 pr-16 py-3.5 bg-white border border-gray-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-gray-900 shadow-sm font-medium"
                />
                {customerSearchQuery && (
                  <button
                    onClick={() => setCustomerSearchQuery('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 hover:text-gray-600 bg-gray-100 px-2.5 py-1 rounded-lg"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Cards Grid */}
              {(() => {
                const q = customerSearchQuery.trim().toLowerCase();
                const filteredCustomers = customers.filter(c => {
                  if (!q) return true;
                  return (
                    c.name?.toLowerCase().includes(q) ||
                    c.cardNumber?.toLowerCase().includes(q) ||
                    c.phone?.toLowerCase().includes(q)
                  );
                });

                if (filteredCustomers.length === 0) {
                  return (
                    <div className="py-16 text-center bg-white rounded-3xl border border-dashed border-gray-200">
                      <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <h4 className="text-base font-bold text-gray-700">No loyalty cards found</h4>
                      <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                        {customerSearchQuery 
                          ? `No card matching "${customerSearchQuery}". Check the card number or name.`
                          : 'No loyalty cards issued yet. Click "+ Issue Loyalty Card" above to register your first member!'}
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredCustomers.map(c => (
                      <div 
                        key={c.id} 
                        className="bg-white rounded-3xl border border-gray-200 p-6 flex flex-col justify-between shadow-sm hover:shadow-md hover:border-gray-300 transition-all relative overflow-hidden group"
                      >
                        {/* Membership card decorative stripe */}
                        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600" />

                        <div>
                          {/* Card Header: Card Number & Badge */}
                          <div className="flex justify-between items-start mb-3 pt-1">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 text-xs font-mono font-black rounded-xl border border-amber-200 shadow-xs">
                              <CreditCard className="w-3.5 h-3.5 text-amber-600" />
                              {c.cardNumber || 'NO CARD #'}
                            </span>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                              Member
                            </span>
                          </div>

                          {/* Member details */}
                          <h4 className="text-lg font-black text-gray-900 group-hover:text-amber-900 transition-colors">
                            {c.name}
                          </h4>
                          <p className="text-xs text-gray-500 font-medium mt-0.5">
                            {c.phone ? `📱 ${c.phone}` : 'No phone number registered'}
                          </p>

                          {/* Points Display */}
                          <div className="mt-4 p-3 bg-gradient-to-br from-amber-50/70 to-orange-50/70 rounded-2xl border border-amber-100/80 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black text-xs shadow-sm">
                                ★
                              </div>
                              <div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800/80">Balance</span>
                                <p className="text-base font-black text-gray-900 leading-tight">
                                  {c.points ?? 0} <span className="text-xs font-semibold text-gray-500">pts</span>
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => openPointsAdjustmentModal(c)}
                              className="px-2.5 py-1.5 bg-white text-gray-800 hover:bg-gray-50 border border-gray-200 rounded-xl text-[11px] font-bold shadow-xs transition-colors"
                              title="Add or deduct points"
                            >
                              +/- Points
                            </button>
                          </div>
                        </div>

                        {/* Card footer actions */}
                        <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                          <span className="text-[11px] text-gray-400">
                            1 pt = ₱1 discount
                          </span>
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={() => openEditCustomerModal(c)}
                              className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                              title="Edit Loyalty Card"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteCustomer(c)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete Loyalty Member"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </section>
          </div>
        ) : activeTab === 'expenses' ? (
          <div className="space-y-8 animate-in fade-in duration-300">
             <section className="bg-gray-50 p-6 md:p-8 rounded-[2rem] border border-gray-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-2xl font-bold mb-1 flex items-center text-gray-900">
                      <Wallet className="w-6 h-6 mr-2 text-green-600" />
                      Expense Log
                    </h2>
                    <p className="text-xs text-gray-500">Record operating expenses, ingredients, utilities, and wages.</p>
                  </div>
                  <button
                    onClick={() => setIsExpenseModalOpen(true)}
                    className="px-5 py-3 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-gray-800 transition-all flex items-center gap-2 self-start sm:self-auto shadow-md"
                  >
                    <Plus className="w-4 h-4" />
                    Log Expense
                  </button>
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                   {expenses.length === 0 ? (
                     <div className="p-12 text-center text-gray-400">
                       <Wallet className="w-10 h-10 mx-auto mb-2 opacity-30" />
                       <p className="text-sm font-medium">No expenses logged yet</p>
                     </div>
                   ) : (
                     <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b border-gray-100">
                           <tr>
                              <th className="p-4 text-xs font-black uppercase text-gray-400">Date</th>
                              <th className="p-4 text-xs font-black uppercase text-gray-400">Category</th>
                              <th className="p-4 text-xs font-black uppercase text-gray-400">Description</th>
                              <th className="p-4 text-xs font-black uppercase text-gray-400 text-right">Amount</th>
                              <th className="p-4 text-xs font-black uppercase text-gray-400 text-center">Action</th>
                           </tr>
                        </thead>
                        <tbody>
                           {expenses.map(e => (
                             <tr key={e.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                                <td className="p-4 text-sm font-medium">{format(safeToDate(e.date), 'MMM dd, yyyy')}</td>
                                <td className="p-4"><span className="px-2.5 py-1 bg-gray-100 text-[10px] font-black rounded-lg uppercase tracking-wider">{e.category}</span></td>
                                <td className="p-4 text-sm text-gray-600">{e.description}</td>
                                <td className="p-4 text-sm font-bold text-right text-red-500">-₱{e.amount.toFixed(2)}</td>
                                <td className="p-4 text-center">
                                  <button
                                    onClick={() => handleDeleteExpense(e.id)}
                                    className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                                    title="Delete expense entry"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                             </tr>
                           ))}
                        </tbody>
                     </table>
                   )}
                </div>
             </section>
          </div>
        ) : activeTab === 'branding' ? (
          <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <section className="bg-gray-50 p-5 md:p-8 rounded-[2rem] border border-gray-100">
              <h2 className="text-xl md:text-2xl font-bold mb-6">Shop Branding</h2>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Shop Name</label>
                  <input 
                    type="text" 
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    className="w-full p-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-gray-900 outline-none transition-all"
                    placeholder="e.g. The Coffee House"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Logo URL</label>
                  <div className="flex space-x-4">
                    <input 
                      type="text" 
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                      className="flex-1 p-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-gray-900 outline-none transition-all"
                      placeholder="https://example.com/logo.png"
                    />
                    <div className="w-14 h-14 bg-white rounded-xl border border-gray-200 flex items-center justify-center overflow-hidden shrink-0">
                      {logoUrl ? <img src={logoUrl} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <ImageIcon className="text-gray-300" />}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Payment QR URL (Maya/GCash)</label>
                  <div className="flex space-x-4">
                    <input 
                      type="text" 
                      value={paymentQrUrl}
                      onChange={(e) => setPaymentQrUrl(e.target.value)}
                      className="flex-1 p-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-gray-900 outline-none transition-all"
                      placeholder="https://example.com/my-gcash-qr.png"
                    />
                    <div className="w-14 h-14 bg-white rounded-xl border border-gray-200 flex items-center justify-center overflow-hidden shrink-0">
                      {paymentQrUrl ? <img src={paymentQrUrl} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <ImageIcon className="text-gray-300" />}
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">Upload your GCash/Maya QR to an image host (like Imgur) and paste the direct link here. It will be shown to customers during checkout.</p>
                </div>
                <button 
                  onClick={saveBranding}
                  className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold flex items-center justify-center hover:bg-gray-800 transition-all"
                >
                  <Save className="w-5 h-5 mr-2" />
                  Save Changes
                </button>
              </div>
            </section>
          </div>
        ) : activeTab === 'menu' ? (
          <div className="space-y-8 md:space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* Categories */}
            <section className="bg-gray-50 p-5 md:p-8 rounded-[2rem] border border-gray-100">
              <h2 className="text-xl md:text-2xl font-bold mb-6 flex items-center">
                <LayoutGrid className="w-6 h-6 mr-2" />
                Categories
              </h2>
              <div className="flex space-x-4 mb-6">
                <input 
                  type="text" 
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="flex-1 p-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-gray-900 outline-none"
                  placeholder="New Category Name"
                />
                <button onClick={addCategory} className="px-6 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800">
                  <Plus className="w-5 h-5" />
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {categories.map(cat => (
                  <div key={cat.id} className="bg-white p-4 rounded-xl border border-gray-200 flex items-center justify-between">
                    <span className="font-medium">{cat.name}</span>
                    <button onClick={() => deleteCategory(cat.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* Products */}
            <section className="bg-gray-50 p-5 md:p-8 rounded-[2rem] border border-gray-100">
              <h2 className="text-xl md:text-2xl font-bold mb-6 flex items-center">
                <Coffee className="w-6 h-6 mr-2" />
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </h2>
              <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-1">
                  <label className="block text-sm font-bold text-gray-700 mb-1">Name</label>
                  <input 
                    type="text" 
                    value={productForm.name}
                    onChange={(e) => setProductForm({...productForm, name: e.target.value})}
                    className="w-full p-4 rounded-xl border border-gray-200"
                    placeholder="Product Name"
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="block text-sm font-bold text-gray-700 mb-1">Price</label>
                  <input 
                    type="number" 
                    value={productForm.price}
                    onChange={(e) => setProductForm({...productForm, price: e.target.value})}
                    className="w-full p-4 rounded-xl border border-gray-200"
                    placeholder="Price"
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="block text-sm font-bold text-gray-700 mb-1">Category</label>
                  <select 
                    value={productForm.categoryId}
                    onChange={(e) => setProductForm({...productForm, categoryId: e.target.value})}
                    className="w-full p-4 rounded-xl border border-gray-200 bg-white"
                  >
                    <option value="">Select Category</option>
                    {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                  </select>
                </div>
                <div className="md:col-span-1">
                  <label className="block text-sm font-bold text-gray-700 mb-1">Image URL</label>
                  <input 
                    type="text" 
                    value={productForm.imageUrl}
                    onChange={(e) => setProductForm({...productForm, imageUrl: e.target.value})}
                    className="w-full p-4 rounded-xl border border-gray-200"
                    placeholder="Image URL (Optional)"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-1">Description</label>
                  <textarea 
                    value={productForm.description}
                    onChange={(e) => setProductForm({...productForm, description: e.target.value})}
                    className="w-full p-4 rounded-xl border border-gray-200"
                    placeholder="Description (Optional)"
                    rows={3}
                  />
                </div>
                <div className="md:col-span-2 flex space-x-4">
                  <button onClick={handleProductSubmit} className="flex-1 py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-gray-800">
                    {editingProduct ? 'Save Product' : 'Add Product'}
                  </button>
                  {editingProduct && (
                    <button onClick={cancelEdit} className="px-6 py-4 border-2 border-gray-200 text-gray-500 rounded-2xl font-bold hover:bg-gray-100">
                      Cancel
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {products.map(product => (
                  <div key={product.id} className="bg-white p-4 rounded-xl border border-gray-200 flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                      {product.imageUrl ? <img src={product.imageUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <Coffee className="w-6 h-6 m-3 text-gray-300" />}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-sm">{product.name}</h4>
                      <p className="text-xs text-gray-500">₱{product.price.toFixed(2)}</p>
                    </div>
                    <div className="flex items-center space-x-1">
                      <button 
                        onClick={() => openRecipeModal(product)} 
                        className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                        title="Configure Recipe / Deducted Ingredients"
                      >
                        <ChefHat className="w-4 h-4" />
                      </button>
                      <button onClick={() => startEdit(product)} className="p-2 text-gray-400 hover:text-gray-900 transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteProduct(product.id)} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : activeTab === 'hardware' ? (
          <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <section className="bg-gray-50 p-5 md:p-8 rounded-[2rem] border border-gray-100">
              <h2 className="text-xl md:text-2xl font-bold mb-6 flex items-center">
                <Printer className="w-6 h-6 mr-2" />
                Receipt Printer & Cash Drawer
              </h2>
              <div className="space-y-6">
                <div className="p-6 bg-white rounded-2xl border border-gray-200 flex items-center justify-between shadow-sm">
                  <div>
                    <h3 className="font-bold text-gray-900">Bluetooth Thermal Printer (ESC/POS)</h3>
                    <p className="text-sm text-gray-500">
                      {connectedPrinterName ? `Connected to: ${connectedPrinterName}` : 'No printer connected via Bluetooth'}
                    </p>
                  </div>
                  {connectedPrinterName ? (
                    <button 
                      onClick={handleDisconnectPrinter}
                      className="px-4 py-2 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 transition-all flex items-center"
                    >
                      <BluetoothOff className="w-4 h-4 mr-2" />
                      Disconnect
                    </button>
                  ) : (
                    <button 
                      onClick={handleConnectPrinter}
                      disabled={isPrinterConnecting}
                      className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl font-bold hover:bg-blue-100 transition-all flex items-center disabled:opacity-50"
                    >
                      <Bluetooth className="w-4 h-4 mr-2" />
                      {isPrinterConnecting ? 'Connecting...' : 'Connect Printer'}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button 
                    onClick={handleTestDrawer}
                    className="p-6 bg-white rounded-2xl border border-gray-200 hover:border-gray-900 transition-all flex flex-col items-center justify-center space-y-2 group shadow-sm"
                  >
                    <Zap className="w-8 h-8 text-yellow-500 group-hover:scale-110 transition-transform" />
                    <span className="font-bold text-gray-900">Open Cash Drawer</span>
                    <span className="text-xs text-gray-500">Sends test pulse to drawer</span>
                  </button>
                  
                  <button 
                    onClick={handleTestPrint}
                    disabled={isPrinterConnecting}
                    className="p-6 bg-white rounded-2xl border border-gray-200 hover:border-gray-900 transition-all flex flex-col items-center justify-center space-y-2 group shadow-sm disabled:opacity-50"
                  >
                    <Printer className="w-8 h-8 text-blue-500 group-hover:scale-110 transition-transform" />
                    <span className="font-bold text-gray-900">Print Test Receipt</span>
                    <span className="text-xs text-gray-500">{isPrinterConnecting ? 'Printing...' : 'Prints sample CoffeeGarage receipt'}</span>
                  </button>
                </div>
                
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <p className="text-xs text-blue-700 leading-relaxed">
                    <strong>Note:</strong> Ensure your Bluetooth printer supports ESC/POS commands. 
                    The cash drawer must be connected to the printer via RJ11 cable.
                    Chrome/Edge browser recommended for Web Bluetooth.
                  </p>
                </div>
              </div>
            </section>
          </div>
        ) : activeTab === 'staff' ? (
          <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <section className="bg-gray-50 p-5 md:p-8 rounded-[2rem] border border-gray-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold flex items-center text-gray-900">
                    <Users className="w-6 h-6 mr-2 text-gray-900" />
                    Staff & Team Management
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">
                    Add and manage team members like Cashiers, Managers, Baristas, and Kitchen staff.
                  </p>
                </div>
                {editingStaff && (
                  <button 
                    onClick={cancelEditStaff}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-300 transition-all"
                  >
                    Cancel Editing
                  </button>
                )}
              </div>

              <div className="bg-white p-6 rounded-2xl border border-gray-200 mb-8 space-y-4 shadow-sm">
                <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    {editingStaff ? `Editing Staff: ${editingStaff.username}` : 'Add New Staff Member'}
                  </span>
                  <span className="text-[11px] text-gray-400">PINs can be 4-6 digits or alphanumeric</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Staff / Username</label>
                    <input 
                      type="text" 
                      value={staffForm.username}
                      onChange={(e) => setStaffForm({...staffForm, username: e.target.value})}
                      placeholder="e.g. Maria Cashier"
                      className="w-full p-3.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Passcode / PIN</label>
                    <input 
                      type="text" 
                      value={staffForm.passcode}
                      onChange={(e) => setStaffForm({...staffForm, passcode: e.target.value})}
                      placeholder="e.g. 1234"
                      className="w-full p-3.5 rounded-xl border border-gray-200 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Assigned Branch</label>
                    <select 
                      value={staffForm.branchId}
                      onChange={(e) => setStaffForm({...staffForm, branchId: e.target.value})}
                      className="w-full p-3.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    >
                      <option value="default">Default Branch</option>
                      {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 pt-2">
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-gray-600 mb-1">System Role</label>
                    <select 
                      value={staffForm.role}
                      onChange={(e) => setStaffForm({...staffForm, role: e.target.value})}
                      className="w-full p-3.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-gray-900"
                    >
                      <option value="cashier">Cashier (Point of Sale, Shifts, Cash Register)</option>
                      <option value="manager">Store Manager (Menu, Inventory, Shifts & Reports)</option>
                      <option value="kitchen">Kitchen Staff (Kitchen Display Screen / KDS)</option>
                      <option value="supervisor">Shift Supervisor (Floor & Voids)</option>
                      <option value="staff">Counter / Barista Staff (Standard POS)</option>
                      <option value="admin">Administrator (Full Access)</option>
                    </select>
                  </div>
                  <div className="sm:self-end flex gap-2">
                    {editingStaff && (
                      <button 
                        onClick={cancelEditStaff}
                        className="py-3.5 px-5 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 text-sm"
                      >
                        Cancel
                      </button>
                    )}
                    <button 
                      onClick={handleSaveStaff}
                      className="flex-1 sm:flex-initial py-3.5 px-8 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 text-sm shadow-md transition-all active:scale-95"
                    >
                      {editingStaff ? 'Update Staff Member' : '+ Add Staff Member'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {staffMembers.length === 0 ? (
                  <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-dashed border-gray-200">
                    <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500 font-medium text-sm">No staff members created yet.</p>
                    <p className="text-xs text-gray-400 mt-1">Use the form above to add your first Cashier or Manager.</p>
                  </div>
                ) : (
                  staffMembers.map(staff => (
                    <div key={staff.id} className="bg-white p-5 rounded-2xl border border-gray-200 flex flex-col justify-between hover:border-gray-300 transition-all shadow-sm">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm",
                            staff.role === 'manager' ? "bg-purple-100 text-purple-700" :
                            staff.role === 'cashier' ? "bg-emerald-100 text-emerald-700" :
                            staff.role === 'kitchen' ? "bg-amber-100 text-amber-700" :
                            staff.role === 'admin' ? "bg-blue-100 text-blue-700" :
                            "bg-gray-100 text-gray-700"
                          )}>
                            {staff.username ? staff.username.charAt(0).toUpperCase() : 'S'}
                          </div>
                          <div>
                            <h4 className="font-bold text-sm text-gray-900">{staff.username}</h4>
                            <span className={cn(
                              "inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider mt-0.5",
                              staff.role === 'manager' ? "bg-purple-50 text-purple-700 border border-purple-200" :
                              staff.role === 'cashier' ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                              staff.role === 'kitchen' ? "bg-amber-50 text-amber-700 border border-amber-200" :
                              staff.role === 'admin' ? "bg-blue-50 text-blue-700 border border-blue-200" :
                              "bg-gray-50 text-gray-600 border border-gray-200"
                            )}>
                              {staff.role}
                            </span>
                          </div>
                        </div>
                        <span className="text-xs font-mono bg-gray-50 px-2 py-1 rounded-lg text-gray-600 border border-gray-100">
                          PIN: {staff.passcode}
                        </span>
                      </div>

                      <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                        <span className="font-medium text-[11px] text-gray-400">
                          Branch: {branches.find(b => b.id === staff.branchId)?.name || 'Default'}
                        </span>
                        <div className="flex items-center space-x-2">
                          <button 
                            onClick={() => startEditStaff(staff)}
                            className="p-1.5 text-gray-400 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-all"
                            title="Edit Staff Member"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => deleteStaff(staff.id)} 
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-all"
                            title="Delete Staff"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        ) : (
          /* Admin Security & Password Tab */
          <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <section className="bg-gray-50 p-5 md:p-8 rounded-[2rem] border border-gray-100">
              <div className="max-w-2xl">
                <div className="flex items-center space-x-3 mb-2">
                  <div className="w-10 h-10 bg-gray-900 text-white rounded-2xl flex items-center justify-center shadow-md">
                    <Key className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl md:text-2xl font-bold text-gray-900">Admin Security & Password</h2>
                    <p className="text-xs text-gray-500">Change and manage the master administrator portal credentials.</p>
                  </div>
                </div>

                <div className="bg-white p-6 md:p-8 rounded-2xl border border-gray-200 mt-6 shadow-sm">
                  <div className="flex items-center justify-between pb-4 mb-6 border-b border-gray-100">
                    <div className="flex items-center space-x-2">
                      <ShieldCheck className="w-5 h-5 text-emerald-600" />
                      <span className="text-sm font-bold text-gray-800">Master Administrator Account</span>
                    </div>
                    <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full border border-emerald-200">
                      Active
                    </span>
                  </div>

                  {passwordFeedback && (
                    <div className={cn(
                      "p-4 rounded-xl text-sm font-medium mb-6 flex items-start gap-3",
                      passwordFeedback.type === 'success' 
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-200" 
                        : "bg-red-50 text-red-700 border border-red-200"
                    )}>
                      {passwordFeedback.type === 'success' ? (
                        <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 mt-0.5" />
                      ) : (
                        <X className="w-5 h-5 shrink-0 text-red-600 mt-0.5" />
                      )}
                      <span>{passwordFeedback.text}</span>
                    </div>
                  )}

                  <form onSubmit={handleUpdateAdminPassword} className="space-y-5">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5">Admin Username</label>
                      <input 
                        type="text" 
                        value={adminUsername}
                        onChange={(e) => setAdminUsername(e.target.value)}
                        placeholder="admin"
                        className="w-full p-3.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 font-medium"
                        required
                      />
                      <p className="text-[11px] text-gray-400 mt-1">Username used to log into the CoffeeGarage Admin Portal.</p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5">Current Admin Password</label>
                      <div className="relative">
                        <input 
                          type={showCurrentPass ? "text" : "password"} 
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder="Enter current password (default: admin123)"
                          className="w-full p-3.5 pr-12 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 font-mono"
                          required
                        />
                        <button 
                          type="button"
                          onClick={() => setShowCurrentPass(!showCurrentPass)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1.5">New Password</label>
                        <div className="relative">
                          <input 
                            type={showNewPass ? "text" : "password"} 
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="At least 4 characters"
                            className="w-full p-3.5 pr-12 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 font-mono"
                            required
                          />
                          <button 
                            type="button"
                            onClick={() => setShowNewPass(!showNewPass)}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1.5">Confirm New Password</label>
                        <div className="relative">
                          <input 
                            type={showConfirmPass ? "text" : "password"} 
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Repeat new password"
                            className="w-full p-3.5 pr-12 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 font-mono"
                            required
                          />
                          <button 
                            type="button"
                            onClick={() => setShowConfirmPass(!showConfirmPass)}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {newPassword && confirmPassword && (
                      <div className="text-xs">
                        {newPassword === confirmPassword ? (
                          <span className="text-emerald-600 flex items-center gap-1 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Passwords match
                          </span>
                        ) : (
                          <span className="text-red-500 font-semibold">
                            Passwords do not match
                          </span>
                        )}
                      </div>
                    )}

                    <div className="pt-2">
                      <button 
                        type="submit"
                        disabled={isUpdatingPassword}
                        className="w-full sm:w-auto px-8 py-3.5 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition-all text-sm flex items-center justify-center gap-2 shadow-md disabled:opacity-50 active:scale-95"
                      >
                        <Lock className="w-4 h-4" />
                        {isUpdatingPassword ? 'Updating Password...' : 'Save & Update Password'}
                      </button>
                    </div>
                  </form>
                </div>

                <div className="mt-6 p-4 bg-amber-50 rounded-2xl border border-amber-200">
                  <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider mb-1">
                    Default Administrator Access
                  </h4>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    By default, the initial credentials are <strong>admin</strong> with password <strong>admin123</strong>. Once updated, your new password is saved directly to your CoffeeGarage configuration.
                  </p>
                </div>
              </div>
            </section>
          </div>
        )}
      </main>

      {/* Ingredient Modal */}
      {isIngredientModalOpen && (
        <div className="fixed inset-0 z-[150] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">
                {editingIngredient ? 'Edit Ingredient' : 'Add New Ingredient'}
              </h3>
              <button onClick={() => setIsIngredientModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Ingredient Name</label>
                <input
                  type="text"
                  value={ingredientForm.name}
                  onChange={(e) => setIngredientForm({ ...ingredientForm, name: e.target.value })}
                  placeholder="e.g. Espresso Beans, Fresh Milk, Caramel Syrup"
                  className="w-full p-3.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Measurement Unit</label>
                  <select
                    value={ingredientForm.unit}
                    onChange={(e) => setIngredientForm({ ...ingredientForm, unit: e.target.value as any })}
                    className="w-full p-3.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 font-semibold"
                  >
                    <option value="g">Grams (g)</option>
                    <option value="ml">Milliliters (ml)</option>
                    <option value="pcs">Pieces (pcs)</option>
                    <option value="bottle">Bottle</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Initial Stock</label>
                  <input
                    type="number"
                    step="any"
                    value={ingredientForm.stock}
                    onChange={(e) => setIngredientForm({ ...ingredientForm, stock: e.target.value })}
                    placeholder="e.g. 1000"
                    className="w-full p-3.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Low Stock Alert Threshold</label>
                <input
                  type="number"
                  step="any"
                  value={ingredientForm.minThreshold}
                  onChange={(e) => setIngredientForm({ ...ingredientForm, minThreshold: e.target.value })}
                  placeholder="e.g. 200"
                  className="w-full p-3.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 font-mono"
                />
                <p className="text-[11px] text-gray-400 mt-1">Triggers low stock warnings when inventory drops below this number.</p>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setIsIngredientModalOpen(false)}
                  className="flex-1 py-3.5 px-4 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveIngredient}
                  className="flex-1 py-3.5 px-4 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition-colors text-sm shadow-md"
                >
                  {editingIngredient ? 'Update Ingredient' : 'Save Ingredient'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Restock Modal */}
      {isRestockModalOpen && restockingItem && (
        <div className="fixed inset-0 z-[150] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Restock / Adjust Stock</h3>
                <p className="text-xs text-gray-500 font-medium">{restockingItem.name}</p>
              </div>
              <button onClick={() => setIsRestockModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 mb-5 flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Current Stock</span>
              <span className="text-xl font-black text-gray-900 font-mono">{restockingItem.stock} {restockingItem.unit}</span>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Quantity to Add or Deduct ({restockingItem.unit})
                </label>
                <input
                  type="number"
                  step="any"
                  value={restockAmount}
                  onChange={(e) => setRestockAmount(e.target.value)}
                  placeholder="e.g. +500 for restock, or -50 for waste"
                  className="w-full p-3.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 font-mono"
                  autoFocus
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Enter a positive number to add stock, or a negative number for spoilage/wastage audit.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {[10, 50, 100, 500, 1000].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setRestockAmount(String(val))}
                    className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-bold text-gray-700 transition-colors"
                  >
                    +{val} {restockingItem.unit}
                  </button>
                ))}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setIsRestockModalOpen(false)}
                  className="flex-1 py-3.5 px-4 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRestockSubmit}
                  className="flex-1 py-3.5 px-4 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition-colors text-sm shadow-md"
                >
                  Apply Adjustment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Expense Modal */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-[150] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Log Operating Expense</h3>
                <p className="text-xs text-gray-500">Record shop outlays, ingredients, and utilities</p>
              </div>
              <button onClick={() => setIsExpenseModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Expense Category</label>
                <select
                  value={expenseForm.category}
                  onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value as any })}
                  className="w-full p-3.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-gray-900"
                >
                  <option value="ingredients">Ingredients & Raw Goods</option>
                  <option value="utilities">Utilities (Electricity, Water, Internet)</option>
                  <option value="salaries">Salaries & Payroll</option>
                  <option value="rent">Store Rent & Lease</option>
                  <option value="maintenance">Repairs & Maintenance</option>
                  <option value="other">Other Expenses</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Amount (₱ PHP)</label>
                <input
                  type="number"
                  step="any"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                  placeholder="0.00"
                  className="w-full p-3.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Description / Payee</label>
                <input
                  type="text"
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                  placeholder="e.g. 5kg Arabica Beans Delivery, Meralco Electric Bill"
                  className="w-full p-3.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="flex-1 py-3.5 px-4 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddExpense}
                  className="flex-1 py-3.5 px-4 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition-colors text-sm shadow-md"
                >
                  Save Expense
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recipe Linking Modal */}
      {isRecipeModalOpen && selectedRecipeProduct && (
        <div className="fixed inset-0 z-[150] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                  <ChefHat className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{selectedRecipeProduct.name}</h3>
                  <p className="text-xs text-gray-500">Auto-Deduct Recipe Configuration</p>
                </div>
              </div>
              <button onClick={() => setIsRecipeModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 overflow-y-auto flex-1 space-y-4">
              <p className="text-xs text-gray-500 leading-relaxed bg-amber-50/50 p-3 rounded-xl border border-amber-100">
                Every time <strong>{selectedRecipeProduct.name}</strong> is ordered, the inventory items below will be automatically deducted from your live stock.
              </p>

              <div className="space-y-2">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Current Recipe Ingredients</h4>
                {recipeIngredients.length === 0 ? (
                  <div className="p-6 text-center text-gray-400 border border-dashed border-gray-200 rounded-2xl text-xs">
                    No ingredients linked to this product yet. Add below to automate inventory tracking!
                  </div>
                ) : (
                  <div className="space-y-2">
                    {recipeIngredients.map((item) => {
                      const ing = inventory.find((i: any) => i.id === item.ingredientId);
                      return (
                        <div key={item.ingredientId} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                          <div className="flex items-center gap-2">
                            <Package className="w-4 h-4 text-gray-400" />
                            <span className="font-bold text-sm text-gray-900">{ing?.name || item.ingredientId}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-mono font-bold bg-white px-2.5 py-1 rounded-lg border border-gray-200">
                              {item.quantity} {ing?.unit || 'units'}
                            </span>
                            <button
                              onClick={() => handleRemoveIngredientFromRecipe(item.ingredientId)}
                              className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                              title="Remove from recipe"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-gray-100">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Add Ingredient to Recipe</h4>
                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={newRecipeItem.ingredientId}
                    onChange={(e) => setNewRecipeItem({ ...newRecipeItem, ingredientId: e.target.value })}
                    className="flex-1 p-3 rounded-xl border border-gray-200 bg-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-gray-900"
                  >
                    <option value="">-- Choose Ingredient --</option>
                    {inventory.map((i: any) => (
                      <option key={i.id} value={i.id}>
                        {i.name} ({i.stock} {i.unit} in stock)
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="any"
                      value={newRecipeItem.quantity}
                      onChange={(e) => setNewRecipeItem({ ...newRecipeItem, quantity: e.target.value })}
                      placeholder="Qty (e.g. 18)"
                      className="w-24 p-3 rounded-xl border border-gray-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                    <button
                      onClick={handleAddIngredientToRecipe}
                      className="px-4 py-3 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-gray-800 transition-colors shrink-0"
                    >
                      + Add
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setIsRecipeModalOpen(false)}
                className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRecipe}
                className="flex-1 py-3 px-4 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition-colors text-sm shadow-md"
              >
                Save Recipe
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Branch Modal */}
      {isBranchModalOpen && (
        <div className="fixed inset-0 z-[150] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Add New Branch</h3>
                <p className="text-xs text-gray-500">Create another café branch or kiosk location</p>
              </div>
              <button onClick={() => setIsBranchModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Branch Name</label>
                <input
                  type="text"
                  value={branchForm.name}
                  onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })}
                  placeholder="e.g. CoffeeGarage Downtown Kiosk"
                  className="w-full p-3.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Physical Address / Notes</label>
                <input
                  type="text"
                  value={branchForm.address}
                  onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })}
                  placeholder="e.g. 123 Rizal St., Corner Ave."
                  className="w-full p-3.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setIsBranchModalOpen(false)}
                  className="flex-1 py-3.5 px-4 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddBranch}
                  className="flex-1 py-3.5 px-4 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition-colors text-sm shadow-md"
                >
                  Create Branch
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loyalty Card Issue / Edit Modal */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-[150] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-50 text-amber-700 rounded-xl flex items-center justify-center">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">
                    {editingCustomer ? 'Edit Loyalty Card' : 'Issue Loyalty Card'}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {editingCustomer ? 'Update customer details and points' : 'Register a new café membership card'}
                  </p>
                </div>
              </div>
              <button onClick={() => setIsCustomerModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-gray-700">Card Number / Barcode</label>
                  <button 
                    type="button"
                    onClick={() => setCustomerForm(prev => ({
                      ...prev,
                      cardNumber: `CG-${Math.floor(1000 + Math.random() * 9000)}`
                    }))}
                    className="text-[11px] text-amber-700 hover:text-amber-800 font-bold underline"
                  >
                    Auto-Generate
                  </button>
                </div>
                <div className="relative">
                  <CreditCard className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={customerForm.cardNumber}
                    onChange={(e) => setCustomerForm({ ...customerForm, cardNumber: e.target.value.toUpperCase() })}
                    placeholder="e.g. CG-1001"
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-gray-900 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Customer Full Name *</label>
                <input
                  type="text"
                  value={customerForm.name}
                  onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                  placeholder="e.g. Juan dela Cruz"
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-gray-900 focus:bg-white"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Mobile / Contact Phone (Optional)</label>
                <input
                  type="tel"
                  value={customerForm.phone}
                  onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                  placeholder="e.g. 09171234567"
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Points Balance</label>
                <input
                  type="number"
                  value={customerForm.points}
                  onChange={(e) => setCustomerForm({ ...customerForm, points: e.target.value })}
                  placeholder="0"
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold font-mono focus:outline-none focus:ring-2 focus:ring-gray-900 focus:bg-white"
                />
                <p className="text-[11px] text-gray-400 mt-1">1 point = ₱1 discount upon checkout.</p>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  onClick={() => setIsCustomerModalOpen(false)}
                  className="flex-1 py-3.5 px-4 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveCustomer}
                  disabled={!customerForm.name.trim()}
                  className="flex-1 py-3.5 px-4 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition-colors text-sm shadow-md disabled:opacity-50"
                >
                  {editingCustomer ? 'Update Card' : 'Issue Card'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Points Adjustment Modal */}
      {isAdjustPointsModalOpen && customerForPoints && (
        <div className="fixed inset-0 z-[150] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Adjust Points</h3>
                <p className="text-xs text-gray-500 font-medium">{customerForPoints.name} ({customerForPoints.cardNumber || 'Member'})</p>
              </div>
              <button onClick={() => setIsAdjustPointsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 mb-4 text-center">
              <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Current Balance</span>
              <p className="text-2xl font-black text-amber-900 mt-0.5">
                {customerForPoints.points ?? 0} <span className="text-sm font-semibold">pts</span>
              </p>
            </div>

            <div className="space-y-3 mb-5">
              <label className="block text-xs font-bold text-gray-700">
                Points Adjustment (+ to add, - to deduct)
              </label>
              <input
                type="number"
                value={pointsDelta}
                onChange={(e) => setPointsDelta(e.target.value)}
                placeholder="e.g. +50 or -20"
                className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-center text-xl font-mono font-black focus:outline-none focus:ring-2 focus:ring-gray-900 focus:bg-white"
                autoFocus
              />

              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap gap-2 justify-center pt-1">
                {['+10', '+25', '+50', '+100', '-10', '-25'].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setPointsDelta(val.replace('+', ''))}
                    className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-lg transition-colors"
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setIsAdjustPointsModalOpen(false)}
                className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyPointsAdjustment}
                disabled={!pointsDelta || parseInt(pointsDelta, 10) === 0}
                className="flex-1 py-3 px-4 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition-colors text-sm shadow-md disabled:opacity-50"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Confirm Action</h3>
            <p className="text-gray-500 mb-8">{confirmDialog.message}</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
                className="flex-1 py-3 px-4 bg-gray-50 text-gray-600 rounded-xl font-bold hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog({ ...confirmDialog, isOpen: false });
                }}
                className="flex-1 py-3 px-4 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
