import { describe, expect, it } from 'vitest';
import { createDb, migrateToLatest } from '../src/db';

describe('node:sqlite Kysely driver', () => {
  it('runs migrations and enforces foreign keys', async () => {
    const db = createDb(':memory:');
    const result = await migrateToLatest(db);
    expect(result.results?.map((r) => r.status)).toEqual(['Success']);
    await expect(
      db
        .insertInto('sessions')
        .values({
          id: 'tok',
          user_id: 'missing-user',
          expires_at: '2030-01-01T00:00:00.000Z',
          created_at: '2026-01-01T00:00:00.000Z',
        })
        .execute(),
    ).rejects.toThrow(/FOREIGN KEY/i);
    await db.destroy();
  });

  it('rolls back a failed transaction atomically', async () => {
    const db = createDb(':memory:');
    await migrateToLatest(db);
    const now = '2026-06-30T12:00:00.000Z';
    await expect(
      db.transaction().execute(async (trx) => {
        await trx
          .insertInto('users')
          .values({
            id: 'u1',
            email: 'a@b.c',
            name: 'A',
            password_hash: 'x',
            created_at: now,
            updated_at: now,
          })
          .execute();
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    const rows = await db.selectFrom('users').selectAll().execute();
    expect(rows).toHaveLength(0);

    await db.transaction().execute(async (trx) => {
      await trx
        .insertInto('users')
        .values({
          id: 'u1',
          email: 'a@b.c',
          name: 'A',
          password_hash: 'x',
          created_at: now,
          updated_at: now,
        })
        .execute();
    });
    expect(await db.selectFrom('users').select('email').execute()).toEqual([{ email: 'a@b.c' }]);
    await db.destroy();
  });

  it('serialises concurrent transactions on the single connection', async () => {
    const db = createDb(':memory:');
    await migrateToLatest(db);
    const now = '2026-06-30T12:00:00.000Z';
    const insert = (i: number) =>
      db.transaction().execute(async (trx) => {
        const { c } = await trx
          .selectFrom('users')
          .select((eb) => eb.fn.countAll<number>().as('c'))
          .executeTakeFirstOrThrow();
        await new Promise((r) => setTimeout(r, 2));
        await trx
          .insertInto('users')
          .values({
            id: `u${i}`,
            email: `u${i}@x.y`,
            name: String(Number(c)),
            password_hash: 'x',
            created_at: now,
            updated_at: now,
          })
          .execute();
      });
    await Promise.all([insert(1), insert(2), insert(3)]);
    const names = (await db.selectFrom('users').select('name').orderBy('name').execute()).map(
      (r) => r.name,
    );
    expect(names).toEqual(['0', '1', '2']);
    await db.destroy();
  });

  it('binds booleans and returns counts for writes', async () => {
    const db = createDb(':memory:');
    await migrateToLatest(db);
    const now = '2026-06-30T12:00:00.000Z';
    await db
      .insertInto('users')
      .values({
        id: 'u1',
        email: 'a@b.c',
        name: 'A',
        password_hash: 'x',
        created_at: now,
        updated_at: now,
      })
      .execute();
    const result = await db
      .updateTable('users')
      .set({ name: 'B' })
      .where('id', '=', 'u1')
      .executeTakeFirst();
    expect(Number(result.numUpdatedRows)).toBe(1);
    await db.destroy();
  });
});
