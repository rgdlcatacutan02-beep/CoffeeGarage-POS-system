import { Timestamp } from 'firebase/firestore';

export type UserRole = 'owner' | 'admin' | 'manager' | 'cashier' | 'staff' | 'kitchen' | 'supervisor';

export interface AdminProfile {
  username: string;
  role: 'admin';
  loggedInAt?: string;
}

export interface StaffProfile {
  id: string;
  username: string;
  role: UserRole;
  passcode: string;
  branchId: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  unit: 'g' | 'ml' | 'pcs' | 'bottle';
  stock: number;
  minThreshold: number;
  branchId: string;
  lastRestocked?: Timestamp;
}

export interface Recipe {
  productId: string;
  ingredients: {
    ingredientId: string;
    quantity: number;
  }[];
}

export interface Customer {
  id: string;
  name: string;
  cardNumber?: string;
  phone?: string;
  points: number;
  email?: string;
  birthday?: string;
  createdAt: Timestamp;
}

export interface Branch {
  id: string;
  name: string;
  address: string;
  phone?: string;
  status?: string;
  createdAt: Timestamp;
}

export interface Shift {
  id: string;
  userId: string;
  username: string;
  branchId: string;
  startTime: Timestamp;
  endTime?: Timestamp;
  openingBalance: number;
  closingBalance?: number;
  expectedCash?: number;
  status: 'open' | 'closed';
}

export interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

export interface Order {
  id: string;
  items: OrderItem[];
  total: number;
  status: 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled';
  paymentMethod: 'cash' | 'gcash' | 'maya' | 'card' | 'qrph' | 'mobile_wallet';
  branchId: string;
  customerId?: string;
  customerName?: string;
  customerCardNumber?: string;
  pointsEarned?: number;
  pointsRedeemed?: number;
  discount?: number;
  userId: string;
  tableId?: string;
  createdAt: Timestamp;
  tendered?: number;
  change?: number;
  mobileWallet?: string;
}

export interface Expense {
  id: string;
  category: 'utilities' | 'ingredients' | 'salaries' | 'rent' | 'maintenance' | 'other';
  amount: number;
  description: string;
  date: Timestamp;
  branchId: string;
}
