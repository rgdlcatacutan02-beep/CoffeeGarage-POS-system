import { collection, addDoc, updateDoc, doc, serverTimestamp, query, where, getDocs, Timestamp, limit, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Shift } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';

export const shiftService = {
  async openShift(userId: string, username: string, branchId: string, openingBalance: number) {
    const path = 'shifts';
    try {
      return await addDoc(collection(db, path), {
        userId,
        username,
        branchId,
        openingBalance,
        startTime: serverTimestamp(),
        status: 'open'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async closeShift(shiftId: string, closingBalance: number, expectedCash: number) {
    const path = `shifts/${shiftId}`;
    try {
      const shiftRef = doc(db, 'shifts', shiftId);
      await updateDoc(shiftRef, {
        closingBalance,
        expectedCash,
        endTime: serverTimestamp(),
        status: 'closed'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async getCurrentShift(userId: string, branchId: string) {
    const path = 'shifts';
    try {
      const q = query(
        collection(db, path),
        where('userId', '==', userId),
        where('branchId', '==', branchId),
        where('status', '==', 'open'),
        limit(1)
      );
      const snap = await getDocs(q);
      if (snap.empty) return null;
      return { id: snap.docs[0].id, ...snap.docs[0].data() } as Shift;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  }
};
