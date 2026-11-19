import type { Db } from './types';
import type { Food, LoggedItem, MealType, Quantity } from '../engines/types';
import type { Goals } from '../engines/goals';
import { DEFAULT_GOALS } from '../engines/goals';
import { DEFAULT_PRIMAL_CONFIG, type PrimalConfig } from '../engines/primal/score';

export type EntryStatus = 'eaten' | 'planned';
export interface Entry { id: string; date: string; mealType: MealType; status: EntryStatus; food: Food; qty: Quantity; updatedAt: number }
export interface Recipe {
  id: string; name: string; photoUri?: string; servings: number;
  items: Array<{ food: Food; qty: Quantity }>; updatedAt: number;
}
export interface UserSettings {
  goals: Goals; primal: PrimalConfig;
  profile?: { sex: 'male' | 'female'; age: number; weightKg: number; heightCm: number; activity: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active' };
  units: { energy: 'kcal' };
  setupDone?: boolean;
}

export const uid = (): string => {
  const g = globalThis.crypto?.randomUUID?.();
  if (g) return g;
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 3) | 8).toString(16); });
};
export const normName = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
export const dateKey = (d: Date = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export class Repo {
  constructor(private db: Db, private clock: () => number = Date.now) {}

  /* ---------- journal ---------- */
  async addEntry(e: Omit<Entry, 'id' | 'updatedAt'> & { id?: string }): Promise<Entry> {
    const entry: Entry = { ...e, id: e.id ?? uid(), updatedAt: this.clock() };
    await this.db.run(
      `insert or replace into entries(id,date,meal_type,status,data,updated_at,deleted,dirty) values (?,?,?,?,?,?,0,1)`,
      [entry.id, entry.date, entry.mealType, entry.status, JSON.stringify({ food: entry.food, qty: entry.qty }), entry.updatedAt]);
    return entry;
  }
  private rowToEntry(r: any): Entry {
    const d = JSON.parse(r.data);
    return { id: r.id, date: r.date, mealType: r.meal_type, status: r.status, food: d.food, qty: d.qty, updatedAt: r.updated_at };
  }
  async entriesBetween(from: string, to: string, status?: EntryStatus): Promise<Entry[]> {
    const rows = await this.db.all(
      `select * from entries where deleted=0 and date between ? and ? ${status ? 'and status = ?' : ''} order by date, meal_type, updated_at`,
      status ? [from, to, status] : [from, to]);
    return rows.map((r) => this.rowToEntry(r));
  }
  async entriesOn(date: string, status?: EntryStatus) { return this.entriesBetween(date, date, status); }
  async updateEntry(id: string, patch: Partial<Pick<Entry, 'date' | 'mealType' | 'status' | 'qty'>>): Promise<void> {
    const r = await this.db.get('select * from entries where id=? and deleted=0', [id]);
    if (!r) return;
    const e = this.rowToEntry(r), n = { ...e, ...patch };
    await this.db.run(`update entries set date=?, meal_type=?, status=?, data=?, updated_at=?, dirty=1 where id=?`,
      [n.date, n.mealType, n.status, JSON.stringify({ food: n.food, qty: n.qty }), this.clock(), id]);
  }
  async deleteEntry(id: string) { await this.db.run('update entries set deleted=1, dirty=1, updated_at=? where id=?', [this.clock(), id]); }
  /** Marque un repas planifié comme consommé (il n'est jamais compté automatiquement). */
  async markEaten(id: string) { await this.updateEntry(id, { status: 'eaten' }); }

  toLogged(entries: Entry[]): LoggedItem[] { return entries.map((e) => ({ id: e.id, food: e.food, qty: e.qty })); }

  /* ---------- aliments (cache scans/recherche + aliments personnalisés) ---------- */
  async saveFood(food: Food): Promise<void> {
    await this.db.run(
      `insert into foods(id,name_norm,barcode,source,data,last_used,updated_at,deleted,dirty) values (?,?,?,?,?,?,?,0,1)
       on conflict(id) do update set name_norm=excluded.name_norm, barcode=excluded.barcode, data=excluded.data,
         last_used=excluded.last_used, updated_at=excluded.updated_at, deleted=0, dirty=1`,
      [food.id, normName(`${food.name} ${food.brand ?? ''}`), food.barcode ?? null, food.source, JSON.stringify(food), this.clock(), this.clock()]);
  }
  async foodByBarcode(barcode: string): Promise<Food | undefined> {
    const r = await this.db.get<any>('select data from foods where barcode=? and deleted=0', [barcode]);
    return r ? JSON.parse(r.data) : undefined;
  }
  async getFood(id: string): Promise<Food | undefined> {
    const r = await this.db.get<any>('select data from foods where id=? and deleted=0', [id]);
    return r ? JSON.parse(r.data) : undefined;
  }
  async searchFoods(query: string, limit = 30): Promise<Food[]> {
    const terms = normName(query).split(' ').filter(Boolean);
    if (!terms.length) return [];
    const where = terms.map(() => 'name_norm like ?').join(' and ');
    const rows = await this.db.all<any>(
      `select data from foods where deleted=0 and ${where} order by coalesce(last_used,0) desc, name_norm limit ?`,
      [...terms.map((t) => `%${t}%`), limit]);
    return rows.map((r) => JSON.parse(r.data));
  }
  async recentFoods(limit = 20): Promise<Food[]> {
    const rows = await this.db.all<any>('select data from foods where deleted=0 order by coalesce(last_used,0) desc limit ?', [limit]);
    return rows.map((r) => JSON.parse(r.data));
  }

  /* ---------- favoris ---------- */
  async setFavorite(food: Food, on: boolean): Promise<void> {
    if (on) await this.db.run(`insert into favorites(id,data,updated_at,deleted,dirty) values (?,?,?,0,1)
       on conflict(id) do update set data=excluded.data, updated_at=excluded.updated_at, deleted=0, dirty=1`, [food.id, JSON.stringify(food), this.clock()]);
    else await this.db.run('update favorites set deleted=1, dirty=1, updated_at=? where id=?', [this.clock(), food.id]);
  }
  async favorites(): Promise<Food[]> {
    return (await this.db.all<any>('select data from favorites where deleted=0 order by updated_at desc')).map((r) => JSON.parse(r.data));
  }
  async isFavorite(id: string) { return !!(await this.db.get('select 1 x from favorites where id=? and deleted=0', [id])); }

  /* ---------- recettes ---------- */
  async saveRecipe(r: Omit<Recipe, 'id' | 'updatedAt'> & { id?: string }): Promise<Recipe> {
    const rec: Recipe = { ...r, id: r.id ?? uid(), updatedAt: this.clock() };
    await this.db.run(`insert or replace into recipes(id,name,data,updated_at,deleted,dirty) values (?,?,?,?,0,1)`,
      [rec.id, rec.name, JSON.stringify(rec), rec.updatedAt]);
    return rec;
  }
  async recipes(): Promise<Recipe[]> {
    return (await this.db.all<any>('select data from recipes where deleted=0 order by name')).map((r) => JSON.parse(r.data));
  }
  async deleteRecipe(id: string) { await this.db.run('update recipes set deleted=1, dirty=1, updated_at=? where id=?', [this.clock(), id]); }

  /* ---------- réglages ---------- */
  async getSettings(): Promise<UserSettings> {
    const r = await this.db.get<any>(`select data from settings where id='user' and deleted=0`);
    const base: UserSettings = { goals: DEFAULT_GOALS, primal: DEFAULT_PRIMAL_CONFIG, units: { energy: 'kcal' } };
    if (!r) return base;
    const s = JSON.parse(r.data);
    return { ...base, ...s, goals: { ...DEFAULT_GOALS, ...s.goals, micro: { ...DEFAULT_GOALS.micro, ...(s.goals?.micro ?? {}) } }, primal: { ...DEFAULT_PRIMAL_CONFIG, ...s.primal } };
  }
  async saveSettings(s: UserSettings): Promise<void> {
    await this.db.run(`insert into settings(id,data,updated_at,deleted,dirty) values ('user',?,?,0,1)
      on conflict(id) do update set data=excluded.data, updated_at=excluded.updated_at, deleted=0, dirty=1`, [JSON.stringify(s), this.clock()]);
  }
}
