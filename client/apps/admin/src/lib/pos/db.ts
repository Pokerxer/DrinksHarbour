// @ts-nocheck
// IndexedDB wrapper for POS offline support
// Browser-only — guard all usage with typeof window !== 'undefined'

const DB_NAME = 'pos-db';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('IndexedDB is not available in this environment'));
      return;
    }

    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains('products')) {
        db.createObjectStore('products', { keyPath: '_id' });
      }

      if (!db.objectStoreNames.contains('pendingSales')) {
        db.createObjectStore('pendingSales', { keyPath: 'localId', autoIncrement: true });
      }
    };

    req.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    req.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

function txPromise(
  db: IDBDatabase,
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest | void
): Promise<any> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const req = fn(store);

    if (req) {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    } else {
      tx.oncomplete = () => resolve(undefined);
      tx.onerror = () => reject(tx.error);
    }
  });
}

export const posDB = {
  async saveProducts(products: any[]): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('products', 'readwrite');
      const store = tx.objectStore('products');

      // Clear first, then add all
      const clearReq = store.clear();
      clearReq.onsuccess = () => {
        let pending = products.length;
        if (pending === 0) {
          tx.oncomplete = () => resolve();
          return;
        }
        for (const product of products) {
          const putReq = store.put(product);
          putReq.onsuccess = () => {
            pending--;
            if (pending === 0) {
              // All puts issued
            }
          };
          putReq.onerror = () => reject(putReq.error);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
      clearReq.onerror = () => reject(clearReq.error);
    });
  },

  async getProducts(): Promise<any[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('products', 'readonly');
      const store = tx.objectStore('products');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async addPendingSale(sale: any): Promise<number> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('pendingSales', 'readwrite');
      const store = tx.objectStore('pendingSales');
      const req = store.add({ ...sale, retries: sale.retries ?? 0, createdAt: sale.createdAt ?? new Date().toISOString() });
      req.onsuccess = () => resolve(req.result as number);
      req.onerror = () => reject(req.error);
    });
  },

  async getPendingSales(): Promise<any[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('pendingSales', 'readonly');
      const store = tx.objectStore('pendingSales');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async removePendingSale(localId: number): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('pendingSales', 'readwrite');
      const store = tx.objectStore('pendingSales');
      const req = store.delete(localId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  async updatePendingSale(localId: number, updates: Partial<any>): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('pendingSales', 'readwrite');
      const store = tx.objectStore('pendingSales');
      const getReq = store.get(localId);
      getReq.onsuccess = () => {
        const existing = getReq.result;
        if (!existing) { resolve(); return; }
        const putReq = store.put({ ...existing, ...updates });
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      };
      getReq.onerror = () => reject(getReq.error);
    });
  },

  async clearProducts(): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('products', 'readwrite');
      const store = tx.objectStore('products');
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },
};
