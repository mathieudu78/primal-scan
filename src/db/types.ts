/** Abstraction minimale de SQLite : expo-sqlite dans l'app, node:sqlite dans les tests. */
export type SqlValue = string | number | null;
export interface Db {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: SqlValue[]): Promise<{ changes: number }>;
  all<T = Record<string, any>>(sql: string, params?: SqlValue[]): Promise<T[]>;
  get<T = Record<string, any>>(sql: string, params?: SqlValue[]): Promise<T | undefined>;
  transaction<T>(fn: () => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
