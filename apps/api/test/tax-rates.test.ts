import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createFixture, type Fixture } from './helpers';

describe('tax rates', () => {
  let f: Fixture;
  beforeAll(async () => {
    f = await createFixture();
  });
  afterAll(() => f.close());

  it('creates rates and tracks the workspace default', async () => {
    const vat = await f.post('/tax-rates', { name: 'VAT 20%', rateBp: 2000, isDefault: true });
    expect(vat.status).toBe(201);
    expect(vat.body.taxRate).toMatchObject({
      name: 'VAT 20%',
      rateBp: 2000,
      isDefault: true,
      archived: false,
    });
    const ws = await f.get('/');
    expect(ws.body.workspace.settings.defaultTaxRateId).toBe(vat.body.taxRate.id);

    const reduced = await f.post('/tax-rates', { name: 'Reduced', rateBp: 500, isDefault: true });
    expect((await f.get('/')).body.workspace.settings.defaultTaxRateId).toBe(
      reduced.body.taxRate.id,
    );
    const list = await f.get('/tax-rates');
    expect(
      list.body.items.map((r: { name: string; isDefault: boolean }) => [r.name, r.isDefault]),
    ).toEqual([
      ['VAT 20%', false],
      ['Reduced', true],
    ]);
  });

  it('validates basis points', async () => {
    expect((await f.post('/tax-rates', { name: 'Too much', rateBp: 20000 })).status).toBe(400);
    expect((await f.post('/tax-rates', { name: '', rateBp: 100 })).status).toBe(400);
  });

  it('archiving the default clears the workspace default', async () => {
    const list = await f.get('/tax-rates');
    const current = list.body.items.find((r: { isDefault: boolean }) => r.isDefault);
    const del = await f.del(`/tax-rates/${current.id}`);
    expect(del.status).toBe(200);
    expect(del.body.taxRate).toMatchObject({ archived: true, isDefault: false });
    expect((await f.get('/')).body.workspace.settings.defaultTaxRateId).toBeNull();
    const patch = await f.patch(`/tax-rates/${current.id}`, { name: 'Renamed', archived: false });
    expect(patch.body.taxRate).toMatchObject({ name: 'Renamed', archived: false });
    expect(
      (await f.patch('/tax-rates/00000000-0000-4000-8000-000000000000', { name: 'x' })).status,
    ).toBe(404);
  });
});
