import { 
  doc, getDoc, writeBatch, serverTimestamp, collection, 
  increment, addDoc, updateDoc, deleteDoc, setDoc 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Recipe, InventoryItem } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';

export const inventoryService = {
  /**
   * Deducts ingredients from inventory based on product recipes.
   * Aggregates deductions per ingredient to prevent duplicate doc updates in a single writeBatch.
   */
  async processOrderInventory(items: { productId: string; quantity: number }[], branchId: string) {
    try {
      const deductionMap = new Map<string, number>();
      const itemDeductionList: Array<{ ingredientId: string; amount: number; productId: string }> = [];

      for (const item of items) {
        if (!item.productId) continue;
        const recipeDoc = await getDoc(doc(db, 'recipes', item.productId));
        if (!recipeDoc.exists()) continue;

        const recipe = recipeDoc.data() as Recipe;
        if (!recipe.ingredients || !Array.isArray(recipe.ingredients)) continue;

        for (const ingredient of recipe.ingredients) {
          const qty = Number(ingredient.quantity) * Number(item.quantity);
          if (!qty || qty <= 0) continue;

          deductionMap.set(
            ingredient.ingredientId, 
            (deductionMap.get(ingredient.ingredientId) || 0) + qty
          );

          itemDeductionList.push({
            ingredientId: ingredient.ingredientId,
            amount: qty,
            productId: item.productId,
          });
        }
      }

      if (deductionMap.size === 0) return;

      const batch = writeBatch(db);

      // 1. Update ingredient inventory atomically
      for (const [ingredientId, totalQty] of deductionMap.entries()) {
        const ingredientRef = doc(db, 'branches', branchId, 'inventory', ingredientId);
        batch.update(ingredientRef, {
          stock: increment(-totalQty),
        });
      }

      // 2. Add inventory logs
      for (const log of itemDeductionList) {
        const logRef = doc(collection(db, 'inventoryLogs'));
        batch.set(logRef, {
          ingredientId: log.ingredientId,
          branchId,
          amount: -log.amount,
          reason: 'sale',
          productId: log.productId,
          timestamp: serverTimestamp(),
        });
      }

      await batch.commit();
    } catch (error) {
      console.warn('Inventory deduction error, continuing order flow:', error);
      // Don't halt the entire POS flow if inventory doc is missing
    }
  },

  /**
   * Adds a new ingredient item to branch inventory.
   */
  async addIngredient(branchId: string, item: { name: string; unit: 'g' | 'ml' | 'pcs' | 'bottle'; stock: number; minThreshold: number }) {
    const path = `branches/${branchId}/inventory`;
    try {
      const colRef = collection(db, 'branches', branchId, 'inventory');
      return await addDoc(colRef, {
        ...item,
        branchId,
        createdAt: serverTimestamp(),
        lastRestocked: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  /**
   * Updates an existing ingredient.
   */
  async updateIngredient(branchId: string, itemId: string, data: Partial<InventoryItem>) {
    const path = `branches/${branchId}/inventory/${itemId}`;
    try {
      const docRef = doc(db, 'branches', branchId, 'inventory', itemId);
      await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  /**
   * Restocks or adjusts ingredient stock level.
   */
  async restockIngredient(branchId: string, itemId: string, addedStock: number) {
    const path = `branches/${branchId}/inventory/${itemId}`;
    try {
      const docRef = doc(db, 'branches', branchId, 'inventory', itemId);
      await updateDoc(docRef, {
        stock: increment(addedStock),
        lastRestocked: serverTimestamp(),
      });

      // Also log the restock
      await addDoc(collection(db, 'inventoryLogs'), {
        ingredientId: itemId,
        branchId,
        amount: addedStock,
        reason: 'restock',
        timestamp: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  /**
   * Deletes an ingredient from inventory.
   */
  async deleteIngredient(branchId: string, itemId: string) {
    const path = `branches/${branchId}/inventory/${itemId}`;
    try {
      const docRef = doc(db, 'branches', branchId, 'inventory', itemId);
      await deleteDoc(docRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  /**
   * Retrieves product recipe.
   */
  async getRecipe(productId: string): Promise<Recipe | null> {
    try {
      const docSnap = await getDoc(doc(db, 'recipes', productId));
      if (docSnap.exists()) {
        return { productId, ...docSnap.data() } as Recipe;
      }
      return null;
    } catch (err) {
      console.error('Error fetching recipe:', err);
      return null;
    }
  },

  /**
   * Sets or updates product recipe.
   */
  async saveRecipe(productId: string, ingredients: { ingredientId: string; quantity: number }[]) {
    try {
      const docRef = doc(db, 'recipes', productId);
      await setDoc(docRef, {
        productId,
        ingredients,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `recipes/${productId}`);
    }
  },
};
