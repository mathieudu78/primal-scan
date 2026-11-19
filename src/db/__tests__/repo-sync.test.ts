import { beforeEach, describe, expect, it } from 'vitest';
import { openMemoryDb } from './nodeDb';
import { migrate } from '../schema';
import { Repo } from '../repo';
import { pendingCount, syncOnce, SessionRevokedError, type Remote, type RemoteRecord } from '../../sync/engine';
import { apple, butter, rice } from '../../engines/__tests__/fixtures';
import { summarizeDay } from '../../engines/aggregate';
import { DEFAULT_GOALS } from '../../engines/goals';
import type { Db } from '../types';

/** Faux serveur : applique la même logique que sync_records (clé entité+id, horodatage serveur croissant). */
class FakeRemote implements Remote {
  rows = new Map<string, RemoteRecord>(); tick = 0; revoked = false; pushes = 0;
  async push(records: RemoteRecord[]) {
    if (this.revoked) throw new SessionRevokedError('row-level security');
    this.pushes++;
    for (const r of records) this.rows.set(r.entity + '/' + r.id, { ...r, server_updated_at: new Date(1_800_000_000_000 + ++this.tick * 1000).toISOString() });
  }
  async pull(since: string | null) {
    if (this.revoked) throw new SessionRevokedError('row-level security');
    return [...this.rows.values()].filter((r) => !since || r.server_updated_at! > since);
  }
}

let db: Db, repo: Repo, now: number;
const clock = () => ++now;
beforeEach(async () => { db = openMemoryDb(); await migrate(db); now = 1_700_000_000_000; repo = new Repo(db, clock); });

describe('journal local', () => {
  it('ajout, lecture par date, modification, suppression', async () => {
    const e = await repo.addEntry({ date: '2026-03-01', mealType: 'lunch', status: 'eaten', food: apple, qty: { amount: 150, unit: 'g' } });
    await repo.addEntry({ date: '2026-03-02', mealType: 'dinner', status: 'eaten', food: butter, qty: { amount: 10, unit: 'g' } });
    expect(await repo.entriesOn('2026-03-01')).toHaveLength(1);
    expect((await repo.entriesBetween('2026-03-01', '2026-03-31')).length).toBe(2);
    await repo.updateEntry(e.id, { qty: { amount: 200, unit: 'g' } });
    expect((await repo.entriesOn('2026-03-01'))[0].qty.amount).toBe(200);
    await repo.deleteEntry(e.id);
    expect(await repo.entriesOn('2026-03-01')).toHaveLength(0);
  });
  it('planifié ≠ consommé : un repas prévu n’est pas compté tant qu’il n’est pas marqué mangé', async () => {
    const p = await repo.addEntry({ date: '2026-03-05', mealType: 'dinner', status: 'planned', food: rice, qty: { amount: 100, unit: 'g' } });
    const eaten = repo.toLogged(await repo.entriesOn('2026-03-05', 'eaten'));
    expect(summarizeDay(eaten, DEFAULT_GOALS).totals.kcal.value).toBe(0);
    await repo.updateEntry(p.id, { date: '2026-03-06' }); // déplacer
    expect(await repo.entriesOn('2026-03-05')).toHaveLength(0);
    await repo.markEaten(p.id);
    expect(summarizeDay(repo.toLogged(await repo.entriesOn('2026-03-06', 'eaten')), DEFAULT_GOALS).totals.kcal.value).toBe(350);
  });
  it('historique stable : l’entrée garde une copie de l’aliment', async () => {
    await repo.addEntry({ date: '2026-03-01', mealType: 'lunch', status: 'eaten', food: apple, qty: { amount: 100, unit: 'g' } });
    await repo.saveFood({ ...apple, nutrients: { ...apple.nutrients, kcal: 999 } });
    expect((await repo.entriesOn('2026-03-01'))[0].food.nutrients.kcal).toBe(52);
  });
});

describe('aliments, favoris, recettes, réglages', () => {
  it('recherche insensible aux accents et par plusieurs mots', async () => {
    await repo.saveFood({ ...apple, id: 'p1', name: 'Pomme golden', brand: 'Verger' });
    await repo.saveFood({ ...butter, id: 'b1', name: 'Beurre doux' });
    expect((await repo.searchFoods('pomme')).map((f) => f.id)).toEqual(['p1']);
    expect((await repo.searchFoods('POMME verg')).map((f) => f.id)).toEqual(['p1']);
    expect(await repo.searchFoods('')).toEqual([]);
    await repo.saveFood({ ...butter, id: 'b2', barcode: '123' });
    expect((await repo.foodByBarcode('123'))?.id).toBe('b2');
  });
  it('favoris', async () => {
    await repo.setFavorite(apple, true);
    expect(await repo.isFavorite('apple')).toBe(true);
    expect((await repo.favorites()).map((f) => f.id)).toEqual(['apple']);
    await repo.setFavorite(apple, false);
    expect(await repo.favorites()).toEqual([]);
  });
  it('recettes et réglages (objectifs modifiables)', async () => {
    const r = await repo.saveRecipe({ name: 'Bol de riz', servings: 2, items: [{ food: rice, qty: { amount: 200, unit: 'g' } }] });
    expect((await repo.recipes())[0].id).toBe(r.id);
    const s = await repo.getSettings();
    expect(s.goals.kcal).toBe(DEFAULT_GOALS.kcal);
    await repo.saveSettings({ ...s, goals: { ...s.goals, kcal: 3000 } });
    expect((await repo.getSettings()).goals.kcal).toBe(3000);
    expect((await repo.getSettings()).goals.micro.vitC.target).toBe(110);
  });
});

describe('synchronisation', () => {
  it('envoie les modifications locales puis les récupère sur un autre appareil', async () => {
    const remote = new FakeRemote();
    await repo.addEntry({ date: '2026-03-01', mealType: 'lunch', status: 'eaten', food: apple, qty: { amount: 150, unit: 'g' } });
    await repo.setFavorite(apple, true);
    expect(await pendingCount(db)).toBeGreaterThan(1);
    const r1 = await syncOnce(db, remote);
    expect(r1.pushed).toBeGreaterThanOrEqual(2);
    expect(await pendingCount(db)).toBe(0);

    const db2 = openMemoryDb(); await migrate(db2);
    const repo2 = new Repo(db2, clock);
    const r2 = await syncOnce(db2, remote);
    expect(r2.applied).toBeGreaterThanOrEqual(2);
    const e = await repo2.entriesOn('2026-03-01');
    expect(e).toHaveLength(1); expect(e[0].food.name).toBe('Pomme, crue'); expect(e[0].qty.amount).toBe(150);
    expect(await repo2.isFavorite('apple')).toBe(true);
    expect(await pendingCount(db2)).toBe(0);
  });
  it('dernier écrit gagne ; les suppressions se propagent', async () => {
    const remote = new FakeRemote();
    const e = await repo.addEntry({ date: '2026-03-01', mealType: 'lunch', status: 'eaten', food: apple, qty: { amount: 100, unit: 'g' } });
    await syncOnce(db, remote);
    const db2 = openMemoryDb(); await migrate(db2); const repo2 = new Repo(db2, clock);
    await syncOnce(db2, remote);
    await repo2.updateEntry(e.id, { qty: { amount: 300, unit: 'g' } }); // plus récent
    await syncOnce(db2, remote);
    await syncOnce(db, remote);
    expect((await repo.entriesOn('2026-03-01'))[0].qty.amount).toBe(300);
    await repo.deleteEntry(e.id); await syncOnce(db, remote); await syncOnce(db2, remote);
    expect(await repo2.entriesOn('2026-03-01')).toHaveLength(0);
  });
  it('un appareil hors ligne modifie : sa version plus ANCIENNE n’écrase pas la plus récente', async () => {
    const remote = new FakeRemote();
    const e = await repo.addEntry({ date: '2026-03-01', mealType: 'lunch', status: 'eaten', food: apple, qty: { amount: 100, unit: 'g' } });
    await syncOnce(db, remote);
    const db2 = openMemoryDb(); await migrate(db2); const repo2 = new Repo(db2, clock);
    await syncOnce(db2, remote);
    await repo.updateEntry(e.id, { qty: { amount: 111, unit: 'g' } }); // ancien (hors ligne)
    await repo2.updateEntry(e.id, { qty: { amount: 222, unit: 'g' } }); // plus récent
    await syncOnce(db2, remote);
    await syncOnce(db, remote);
    expect((await repo.entriesOn('2026-03-01'))[0].qty.amount).toBe(222);
  });
  it('session révoquée : la synchro est refusée et les données restent en attente', async () => {
    const remote = new FakeRemote(); remote.revoked = true;
    await repo.addEntry({ date: '2026-03-01', mealType: 'lunch', status: 'eaten', food: apple, qty: { amount: 100, unit: 'g' } });
    await expect(syncOnce(db, remote)).rejects.toThrow(SessionRevokedError);
    expect(await pendingCount(db)).toBeGreaterThan(0);
    expect(remote.rows.size).toBe(0);
  });
  it('modification pendant l’envoi : la ligne reste "dirty"', async () => {
    const remote = new FakeRemote();
    const e = await repo.addEntry({ date: '2026-03-01', mealType: 'lunch', status: 'eaten', food: apple, qty: { amount: 100, unit: 'g' } });
    const orig = remote.push.bind(remote);
    remote.push = async (rs) => { remote.push = orig; await orig(rs); await repo.updateEntry(e.id, { qty: { amount: 5, unit: 'g' } }); };
    await syncOnce(db, remote);
    expect(await pendingCount(db)).toBe(1);
    await syncOnce(db, remote);
    expect(await pendingCount(db)).toBe(0);
    expect([...remote.rows.values()].find((r) => r.entity === 'entry')!.data.data).toContain('"amount":5');
  });
});
