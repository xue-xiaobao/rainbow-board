import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'rainbow-board-db';
const DB_VERSION = 1;
const WORKFLOW_STORE = 'workflows';
const SETTINGS_STORE = 'settings';

let db: IDBPDatabase | null = null;

export async function initDB(): Promise<IDBPDatabase> {
  if (db) return db;
  
  db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // 工作流存储
      if (!db.objectStoreNames.contains(WORKFLOW_STORE)) {
        db.createObjectStore(WORKFLOW_STORE, { keyPath: 'id' });
      }
      // 设置存储
      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
      }
    }
  });
  
  return db;
}

export interface WorkflowData {
  id: string;
  name: string;
  data: any;
  createdAt: number;
  updatedAt: number;
}

export async function saveWorkflow(workflow: WorkflowData): Promise<void> {
  const database = await initDB();
  workflow.updatedAt = Date.now();
  await database.put(WORKFLOW_STORE, workflow);
}

export async function loadWorkflow(id: string): Promise<WorkflowData | undefined> {
  const database = await initDB();
  return database.get(WORKFLOW_STORE, id);
}

export async function listWorkflows(): Promise<WorkflowData[]> {
  const database = await initDB();
  return database.getAll(WORKFLOW_STORE);
}

export async function deleteWorkflow(id: string): Promise<void> {
  const database = await initDB();
  await database.delete(WORKFLOW_STORE, id);
}

export async function saveSetting(key: string, value: any): Promise<void> {
  const database = await initDB();
  await database.put(SETTINGS_STORE, { key, value });
}

export async function loadSetting(key: string): Promise<any> {
  const database = await initDB();
  const result = await database.get(SETTINGS_STORE, key);
  return result?.value;
}

export async function saveCurrentWorkflow(data: any): Promise<void> {
  const workflow: WorkflowData = {
    id: 'current',
    name: '当前工作流',
    data,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  await saveWorkflow(workflow);
}

export async function loadCurrentWorkflow(): Promise<any> {
  const workflow = await loadWorkflow('current');
  return workflow?.data;
}
