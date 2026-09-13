import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, increment, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Customer } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';

export const loyaltyService = {
  /**
   * Search customers by Card Number, Customer Name, or Phone number.
   * Performs exact index queries as well as case-insensitive substring matching.
   */
  async searchCustomers(searchStr: string): Promise<Customer[]> {
    const term = searchStr.trim().toLowerCase();
    if (!term) return [];
    const path = 'customers';

    try {
      // 1. Direct match on exact cardNumber
      const cardQ = query(collection(db, path), where('cardNumber', '==', searchStr.trim()));
      const cardSnap = await getDocs(cardQ);
      if (!cardSnap.empty) {
        return cardSnap.docs.map(d => ({ id: d.id, ...d.data() } as Customer));
      }

      // 2. Direct match on exact phone
      const phoneQ = query(collection(db, path), where('phone', '==', searchStr.trim()));
      const phoneSnap = await getDocs(phoneQ);
      if (!phoneSnap.empty) {
        return phoneSnap.docs.map(d => ({ id: d.id, ...d.data() } as Customer));
      }

      // 3. Match against all customers for name, card number, or phone partial matches
      const allSnap = await getDocs(collection(db, path));
      const allCusts = allSnap.docs.map(d => ({ id: d.id, ...d.data() } as Customer));
      
      const filtered = allCusts.filter(c => {
        const nameMatch = c.name?.toLowerCase().includes(term);
        const cardMatch = c.cardNumber?.toLowerCase().includes(term);
        const phoneMatch = c.phone?.toLowerCase().includes(term);
        return nameMatch || cardMatch || phoneMatch;
      });

      // Sort by relevance (exact card match first, then name start, then points)
      return filtered.sort((a, b) => {
        if (a.cardNumber?.toLowerCase() === term) return -1;
        if (b.cardNumber?.toLowerCase() === term) return 1;
        if (a.name?.toLowerCase().startsWith(term) && !b.name?.toLowerCase().startsWith(term)) return -1;
        if (!a.name?.toLowerCase().startsWith(term) && b.name?.toLowerCase().startsWith(term)) return 1;
        return (b.points || 0) - (a.points || 0);
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return [];
    }
  },

  /**
   * Find a single customer by Phone (legacy helper).
   */
  async findCustomerByPhone(phone: string): Promise<Customer | null> {
    const results = await this.searchCustomers(phone);
    return results.length > 0 ? results[0] : null;
  },

  /**
   * Register a new customer with their Loyalty Card number and name.
   */
  async registerCustomer(
    phoneOrCard: string, 
    name: string, 
    options?: { cardNumber?: string; phone?: string; points?: number }
  ) {
    const path = 'customers';
    try {
      // Determine card number and phone based on arguments
      let cardNumber = options?.cardNumber?.trim();
      let phone = options?.phone?.trim();

      if (!cardNumber && !phone) {
        // If phoneOrCard has letters or hyphens, treat as card number; if purely numeric & >= 10, treat as phone
        if (/^\d{10,12}$/.test(phoneOrCard.trim())) {
          phone = phoneOrCard.trim();
          cardNumber = `CG-${Math.floor(1000 + Math.random() * 9000)}`;
        } else {
          cardNumber = phoneOrCard.trim();
          phone = '';
        }
      } else if (!cardNumber) {
        cardNumber = `CG-${Math.floor(1000 + Math.random() * 9000)}`;
      }

      const docRef = await addDoc(collection(db, path), {
        cardNumber: cardNumber || `CG-${Math.floor(1000 + Math.random() * 9000)}`,
        name: name.trim(),
        phone: phone || '',
        points: options?.points ?? 0,
        createdAt: serverTimestamp()
      });

      return {
        id: docRef.id,
        cardNumber: cardNumber || `CG-${Math.floor(1000 + Math.random() * 9000)}`,
        name: name.trim(),
        phone: phone || '',
        points: options?.points ?? 0,
        createdAt: Timestamp.now()
      } as Customer;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
      return null;
    }
  },

  /**
   * Award points to customer (1 point per ₱10 spent).
   */
  async addPoints(customerId: string, amount: number) {
    const pointsToAdd = Math.floor(amount / 10);
    if (pointsToAdd <= 0) return;
    const path = `customers/${customerId}`;
    try {
      const customerRef = doc(db, 'customers', customerId);
      await updateDoc(customerRef, {
        points: increment(pointsToAdd)
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  /**
   * Deduct / Redeem points from customer.
   */
  async redeemPoints(customerId: string, pointsToDeduct: number) {
    if (pointsToDeduct <= 0) return;
    const path = `customers/${customerId}`;
    try {
      const customerRef = doc(db, 'customers', customerId);
      await updateDoc(customerRef, {
        points: increment(-pointsToDeduct)
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  /**
   * Update customer details.
   */
  async updateCustomer(customerId: string, data: Partial<Customer>) {
    const path = `customers/${customerId}`;
    try {
      const customerRef = doc(db, 'customers', customerId);
      await updateDoc(customerRef, data as any);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  /**
   * Delete customer.
   */
  async deleteCustomer(customerId: string) {
    const path = `customers/${customerId}`;
    try {
      await deleteDoc(doc(db, 'customers', customerId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }
};
