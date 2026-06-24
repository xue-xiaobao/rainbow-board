import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const dbPath = process.env.DATABASE_PATH || join(__dirname, '../../database.sqlite');

// 确保数据库目录存在
const dbDir = dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// 初始化数据库
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log(`Database initialized: ${dbPath}`);
    initializeSchema();
  }
});

// 初始化数据库结构
function initializeSchema() {
  const schemaPath = join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  
  // sqlite3 需要逐句执行
  const statements = schema.split(';').filter(s => s.trim().length > 0);
  
  let completed = 0;
  statements.forEach((stmt) => {
    db.run(stmt, (err) => {
      if (err) {
        console.error('Schema error:', err);
      }
      completed++;
      if (completed === statements.length) {
        console.log('Database schema initialized');
      }
    });
  });
}

// 包装数据库方法为 Promise
export const dbPromise = {
  all<T>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows as T[]);
      });
    });
  },
  
  get<T>(sql: string, params: any[] = []): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row as T | undefined);
      });
    });
  },
  
  run(sql: string, params: any[] = []): Promise<{ changes: number; lastID: number }> {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ changes: this.changes, lastID: this.lastID });
      });
    });
  },
};

export default db;
