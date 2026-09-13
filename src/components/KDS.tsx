import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Order } from '../types';
import { useFirebase } from './FirebaseProvider';
import { Clock, CheckCircle2, ChevronRight, AlertCircle, ChefHat, Volume2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn, safeToDate } from '../lib/utils';

import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';

function playOrderChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12); // A5
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch {
    // AudioContext blocked before user interaction
  }
}

export default function KDS() {
  const { currentBranch } = useFirebase();
  const [orders, setOrders] = useState<Order[]>([]);
  const prevCountRef = useRef<number | null>(null);

  useEffect(() => {
    // Query branch active orders without compound order constraint to eliminate composite index requirement
    const q = query(
      collection(db, 'orders'),
      where('branchId', '==', currentBranch),
      where('status', 'in', ['pending', 'preparing', 'ready'])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      
      // Sort oldest first so kitchen serves in queue order
      items.sort((a, b) => safeToDate(a.createdAt).getTime() - safeToDate(b.createdAt).getTime());

      // Play alert chime when a new ticket arrives
      if (prevCountRef.current !== null && items.length > prevCountRef.current) {
        playOrderChime();
      }
      prevCountRef.current = items.length;

      setOrders(items);
    }, (error) => {
      console.warn('KDS query error:', error);
    });

    return () => unsubscribe();
  }, [currentBranch]);

  const updateStatus = async (orderId: string, status: Order['status']) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), { status });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white overflow-hidden">
      <header className="h-20 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-8 shrink-0">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20">
            <ChefHat className="text-white w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">Kitchen Display</h1>
            <p className="text-sm text-gray-400 font-medium">Branch ID: {currentBranch}</p>
          </div>
        </div>
        <div className="flex items-center space-x-8">
          <div className="text-right">
            <p className="text-3xl font-black text-orange-500">{orders.length}</p>
            <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Active Orders</p>
          </div>
          <div className="h-10 w-px bg-gray-700" />
          <div className="text-right">
            <p className="text-xl font-bold">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">{new Date().toLocaleDateString()}</p>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-x-auto p-6 flex space-x-6 items-start no-scrollbar">
        {orders.map(order => (
          <div 
            key={order.id} 
            className={cn(
              "w-80 shrink-0 bg-gray-800 rounded-[2rem] border-2 flex flex-col max-h-full shadow-2xl animate-in slide-in-from-right-4 duration-300",
              order.status === 'pending' ? "border-red-500/50 shadow-red-500/5" : 
              order.status === 'preparing' ? "border-orange-500/50 shadow-orange-500/5" : "border-green-500/50 shadow-green-500/5"
            )}
          >
            <div className="p-5 border-b border-gray-700 flex justify-between items-start">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-gray-400 font-black mb-1">
                  Order #{order.id.slice(-4)}
                </p>
                <div className="flex items-center text-sm font-bold text-gray-300">
                  <Clock className="w-4 h-4 mr-1 text-orange-500" />
                  {formatDistanceToNow(safeToDate(order.createdAt))} ago
                </div>
              </div>
              <div className={cn(
                "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter",
                order.status === 'pending' ? "bg-red-500/20 text-red-400" :
                order.status === 'preparing' ? "bg-orange-500/20 text-orange-400" : "bg-green-500/20 text-green-400"
              )}>
                {order.status}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {order.items.map((item, idx) => (
                <div key={idx} className="flex items-start space-x-3">
                  <span className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center font-black text-orange-500 shrink-0">
                    {item.quantity}
                  </span>
                  <div>
                    <p className="font-bold text-gray-100">{item.name}</p>
                    <p className="text-xs text-gray-500">Regular Style</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 bg-gray-850/50 border-t border-gray-700 grid grid-cols-1 gap-2">
              {order.status === 'pending' && (
                <button 
                  onClick={() => updateStatus(order.id, 'preparing')}
                  className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-black shadow-lg shadow-orange-500/20 transition-all flex items-center justify-center space-x-2"
                >
                  <ChevronRight className="w-5 h-5" />
                  <span>Start Preparing</span>
                </button>
              )}
              {order.status === 'preparing' && (
                <button 
                  onClick={() => updateStatus(order.id, 'ready')}
                  className="w-full py-4 bg-green-500 hover:bg-green-600 text-white rounded-2xl font-black shadow-lg shadow-green-500/20 transition-all flex items-center justify-center space-x-2"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Mark as Ready</span>
                </button>
              )}
              {order.status === 'ready' && (
                <button 
                  onClick={() => updateStatus(order.id, 'completed')}
                  className="w-full py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center space-x-2"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Mark Picked Up</span>
                </button>
              )}
            </div>
          </div>
        ))}

        {orders.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center opacity-20 h-full">
            <AlertCircle className="w-32 h-32 mb-4" />
            <p className="text-4xl font-black tracking-tight">No Active Orders</p>
          </div>
        )}
      </main>
    </div>
  );
}
