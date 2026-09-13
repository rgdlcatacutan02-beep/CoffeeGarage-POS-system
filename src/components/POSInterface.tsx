import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, Timestamp, where, limit, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useFirebase } from './FirebaseProvider';
import { 
  ShoppingCart, Plus, Minus, Trash2, CheckCircle2, Coffee, LayoutGrid, 
  Settings as SettingsIcon, Printer, Zap, X, User as UserIcon, LogIn, LogOut,
  Wallet, Gift, Search, Phone, ArrowLeft, Smartphone, Receipt, Check,
  CreditCard, Sparkles, Tag
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { inventoryService } from '../services/inventoryService';
import { shiftService } from '../services/shiftService';
import { loyaltyService } from '../services/loyaltyService';
import { Shift, Customer, Order } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { cn, safeToDate, formatPHP } from '../lib/utils';
import { printerService } from '../services/printerService';

import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';

interface Category {
  id: string;
  name: string;
  order: number;
}

interface Product {
  id: string;
  name: string;
  price: number;
  categoryId: string;
  imageUrl?: string;
  description?: string;
}

interface CartItem extends Product {
  quantity: number;
}

import { useFirestoreCollection } from '../hooks/useFirestore';
import { useToast } from './ui/Toast';

export default function POSInterface({ onOpenAdmin }: { onOpenAdmin: () => void }) {
  const { shopSettings, isAdmin, isManager, staffProfile, currentBranch, logout } = useFirebase();
  const { toast } = useToast();
  
  const { data: categories } = useFirestoreCollection<Category>('categories', [orderBy('order', 'asc')]);
  const { data: products } = useFirestoreCollection<Product>('products');
  
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isCartOpenMobile, setIsCartOpenMobile] = useState(false);

  // Shift & Loyalty Card State
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loyaltySearchQuery, setLoyaltySearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Customer[]>([]);
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const [isRegisteringModalOpen, setIsRegisteringModalOpen] = useState(false);
  const [registrationForm, setRegistrationForm] = useState({
    name: '',
    cardNumber: '',
    phone: '',
    initialPoints: '0'
  });
  const [pointsToRedeem, setPointsToRedeem] = useState<number>(0);
  const [isOpeningShift, setIsOpeningShift] = useState(false);
  const [openingBalance, setOpeningBalance] = useState('0');

  useEffect(() => {
    if (staffProfile) {
      shiftService.getCurrentShift(staffProfile.id || auth.currentUser?.uid || '', currentBranch).then(setActiveShift);
    }
  }, [staffProfile, currentBranch]);

  const handleOpenShift = async () => {
    const userId = staffProfile?.id || auth.currentUser?.uid || '';
    const username = staffProfile?.username || auth.currentUser?.displayName || 'Unknown';
    try {
      const shiftDoc = await shiftService.openShift(userId, username, currentBranch, parseFloat(openingBalance));
      setActiveShift({
        id: shiftDoc.id,
        userId,
        username,
        branchId: currentBranch,
        openingBalance: parseFloat(openingBalance),
        startTime: Timestamp.now() as any,
        status: 'open'
      });
      setIsOpeningShift(false);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSearchLoyalty = async (queryText = loyaltySearchQuery) => {
    const term = queryText.trim();
    if (!term) {
      setSearchResults([]);
      return;
    }
    setIsSearchingCustomer(true);
    try {
      const results = await loyaltyService.searchCustomers(term);
      if (results.length === 1) {
        setCustomer(results[0]);
        setSearchResults([]);
        setLoyaltySearchQuery('');
        setPointsToRedeem(0);
        toast(`Loyalty Card attached: ${results[0].name} (${results[0].cardNumber || 'Member'})`, 'success');
      } else if (results.length > 1) {
        setSearchResults(results);
      } else {
        setSearchResults([]);
        const isLikelyCardNumber = /^[A-Za-z0-9\-_]{2,15}$/.test(term) && !term.includes(' ');
        setRegistrationForm({
          cardNumber: isLikelyCardNumber ? term.toUpperCase() : `CG-${Math.floor(1000 + Math.random() * 9000)}`,
          name: isLikelyCardNumber ? '' : term,
          phone: /^\d{7,12}$/.test(term) ? term : '',
          initialPoints: '0'
        });
        setIsRegisteringModalOpen(true);
      }
    } catch {
      toast('Failed to search loyalty card', 'error');
    } finally {
      setIsSearchingCustomer(false);
    }
  };

  const handleSelectCustomer = (cust: Customer) => {
    setCustomer(cust);
    setSearchResults([]);
    setLoyaltySearchQuery('');
    setPointsToRedeem(0);
    toast(`Loyalty Card attached: ${cust.name}`, 'success');
  };

  const handleRemoveCustomer = () => {
    setCustomer(null);
    setPointsToRedeem(0);
  };

  const handleRegisterLoyalty = async () => {
    if (!registrationForm.name.trim()) {
      toast('Please enter customer full name', 'error');
      return;
    }
    try {
      const newCust = await loyaltyService.registerCustomer(
        registrationForm.cardNumber || registrationForm.phone || '',
        registrationForm.name.trim(),
        {
          cardNumber: registrationForm.cardNumber.trim() || `CG-${Math.floor(1000 + Math.random() * 9000)}`,
          phone: registrationForm.phone.trim(),
          points: parseInt(registrationForm.initialPoints, 10) || 0
        }
      );
      if (newCust) {
        setCustomer(newCust);
        setPointsToRedeem(0);
        toast(`Loyalty Card registered: ${newCust.name} (${newCust.cardNumber})!`, 'success');
      }
      setIsRegisteringModalOpen(false);
      setRegistrationForm({ name: '', cardNumber: '', phone: '', initialPoints: '0' });
      setLoyaltySearchQuery('');
    } catch {
      toast('Failed to register loyalty card', 'error');
    }
  };
  useEffect(() => {
    if (categories.length > 0 && !selectedCategoryId) {
      setSelectedCategoryId(categories[0].id);
    }
  }, [categories, selectedCategoryId]);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === productId) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discount = Math.min(pointsToRedeem, subtotal);
  const total = Math.max(0, subtotal - discount);

  const [isPrinting, setIsPrinting] = useState(false);
  const [lastOrder, setLastOrder] = useState<any>(null);
  const [paymentStep, setPaymentStep] = useState<'selection' | 'cash' | 'qr'>('selection');
  const [cashTendered, setCashTendered] = useState<string>('');
  const [walletRefNumber, setWalletRefNumber] = useState<string>('');
  const [showThermalReceipt, setShowThermalReceipt] = useState(false);
  const [selectedMobileWallet, setSelectedMobileWallet] = useState<'GCash' | 'Maya' | 'QRPH' | null>(null);
  const [currentPaymentId, setCurrentPaymentId] = useState<string | null>(null);

  // Listen for payment confirmation
  useEffect(() => {
    if (!currentPaymentId) return;

    const unsubscribe = onSnapshot(doc(db, 'payments', currentPaymentId), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.status === 'completed') {
          handleCheckout('mobile_wallet', { method: data.method, refNumber: data.refNumber });
        }
      }
    });

    return () => unsubscribe();
  }, [currentPaymentId]);

  const initiatePayment = async (wallet: string) => {
    const path = 'payments';
    try {
      const paymentRef = await addDoc(collection(db, path), {
        amount: total,
        method: wallet,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      setCurrentPaymentId(paymentRef.id);
      setPaymentStep('qr');
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, path);
    }
  };

  const handleCheckout = async (
    method: Order['paymentMethod'], 
    wallet: any = null, 
    cashDetails?: { tendered: number; change: number }
  ) => {
    if (cart.length === 0) return;
    const path = 'orders';
    try {
      const earnedPoints = customer ? Math.floor(total / 10) : 0;
      const orderData = {
        items: cart.map(item => ({
          productId: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity
        })),
        subtotal,
        discount: discount > 0 ? discount : undefined,
        total,
        status: 'pending' as const,
        createdAt: serverTimestamp(),
        userId: auth.currentUser?.uid || staffProfile?.username || 'anonymous',
        branchId: currentBranch,
        customerId: customer?.id || null,
        customerName: customer?.name || null,
        customerCardNumber: customer?.cardNumber || null,
        pointsEarned: customer ? earnedPoints : undefined,
        pointsRedeemed: pointsToRedeem > 0 ? pointsToRedeem : undefined,
        paymentMethod: method,
        mobileWallet: wallet,
        tendered: cashDetails?.tendered || (method === 'cash' ? total : undefined),
        change: cashDetails?.change !== undefined ? cashDetails.change : (method === 'cash' ? 0 : undefined)
      };

      const docRef = await addDoc(collection(db, path), orderData);
      const orderNumber = docRef.id.slice(-4).toUpperCase();
      
      toast('Order confirmed successfully!', 'success');

      await inventoryService.processOrderInventory(
        cart.map(i => ({ productId: i.id, quantity: i.quantity })),
        currentBranch
      );

      if (customer) {
        if (pointsToRedeem > 0) {
          await loyaltyService.redeemPoints(customer.id, pointsToRedeem);
        }
        await loyaltyService.addPoints(customer.id, total);
      }
      
      const orderForPrinting = { 
        ...orderData, 
        id: docRef.id,
        orderNumber,
        shopName: shopSettings?.shopName || 'CoffeeGarage',
        date: new Date()
      };
      setLastOrder(orderForPrinting);

      setIsSuccess(true);
      
      if (printerService.isConnected()) {
        try {
          setIsPrinting(true);
          await printerService.printReceipt(
            orderForPrinting.shopName, 
            orderForPrinting.items, 
            orderForPrinting.total,
            {
              tendered: cashDetails?.tendered,
              change: cashDetails?.change,
              paymentMethod: method === 'mobile_wallet' ? (wallet?.method || 'E-Wallet') : method,
              orderNumber,
              customerName: customer?.name,
              cardNumber: customer?.cardNumber,
              pointsEarned: earnedPoints,
              pointsBalance: customer ? (customer.points - pointsToRedeem + earnedPoints) : undefined,
              discount: pointsToRedeem
            }
          );
        } catch (printErr) {
          console.error('Auto-print failed:', printErr);
        } finally {
          setIsPrinting(false);
        }
      }

      setCart([]);
      setPointsToRedeem(0);
      setCustomer(null);
      setLoyaltySearchQuery('');
      setCashTendered('');
      setWalletRefNumber('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const handleManualPrint = async () => {
    if (!lastOrder) return;
    if (printerService.isConnected()) {
      try {
        setIsPrinting(true);
        await printerService.printReceipt(
          lastOrder.shopName, 
          lastOrder.items, 
          lastOrder.total,
          {
            tendered: lastOrder.tendered,
            change: lastOrder.change,
            paymentMethod: lastOrder.paymentMethod,
            orderNumber: lastOrder.orderNumber || lastOrder.id?.slice(-4),
            customerName: lastOrder.customerName,
            cardNumber: lastOrder.customerCardNumber,
            pointsEarned: lastOrder.pointsEarned,
            pointsBalance: lastOrder.customerPoints,
            discount: lastOrder.discount
          }
        );
      } catch (error: any) {
        toast(error instanceof Error ? error.message : 'Printing failed', 'error');
      } finally {
        setIsPrinting(false);
      }
    } else {
      window.print();
    }
  };

  const filteredProducts = selectedCategoryId 
    ? products.filter(p => p.categoryId === selectedCategoryId)
    : products;

  const cartItemCount = cart.reduce((s, i) => s + i.quantity, 0);

  // Only cashiers/staff are forced to open a shift. Admins and managers bypass this.
  if (!activeShift && (staffProfile?.role === 'staff' || staffProfile?.role === 'cashier')) {
    return (
      <div className="min-h-screen relative flex items-center justify-center bg-gray-50 p-4">
        <button 
          onClick={logout}
          className="absolute top-6 right-6 md:top-8 md:right-8 bg-white p-4 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all text-gray-500 hover:text-red-500 flex items-center gap-2"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-bold hidden md:inline">Sign Out</span>
        </button>

        <div className="max-w-md w-full bg-white p-10 rounded-[3rem] shadow-2xl border border-gray-100 text-center">
          <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-8">
            <Wallet className="w-10 h-10 text-orange-500" />
          </div>
          <h2 className="text-3xl font-black text-gray-900 mb-2 tracking-tight">Shift Closed</h2>
          <p className="text-gray-500 mb-10 font-medium">Please open a new shift to start accepting orders.</p>
          
          <div className="space-y-6">
            <div>
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 text-left">Opening Cash Balance</label>
              <input 
                type="number" 
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                className="w-full p-5 bg-gray-50 border border-gray-100 rounded-2xl text-2xl font-black focus:ring-2 focus:ring-gray-900 outline-none"
              />
            </div>
            <button 
              onClick={handleOpenShift}
              className="w-full py-5 bg-gray-900 text-white rounded-2xl font-black shadow-xl shadow-gray-200 hover:bg-gray-800 transition-all active:scale-95"
            >
              Start My Shift
            </button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden flex-col md:flex-row">
      {/* PC Sidebar / Mobile Header Categories */}
      <div className="hidden md:flex w-24 md:w-32 bg-white border-r border-gray-200 flex-col">
        <div className="p-4 flex flex-col items-center border-b border-gray-100">
          {shopSettings?.logoUrl ? (
            <img src={shopSettings.logoUrl} alt="Logo" className="w-12 h-12 rounded-full object-cover mb-2" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-12 h-12 bg-gray-900 rounded-full flex items-center justify-center mb-2">
              <Coffee className="text-white w-6 h-6" />
            </div>
          )}
        </div>
        
        <div className="flex-1 overflow-y-auto py-4 space-y-2 px-2">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategoryId(cat.id)}
              className={cn(
                "w-full py-4 px-2 rounded-xl flex flex-col items-center justify-center transition-all",
                selectedCategoryId === cat.id 
                  ? "bg-gray-900 text-white shadow-lg" 
                  : "text-gray-500 hover:bg-gray-100"
              )}
            >
              <LayoutGrid className="w-6 h-6 mb-1" />
              <span className="text-[10px] md:text-sm font-medium text-center truncate w-full">{cat.name}</span>
            </button>
          ))}
        </div>

        <div className="border-t border-gray-100 flex flex-col">
          {isAdmin && (
            <button 
              onClick={onOpenAdmin}
              className="p-4 text-gray-400 hover:text-gray-900 transition-colors border-b border-gray-100"
            >
              <SettingsIcon className="w-6 h-6 mx-auto" />
            </button>
          )}
          <button 
            onClick={logout}
            className="p-4 text-gray-400 hover:text-red-500 transition-colors"
          >
            <LogOut className="w-6 h-6 mx-auto" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-6 shrink-0">
          <div className="flex items-center space-x-3">
             {/* Mobile Settings Icon */}
            {isAdmin && (
              <button onClick={onOpenAdmin} className="md:hidden p-2 text-gray-400">
                <SettingsIcon className="w-5 h-5" />
              </button>
            )}
            <button onClick={logout} className="md:hidden p-2 text-gray-400 hover:text-red-500">
              <LogOut className="w-5 h-5" />
            </button>
            <h1 className="text-lg md:text-xl font-bold text-gray-900 truncate max-w-[150px] md:max-w-none">
              {shopSettings?.shopName || 'CoffeeGarage'}
            </h1>
          </div>
          
          <div className="flex items-center space-x-2">
            <button 
              onClick={() => setIsCartOpenMobile(true)}
              className="md:hidden relative p-2 bg-gray-100 rounded-full"
            >
              <ShoppingCart className="w-5 h-5 text-gray-700" />
              {cartItemCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full border-2 border-white font-bold">
                  {cartItemCount}
                </span>
              )}
            </button>
            <span className="hidden sm:block text-sm text-gray-400 font-medium">
              {new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </span>
          </div>
        </header>

        {/* Mobile Categories Scroll */}
        <div className="md:hidden bg-white border-b border-gray-100 flex overflow-x-auto py-2 px-4 space-x-2 no-scrollbar scroll-smooth">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategoryId(cat.id)}
              className={cn(
                "whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold transition-all border",
                selectedCategoryId === cat.id 
                  ? "bg-gray-900 text-white border-gray-900 shadow-md" 
                  : "bg-white text-gray-500 border-gray-200"
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6">
          {!selectedCategoryId && categories.length === 0 ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 md:gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="bg-white p-4 rounded-2xl border border-gray-100 h-48 animate-pulse">
                  <div className="aspect-square w-full bg-gray-50 rounded-xl mb-3" />
                  <div className="h-4 bg-gray-50 rounded w-2/3 mb-2" />
                  <div className="h-3 bg-gray-50 rounded w-full" />
                </div>
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 py-20">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <Coffee className="w-10 h-10" />
              </div>
              <h3 className="text-lg font-bold">No products found</h3>
              <p className="text-sm">There are no products in this category yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 md:gap-4">
              {filteredProducts.map(product => (
                <motion.button
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className="bg-white p-3 md:p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all text-left flex flex-col group active:scale-[0.98]"
                >
                  <div className="aspect-square w-full bg-gray-50 rounded-xl mb-2 md:mb-3 overflow-hidden">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300">
                        <Coffee className="w-8 h-8 md:w-12 h-12" />
                      </div>
                    )}
                  </div>
                  <h3 className="font-bold text-gray-900 text-xs md:text-sm mb-1 line-clamp-1">{product.name}</h3>
                  {product.description && (
                    <p className="text-[10px] text-gray-400 line-clamp-2 mb-2 leading-tight h-6">
                      {product.description}
                    </p>
                  )}
                  <p className="text-gray-900 font-black mt-auto text-sm md:text-base">₱{product.price.toFixed(2)}</p>
                </motion.button>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Cart Drawer (Mobile) or Sidebar (Desktop) */}
      <div className={cn(
        "fixed inset-0 z-50 md:relative md:inset-auto md:flex bg-black/40 md:bg-transparent transition-opacity backdrop-blur-[2px] md:backdrop-blur-none",
        isCartOpenMobile ? "opacity-100" : "opacity-0 pointer-events-none md:opacity-100 md:pointer-events-auto"
      )}>
        <button 
          onClick={() => setIsCartOpenMobile(false)}
          className="absolute inset-0 md:hidden cursor-default"
        />
        
        <div className={cn(
          "absolute right-0 top-0 bottom-0 w-full max-w-[320px] md:max-w-none md:w-80 lg:w-96 bg-white shadow-2xl md:shadow-none transition-transform duration-300 ease-out flex flex-col",
          isCartOpenMobile ? "translate-x-0" : "translate-x-full md:translate-x-0"
        )}>
          <div className="p-4 md:p-6 border-b border-gray-100 flex items-center justify-between shrink-0">
            <h2 className="text-lg font-bold flex items-center">
              <ShoppingCart className="w-5 h-5 mr-2 text-gray-400" />
              Current Order
            </h2>
            <button onClick={() => setIsCartOpenMobile(false)} className="md:hidden p-2 text-gray-400">
              <X className="w-5 h-5" />
            </button>
            <span className="hidden md:inline-block bg-gray-100 text-gray-600 px-2 py-1 rounded-lg text-xs font-bold">
              {cartItemCount} items
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
            {/* Loyalty Card Search */}
            <div className="relative mb-2">
              <div className="p-1 items-center flex bg-gray-50 rounded-2xl border border-gray-200 focus-within:ring-2 focus-within:ring-gray-900 transition-all">
                <CreditCard className="w-4 h-4 ml-3 text-amber-600 shrink-0" />
                <input 
                  type="text"
                  placeholder="Enter Card # or Customer Name..."
                  value={loyaltySearchQuery}
                  onChange={(e) => {
                    setLoyaltySearchQuery(e.target.value);
                    if (!e.target.value.trim()) setSearchResults([]);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSearchLoyalty();
                  }}
                  className="flex-1 p-2.5 bg-transparent text-sm font-semibold border-none outline-none placeholder:text-gray-400 placeholder:font-normal"
                />
                {loyaltySearchQuery && (
                  <button 
                    type="button"
                    onClick={() => { setLoyaltySearchQuery(''); setSearchResults([]); }}
                    className="p-1 mr-1 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <button 
                  type="button"
                  onClick={() => handleSearchLoyalty()}
                  disabled={isSearchingCustomer || !loyaltySearchQuery.trim()}
                  className="px-3 py-2 bg-gray-900 text-white rounded-xl shadow-sm text-xs font-bold hover:bg-gray-800 disabled:opacity-40 transition-all flex items-center gap-1 shrink-0"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>{isSearchingCustomer ? '...' : 'Find'}</span>
                </button>
              </div>

              {/* Multiple Search Results Dropdown */}
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-2xl border border-gray-200 shadow-xl z-30 max-h-48 overflow-y-auto p-1.5 space-y-1">
                  <p className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    Found {searchResults.length} Loyalty Cards
                  </p>
                  {searchResults.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleSelectCustomer(c)}
                      className="w-full p-2.5 hover:bg-amber-50 rounded-xl flex items-center justify-between text-left transition-colors group"
                    >
                      <div>
                        <p className="text-xs font-bold text-gray-900 group-hover:text-amber-900">{c.name}</p>
                        <p className="text-[10px] font-mono text-gray-400">Card: {c.cardNumber || 'Member'} {c.phone ? `• ${c.phone}` : ''}</p>
                      </div>
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-lg text-[10px] font-black">
                        {c.points} pts
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Attached Loyalty Card Banner */}
            {customer && (
              <div className="p-3.5 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/5 rounded-2xl border border-amber-200/80 mb-3 animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 bg-amber-600 text-white rounded-xl flex items-center justify-center shadow-sm font-bold text-xs shrink-0">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-black text-gray-900 leading-none">{customer.name}</p>
                        {customer.cardNumber && (
                          <span className="text-[10px] font-mono bg-white px-1.5 py-0.5 rounded border border-amber-200 text-amber-800 font-bold">
                            {customer.cardNumber}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-amber-700 font-bold mt-1 flex items-center gap-1">
                        <span>★ {customer.points} Available Points</span>
                      </p>
                    </div>
                  </div>
                  <button 
                    type="button"
                    onClick={handleRemoveCustomer}
                    className="p-1 hover:bg-white rounded-lg text-gray-400 hover:text-gray-700 transition-colors"
                    title="Remove attached customer card"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Points Redemption Option */}
                {customer.points > 0 && subtotal > 0 && (
                  <div className="mt-2.5 pt-2.5 border-t border-amber-200/60 flex items-center justify-between">
                    {pointsToRedeem > 0 ? (
                      <div className="flex items-center justify-between w-full">
                        <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                          ✓ Redeeming {pointsToRedeem} pts (-₱{pointsToRedeem})
                        </span>
                        <button
                          type="button"
                          onClick={() => setPointsToRedeem(0)}
                          className="text-[11px] font-bold text-gray-500 hover:text-red-600 underline"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          const maxRedeem = Math.min(customer.points, Math.floor(subtotal));
                          setPointsToRedeem(maxRedeem);
                          toast(`Applied ₱${maxRedeem} loyalty points discount!`, 'success');
                        }}
                        className="w-full py-1.5 px-3 bg-white hover:bg-amber-100/70 border border-amber-300 rounded-xl text-xs font-bold text-amber-800 transition-all flex items-center justify-center gap-1 shadow-xs"
                      >
                        <span>Redeem Points (Save up to ₱{Math.min(customer.points, Math.floor(subtotal))})</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-300 opacity-50 px-4 text-center">
                <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                  <ShoppingCart className="w-10 h-10" />
                </div>
                <p className="font-bold text-gray-400">Your cart is empty</p>
                <p className="text-xs mt-1">Select items from the menu to build an order.</p>
              </div>
            ) : (
              cart.map(item => (
                <div key={item.id} className="flex items-center space-x-3 md:space-x-4 animate-in slide-in-from-right-4 duration-200">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-sm text-gray-900 truncate">{item.name}</h4>
                    <p className="text-xs text-gray-400">₱{item.price.toFixed(2)} each</p>
                  </div>
                  <div className="flex items-center bg-gray-50 rounded-xl p-1 gap-1 border border-gray-100">
                    <button onClick={() => updateQuantity(item.id, -1)} className="p-1 hover:bg-white rounded-lg transition-colors text-gray-500">
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-6 text-center text-xs font-black text-gray-900">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.id, 1)} className="p-1 hover:bg-white rounded-lg transition-colors text-gray-500">
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <button onClick={() => removeFromCart(item.id)} className="text-gray-300 hover:text-red-500 transition-colors p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="p-4 md:p-6 bg-gray-50/50 border-t border-gray-100 space-y-4 shadow-[0_-10px_20px_rgba(0,0,0,0.02)] shrink-0">
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs text-gray-400 font-medium">
                <span>Subtotal</span>
                <span>₱{subtotal.toFixed(2)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between items-center text-xs text-emerald-600 font-bold">
                  <span>Loyalty Discount ({pointsToRedeem} pts)</span>
                  <span>-₱{discount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between items-center text-lg font-black text-gray-900 pt-2 border-t border-white">
                <span>Total</span>
                <span>₱{total.toFixed(2)}</span>
              </div>
            </div>
            
            <button
              disabled={cart.length === 0}
              onClick={() => setIsCheckoutModalOpen(true)}
              className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold shadow-lg shadow-gray-200 hover:bg-gray-800 disabled:opacity-30 disabled:shadow-none transition-all active:scale-[0.98]"
            >
              Confirm Checkout
            </button>
          </div>
        </div>
      </div>

      {/* Checkout Modal */}
      {isCheckoutModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[2.5rem] max-w-md w-full p-6 md:p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
            {isSuccess ? (
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="text-emerald-500 w-10 h-10" />
                </div>
                <h2 className="text-2xl font-black text-gray-900 mb-1 tracking-tight">Order Confirmed!</h2>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
                  Order #{lastOrder?.orderNumber || '0000'}
                </p>

                {lastOrder && (
                  <div className="bg-gray-50 rounded-2xl p-4 mb-6 text-left border border-gray-100 text-xs space-y-1.5 font-medium">
                    <div className="flex justify-between font-bold text-gray-800 pb-1 border-b border-gray-200">
                      <span>Total Amount:</span>
                      <span className="text-sm font-black">₱{lastOrder.total?.toFixed(2)}</span>
                    </div>
                    {lastOrder.discount !== undefined && lastOrder.discount > 0 && (
                      <div className="flex justify-between text-emerald-600 font-bold">
                        <span>Loyalty Discount:</span>
                        <span>-₱{Number(lastOrder.discount).toFixed(2)}</span>
                      </div>
                    )}
                    {lastOrder.tendered !== undefined && (
                      <>
                        <div className="flex justify-between text-gray-600">
                          <span>Cash Tendered:</span>
                          <span>₱{Number(lastOrder.tendered).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-emerald-600 font-bold">
                          <span>Change Due:</span>
                          <span>₱{Number(lastOrder.change || 0).toFixed(2)}</span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between text-gray-500 pt-1">
                      <span>Payment Method:</span>
                      <span className="font-bold uppercase">{lastOrder.paymentMethod}</span>
                    </div>

                    {(lastOrder.customerName || lastOrder.customerCardNumber) && (
                      <div className="mt-3 pt-2.5 border-t border-gray-200 bg-amber-50/60 -mx-1 px-3 py-2 rounded-xl text-amber-900">
                        <div className="flex justify-between items-center font-bold">
                          <span className="flex items-center gap-1.5 text-xs">
                            <CreditCard className="w-3.5 h-3.5 text-amber-600" />
                            Loyalty Member:
                          </span>
                          <span className="font-mono text-xs">{lastOrder.customerCardNumber || 'Member'}</span>
                        </div>
                        <div className="flex justify-between text-[11px] text-gray-700 mt-1">
                          <span>Name:</span>
                          <span className="font-semibold">{lastOrder.customerName}</span>
                        </div>
                        {lastOrder.pointsEarned !== undefined && lastOrder.pointsEarned > 0 && (
                          <div className="flex justify-between text-[11px] text-amber-700 font-bold mt-0.5">
                            <span>Points Earned:</span>
                            <span>+{lastOrder.pointsEarned} pts</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-col gap-2.5">
                  <button 
                    onClick={handleManualPrint}
                    disabled={isPrinting}
                    className="w-full py-3.5 bg-gray-900 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-md hover:bg-gray-800 text-sm"
                  >
                    <Printer className="w-4 h-4" />
                    <span>{isPrinting ? 'Printing Receipt...' : (printerService.isConnected() ? 'Print Bluetooth Receipt' : 'Print / Save Receipt (Browser)')}</span>
                  </button>

                  <button 
                    onClick={() => setShowThermalReceipt(!showThermalReceipt)}
                    className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-bold transition-all text-xs hover:bg-gray-200 flex items-center justify-center gap-2"
                  >
                    <Receipt className="w-4 h-4" />
                    <span>{showThermalReceipt ? 'Hide Receipt Preview' : 'Preview Thermal Receipt'}</span>
                  </button>

                  <button 
                    onClick={() => {
                      setIsSuccess(false);
                      setIsCheckoutModalOpen(false);
                      setIsCartOpenMobile(false);
                      setPaymentStep('selection');
                      setSelectedMobileWallet(null);
                      setShowThermalReceipt(false);
                    }}
                    className="w-full py-3 border border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-50 text-xs transition-colors"
                  >
                    Done &bull; Start New Order
                  </button>
                </div>

                {/* Thermal Receipt Preview */}
                {showThermalReceipt && lastOrder && (
                  <div className="mt-4 p-4 bg-gray-100 rounded-xl text-left font-mono text-[11px] leading-tight text-gray-800 border border-gray-200 max-h-52 overflow-y-auto">
                    <p className="text-center font-bold text-xs mb-1">{lastOrder.shopName}</p>
                    <p className="text-center mb-1">RECEIPT</p>
                    <p className="text-center text-[10px] text-gray-500 mb-2">{new Date().toLocaleString()}</p>
                    <div className="border-t border-dashed border-gray-400 my-1" />
                    {lastOrder.items?.map((it: any, idx: number) => (
                      <div key={idx} className="flex justify-between">
                        <span>{it.name} x{it.quantity}</span>
                        <span>₱{(it.price * it.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                    {lastOrder.discount !== undefined && lastOrder.discount > 0 && (
                      <div className="flex justify-between text-emerald-700 font-bold">
                        <span>LOYALTY DISCOUNT</span>
                        <span>-₱{Number(lastOrder.discount).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="border-t border-dashed border-gray-400 my-1" />
                    <div className="flex justify-between font-bold">
                      <span>TOTAL</span>
                      <span>₱{lastOrder.total?.toFixed(2)}</span>
                    </div>
                    {lastOrder.tendered !== undefined && (
                      <>
                        <div className="flex justify-between">
                          <span>TENDERED</span>
                          <span>₱{Number(lastOrder.tendered).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between font-bold">
                          <span>CHANGE</span>
                          <span>₱{Number(lastOrder.change || 0).toFixed(2)}</span>
                        </div>
                      </>
                    )}
                    {(lastOrder.customerName || lastOrder.customerCardNumber) && (
                      <>
                        <div className="border-t border-dashed border-gray-400 my-1" />
                        <div className="flex justify-between">
                          <span>LOYALTY:</span>
                          <span className="font-bold">{lastOrder.customerName || 'Customer'}</span>
                        </div>
                        {lastOrder.customerCardNumber && (
                          <div className="flex justify-between">
                            <span>CARD NO:</span>
                            <span>{lastOrder.customerCardNumber}</span>
                          </div>
                        )}
                        {lastOrder.pointsEarned !== undefined && lastOrder.pointsEarned > 0 && (
                          <div className="flex justify-between">
                            <span>POINTS EARNED:</span>
                            <span>+{lastOrder.pointsEarned}</span>
                          </div>
                        )}
                      </>
                    )}
                    <div className="border-t border-dashed border-gray-400 my-1" />
                    <p className="text-center text-[10px] text-gray-500 mt-1">Thank you for visiting!</p>
                  </div>
                )}
              </div>
            ) : paymentStep === 'selection' ? (
              <>
                <h2 className="text-2xl font-black text-gray-900 mb-1 tracking-tight">Select Payment</h2>
                <p className="text-gray-400 text-xs mb-5 font-medium">Choose how the customer will pay.</p>
                
                <div className="bg-gray-50 rounded-2xl p-5 mb-5 border border-gray-100">
                  <div className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">
                    Amount Due
                  </div>
                  <div className="text-3xl font-black text-gray-900">
                    ₱{total.toFixed(2)}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 mb-6">
                  <button 
                    onClick={() => {
                      setPaymentStep('cash');
                      setCashTendered(total.toString());
                    }} 
                    className="py-3.5 bg-gray-900 text-white rounded-2xl font-bold hover:bg-gray-800 shadow-lg shadow-gray-200 flex items-center justify-center transition-all text-sm"
                  >
                    <Wallet className="w-5 h-5 mr-3 text-amber-400" />
                    Cash Payment &amp; Change Calculator
                  </button>
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => {
                        setSelectedMobileWallet('GCash');
                        initiatePayment('GCash');
                      }} 
                      className="py-3.5 border-2 border-gray-100 text-blue-600 rounded-2xl font-bold hover:bg-gray-50 flex flex-col items-center justify-center transition-all"
                    >
                      <Smartphone className="w-5 h-5 mb-1" />
                      <span className="text-xs">GCash</span>
                    </button>
                    <button 
                      onClick={() => {
                        setSelectedMobileWallet('Maya');
                        initiatePayment('Maya');
                      }} 
                      className="py-3.5 border-2 border-gray-100 text-emerald-600 rounded-2xl font-bold hover:bg-gray-50 flex flex-col items-center justify-center transition-all"
                    >
                      <Smartphone className="w-5 h-5 mb-1" />
                      <span className="text-xs">Maya</span>
                    </button>
                  </div>
                  <button 
                    onClick={() => {
                      setSelectedMobileWallet('QRPH');
                      initiatePayment('QRPH');
                    }} 
                    className="py-3.5 border-2 border-gray-100 text-gray-900 rounded-2xl font-bold hover:bg-gray-50 flex items-center justify-center transition-all text-xs"
                  >
                    <LayoutGrid className="w-4 h-4 mr-2 text-red-500" />
                    Any QRPh (Bank / Wallet)
                  </button>
                </div>

                <button 
                  onClick={() => setIsCheckoutModalOpen(false)}
                  className="w-full text-gray-400 font-bold text-xs tracking-widest uppercase hover:text-gray-600"
                >
                  Cancel
                </button>
              </>
            ) : paymentStep === 'cash' ? (
              /* Cash Payment & Change Calculation View */
              <div>
                <div className="flex items-center justify-between mb-4">
                  <button 
                    onClick={() => setPaymentStep('selection')}
                    className="p-1.5 hover:bg-gray-100 rounded-xl transition-colors text-gray-500"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <h2 className="text-lg font-black text-gray-900">Cash Payment</h2>
                  <div className="w-7" />
                </div>

                <div className="bg-gray-50 rounded-2xl p-4 mb-4 border border-gray-100 flex justify-between items-center">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total Amount Due</span>
                    <p className="text-2xl font-black text-gray-900">₱{total.toFixed(2)}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Change Due</span>
                    <p className={cn(
                      "text-2xl font-black",
                      (parseFloat(cashTendered || '0') >= total) ? "text-emerald-600" : "text-gray-400"
                    )}>
                      ₱{Math.max(0, (parseFloat(cashTendered || '0') - total)).toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 mb-5">
                  <label className="block text-xs font-bold text-gray-700">Cash Tendered (Amount Received)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-400 text-lg">₱</span>
                    <input 
                      type="number"
                      value={cashTendered}
                      onChange={(e) => setCashTendered(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-9 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xl font-black outline-none focus:ring-2 focus:ring-gray-900 focus:bg-white"
                      autoFocus
                    />
                  </div>

                  {/* Quick Denomination Pills */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setCashTendered(total.toString())}
                      className="px-3 py-1.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold hover:bg-amber-100"
                    >
                      Exact (₱{total.toFixed(0)})
                    </button>
                    {[50, 100, 200, 500, 1000].map(amt => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setCashTendered(amt.toString())}
                        className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-200"
                      >
                        ₱{amt}
                      </button>
                    ))}
                  </div>
                </div>

                {parseFloat(cashTendered || '0') < total && (
                  <p className="text-xs text-amber-600 font-bold mb-4 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                    Amount received is less than total due (short ₱{(total - parseFloat(cashTendered || '0')).toFixed(2)})
                  </p>
                )}

                <button
                  type="button"
                  disabled={parseFloat(cashTendered || '0') < total}
                  onClick={() => {
                    const tenderedNum = parseFloat(cashTendered || '0');
                    const changeNum = Math.max(0, tenderedNum - total);
                    handleCheckout('cash', null, { tendered: tenderedNum, change: changeNum });
                  }}
                  className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold text-sm shadow-xl shadow-gray-200 hover:bg-gray-800 transition-all disabled:opacity-40 disabled:shadow-none"
                >
                  Complete Order (Change: ₱{Math.max(0, (parseFloat(cashTendered || '0') - total)).toFixed(2)})
                </button>
              </div>
            ) : (
              /* QR Code Digital Wallet View */
              <div className="text-center">
                <div className="flex items-center justify-between mb-4">
                  <button 
                    onClick={() => {
                      setPaymentStep('selection');
                      setCurrentPaymentId(null);
                    }}
                    className="p-1.5 hover:bg-gray-100 rounded-xl transition-colors text-gray-500"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <h2 className="text-lg font-black text-gray-900">{selectedMobileWallet} Payment</h2>
                  <div className="w-7" />
                </div>

                <div className="bg-white p-4 rounded-3xl border-2 border-gray-100 inline-block mb-4 shadow-xl relative overflow-hidden">
                  {shopSettings?.paymentQrUrl ? (
                    <img src={shopSettings.paymentQrUrl} alt="Payment QR" className="w-[180px] h-[180px] object-cover rounded-xl mx-auto" referrerPolicy="no-referrer" />
                  ) : (
                    <QRCodeCanvas 
                      value={`https://payment.brewmaster.io/pay/${currentPaymentId || 'pending'}`}
                      size={180}
                      level="H"
                      includeMargin={true}
                    />
                  )}
                  <motion.div 
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none"
                    animate={{ x: ['-100%', '100%'] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  />
                </div>

                <p className="text-sm font-black text-gray-900 mb-3">
                  Amount: ₱{total.toFixed(2)}
                </p>

                <div className="space-y-3 mb-4 text-left">
                  <label className="block text-xs font-bold text-gray-700">Reference / Approval No. (Optional)</label>
                  <input 
                    type="text"
                    placeholder="e.g. 1029384756"
                    value={walletRefNumber}
                    onChange={(e) => setWalletRefNumber(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-gray-900 font-mono"
                  />
                </div>

                <button 
                  type="button"
                  onClick={() => {
                    handleCheckout('mobile_wallet', { 
                      method: selectedMobileWallet, 
                      refNumber: walletRefNumber 
                    });
                  }}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 text-sm active:scale-95"
                >
                  <Check className="w-4 h-4" />
                  <span>Confirm Payment Received</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hidden printable receipt container for browser window.print() */}
      {lastOrder && (
        <div id="printable-receipt-area" className="hidden">
          <div style={{ textAlign: 'center', marginBottom: '10px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0' }}>{lastOrder.shopName}</h2>
            <p style={{ margin: '2px 0', fontSize: '12px' }}>Branch: {currentBranch}</p>
            <p style={{ margin: '2px 0', fontSize: '12px' }}>Order #{lastOrder.orderNumber || lastOrder.id?.slice(-4)}</p>
            <p style={{ margin: '2px 0', fontSize: '10px', color: '#666' }}>{new Date().toLocaleString()}</p>
          </div>
          <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }} />
          <div>
            {lastOrder.items?.map((it: any, i: number) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', margin: '4px 0' }}>
                <span>{it.name} x{it.quantity}</span>
                <span>₱{(it.price * it.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
          {lastOrder.discount !== undefined && lastOrder.discount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#047857' }}>
              <span>LOYALTY DISCOUNT:</span>
              <span>-₱{Number(lastOrder.discount).toFixed(2)}</span>
            </div>
          )}
          <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '14px' }}>
            <span>TOTAL:</span>
            <span>₱{lastOrder.total?.toFixed(2)}</span>
          </div>
          {lastOrder.tendered !== undefined && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span>CASH TENDERED:</span>
                <span>₱{Number(lastOrder.tendered).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '12px' }}>
                <span>CHANGE:</span>
                <span>₱{Number(lastOrder.change || 0).toFixed(2)}</span>
              </div>
            </>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginTop: '4px' }}>
            <span>PAYMENT METHOD:</span>
            <span style={{ textTransform: 'uppercase' }}>{lastOrder.paymentMethod}</span>
          </div>

          {(lastOrder.customerName || lastOrder.customerCardNumber) && (
            <>
              <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                <span>LOYALTY MEMBER:</span>
                <span>{lastOrder.customerName || 'Customer'}</span>
              </div>
              {lastOrder.customerCardNumber && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                  <span>CARD NUMBER:</span>
                  <span>{lastOrder.customerCardNumber}</span>
                </div>
              )}
              {lastOrder.pointsEarned !== undefined && lastOrder.pointsEarned > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                  <span>POINTS EARNED:</span>
                  <span>+{lastOrder.pointsEarned} pts</span>
                </div>
              )}
            </>
          )}

          <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }} />
          <p style={{ textAlign: 'center', fontSize: '11px', margin: '4px 0' }}>Thank you for visiting CoffeeGarage!</p>
          <p style={{ textAlign: 'center', fontSize: '10px', color: '#666', margin: '0' }}>Please come again!</p>
        </div>
      )}

      {/* Loyalty Card Registration Modal */}
      {isRegisteringModalOpen && (
        <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200 border border-gray-100">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-amber-50 text-amber-700 rounded-2xl flex items-center justify-center">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xl font-black text-gray-900">Register Loyalty Card</h3>
                <p className="text-xs text-gray-500 font-medium">Issue a member card to earn &amp; redeem points.</p>
              </div>
            </div>

            <div className="space-y-4 my-5">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-gray-700">Loyalty Card Number</label>
                  <button 
                    type="button"
                    onClick={() => setRegistrationForm(prev => ({
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
                    placeholder="e.g. CG-1082"
                    value={registrationForm.cardNumber}
                    onChange={(e) => setRegistrationForm({ ...registrationForm, cardNumber: e.target.value.toUpperCase() })}
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-gray-900 font-mono font-bold text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Customer Full Name *</label>
                <input 
                  type="text"
                  placeholder="e.g. Maria Santos"
                  value={registrationForm.name}
                  onChange={(e) => setRegistrationForm({ ...registrationForm, name: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-gray-900 font-semibold text-sm"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Phone Number (Optional)</label>
                  <input 
                    type="tel"
                    placeholder="e.g. 09171234567"
                    value={registrationForm.phone}
                    onChange={(e) => setRegistrationForm({ ...registrationForm, phone: e.target.value })}
                    className="w-full px-3.5 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-gray-900 text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Initial Points</label>
                  <input 
                    type="number"
                    placeholder="0"
                    value={registrationForm.initialPoints}
                    onChange={(e) => setRegistrationForm({ ...registrationForm, initialPoints: e.target.value })}
                    className="w-full px-3.5 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-gray-900 text-xs font-medium"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                type="button"
                onClick={() => {
                  setIsRegisteringModalOpen(false);
                  setRegistrationForm({ name: '', cardNumber: '', phone: '', initialPoints: '0' });
                }}
                className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors text-sm"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={handleRegisterLoyalty}
                disabled={!registrationForm.name.trim()}
                className="flex-1 py-3 px-4 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition-colors disabled:opacity-50 text-sm shadow-md"
              >
                Register &amp; Attach
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

