// IndexedDB helper for offline attendance records

const DB_NAME = "hstack_offline";
const STORE_NAME = "pending_attendance";
const DB_VERSION = 1;

export interface OfflineAttendanceRecord {
  id: string;
  user_id: string;
  date: string;
  check_in_time?: string;
  check_out_time?: string;
  location_type: string;
  location_note?: string | null;
  project_id?: string | null;
  gps_lat?: number | null;
  gps_lng?: number | null;
  gps_verified: boolean;
  remote_reason?: string | null;
  hours_worked?: number | null;
  action: "check_in" | "check_out";
  created_at: string;
  // For check-out, reference the attendance record id (local UUID — used for lookup only)
  attendance_record_id?: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveOfflineRecord(record: OfflineAttendanceRecord): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPendingRecords(): Promise<OfflineAttendanceRecord[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function clearPendingRecords(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Delete a single record by key — used by OfflineProvider to clear only
// successfully synced records rather than the entire store at once.
export async function deleteOfflineRecord(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPendingCount(): Promise<number> {
  const records = await getPendingRecords();
  return records.length;
}
