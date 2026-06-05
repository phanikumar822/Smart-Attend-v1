const DB_NAME = 'SmartAttendOfflineDB';
const DB_VERSION = 1;

export interface OfflineScan {
  rollNo: string;
  timestamp: string;
}

export function initOfflineDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('students')) {
        db.createObjectStore('students', { keyPath: '_id' });
      }
      if (!db.objectStoreNames.contains('scans')) {
        db.createObjectStore('scans', { autoIncrement: true });
      }
    };
    
    request.onsuccess = (event: any) => {
      resolve(event.target.result);
    };
    
    request.onerror = (event: any) => {
      reject(event.target.error);
    };
  });
}

export async function cacheStudents(students: any[]): Promise<void> {
  try {
    const db = await initOfflineDB();
    const transaction = db.transaction('students', 'readwrite');
    const store = transaction.objectStore('students');
    
    store.clear();
    
    students.forEach(student => {
      store.put(student);
    });
  } catch (err) {
    console.error('Failed to cache students in IndexedDB:', err);
  }
}

export async function getCachedStudents(): Promise<any[]> {
  try {
    const db = await initOfflineDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('students', 'readonly');
      const store = transaction.objectStore('students');
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Failed to get cached students from IndexedDB:', err);
    return [];
  }
}

export async function queueOfflineScan(rollNo: string): Promise<void> {
  try {
    const db = await initOfflineDB();
    const transaction = db.transaction('scans', 'readwrite');
    const store = transaction.objectStore('scans');
    store.add({
      rollNo,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Failed to queue offline scan:', err);
  }
}

export async function getQueuedScans(): Promise<OfflineScan[]> {
  try {
    const db = await initOfflineDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('scans', 'readonly');
      const store = transaction.objectStore('scans');
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Failed to get offline scans:', err);
    return [];
  }
}

export async function clearQueuedScans(): Promise<void> {
  try {
    const db = await initOfflineDB();
    const transaction = db.transaction('scans', 'readwrite');
    const store = transaction.objectStore('scans');
    store.clear();
  } catch (err) {
    console.error('Failed to clear queued scans:', err);
  }
}
