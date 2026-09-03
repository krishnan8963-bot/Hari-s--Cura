/**
 * db.js — IndexedDB persistence layer for Hari's Cura.
 *
 * Everything the app stores lives in one IndexedDB database with three
 * object stores: `tasks`, `shopping`, and `settings`. This file exposes a
 * small promise-based API (`DB.*`) so the rest of the app never has to
 * touch IndexedDB transactions directly.
 */

const DB_NAME = 'harisCuraDB';
const DB_VERSION = 1;
const STORE_TASKS = 'tasks';
const STORE_SHOPPING = 'shopping';
const STORE_SETTINGS = 'settings';

let dbInstance = null;

function openDB() {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(STORE_TASKS)) {
        const taskStore = db.createObjectStore(STORE_TASKS, { keyPath: 'id' });
        taskStore.createIndex('date', 'date', { unique: false });
        taskStore.createIndex('completed', 'completed', { unique: false });
        taskStore.createIndex('category', 'category', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_SHOPPING)) {
        const shopStore = db.createObjectStore(STORE_SHOPPING, { keyPath: 'id' });
        shopStore.createIndex('purchased', 'purchased', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.error('IndexedDB failed to open', event.target.error);
      reject(event.target.error);
    };
  });
}

function tx(storeName, mode) {
  return openDB().then((db) => db.transaction(storeName, mode).objectStore(storeName));
}

function promisifyRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/* ---------------------------- generic helpers ---------------------------- */

async function getAll(storeName) {
  const store = await tx(storeName, 'readonly');
  return promisifyRequest(store.getAll());
}

async function getOne(storeName, id) {
  const store = await tx(storeName, 'readonly');
  return promisifyRequest(store.get(id));
}

async function putOne(storeName, value) {
  const store = await tx(storeName, 'readwrite');
  await promisifyRequest(store.put(value));
  return value;
}

async function deleteOne(storeName, id) {
  const store = await tx(storeName, 'readwrite');
  return promisifyRequest(store.delete(id));
}

async function clearStore(storeName) {
  const store = await tx(storeName, 'readwrite');
  return promisifyRequest(store.clear());
}

/* --------------------------------- IDs ----------------------------------- */

function generateId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/* --------------------------------- Tasks ---------------------------------- */

const Tasks = {
  async getAll() {
    return getAll(STORE_TASKS);
  },
  async get(id) {
    return getOne(STORE_TASKS, id);
  },
  async save(task) {
    return putOne(STORE_TASKS, task);
  },
  async remove(id) {
    return deleteOne(STORE_TASKS, id);
  },
  async clear() {
    return clearStore(STORE_TASKS);
  },
  newId() {
    return generateId('task');
  },
};

/* ------------------------------- Shopping --------------------------------- */

const Shopping = {
  async getAll() {
    return getAll(STORE_SHOPPING);
  },
  async get(id) {
    return getOne(STORE_SHOPPING, id);
  },
  async save(item) {
    return putOne(STORE_SHOPPING, item);
  },
  async remove(id) {
    return deleteOne(STORE_SHOPPING, id);
  },
  async clear() {
    return clearStore(STORE_SHOPPING);
  },
  newId() {
    return generateId('shop');
  },
};

/* -------------------------------- Settings --------------------------------- */

const DEFAULT_SETTINGS = {
  theme: 'system', // 'light' | 'dark' | 'system'
  notificationsEnabled: false,
  autoCarryForward: true,
  defaultReminder: 'none',
  firstDayOfWeek: 'monday', // 'monday' | 'sunday'
  animationsEnabled: true,
  onboarded: false,
  sampleDataCleared: false,
  installPromptDismissed: false,
};

const Settings = {
  async getAll() {
    const rows = await getAll(STORE_SETTINGS);
    const settings = { ...DEFAULT_SETTINGS };
    rows.forEach((row) => {
      settings[row.key] = row.value;
    });
    return settings;
  },
  async set(key, value) {
    return putOne(STORE_SETTINGS, { key, value });
  },
  async setMany(obj) {
    const store = await tx(STORE_SETTINGS, 'readwrite');
    await Promise.all(
      Object.entries(obj).map(([key, value]) => promisifyRequest(store.put({ key, value })))
    );
  },
};

/* ------------------------------ Export / Import ----------------------------- */

async function exportAllData() {
  const [tasks, shopping, settings] = await Promise.all([
    Tasks.getAll(),
    Shopping.getAll(),
    Settings.getAll(),
  ]);
  return {
    app: "Hari's Cura",
    exportedAt: new Date().toISOString(),
    version: DB_VERSION,
    data: { tasks, shopping, settings },
  };
}

async function importAllData(payload) {
  if (!payload || !payload.data) throw new Error('Invalid backup file');
  const { tasks = [], shopping = [], settings = {} } = payload.data;

  await Promise.all([clearStore(STORE_TASKS), clearStore(STORE_SHOPPING)]);

  const taskStore = await tx(STORE_TASKS, 'readwrite');
  await Promise.all(tasks.map((t) => promisifyRequest(taskStore.put(t))));

  const shopStore = await tx(STORE_SHOPPING, 'readwrite');
  await Promise.all(shopping.map((s) => promisifyRequest(shopStore.put(s))));

  if (settings && typeof settings === 'object') {
    await Settings.setMany(settings);
  }
}

async function clearAllData() {
  await Promise.all([clearStore(STORE_TASKS), clearStore(STORE_SHOPPING)]);
}

const DB = {
  Tasks,
  Shopping,
  Settings,
  exportAllData,
  importAllData,
  clearAllData,
  DEFAULT_SETTINGS,
};

window.DB = DB;
