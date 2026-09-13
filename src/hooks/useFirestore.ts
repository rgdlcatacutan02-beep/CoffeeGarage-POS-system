import { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, query, QueryConstraint } from 'firebase/firestore';
import { db } from '../lib/firebase';

export function useFirestoreCollection<T>(collectionName: string, constraints: QueryConstraint[] = []) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Keep ref to latest constraints to avoid re-subscribing on every parent render
  const constraintsLength = constraints.length;

  useEffect(() => {
    if (!collectionName) return;

    try {
      // Support subcollection paths like "branches/{branchId}/inventory"
      const pathSegments = collectionName.split('/').filter(Boolean);
      const colRef = pathSegments.length > 1
        ? collection(db, pathSegments[0], ...pathSegments.slice(1))
        : collection(db, collectionName);

      const q = constraints.length > 0 ? query(colRef, ...constraints) : query(colRef);
      
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const items = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as T[];
          setData(items);
          setLoading(false);
        },
        (err) => {
          console.warn(`Error listening to ${collectionName}:`, err);
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (err: any) {
      console.error(`Invalid collection path ${collectionName}:`, err);
      setLoading(false);
    }
  }, [collectionName, constraintsLength]);

  return { data, loading, error };
}
