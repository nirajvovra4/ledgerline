import { formatMoney, type SearchHit, type SearchResultsDto } from '@ledgerline/shared';
import { likeContains } from '../lib/pagination';
import type { WorkspaceCtx } from './context';

const LIMIT = 5;

/** Case-insensitive contains search across the four main record types. */
export async function search(ctx: WorkspaceCtx, q: string): Promise<SearchResultsDto> {
  const ws = ctx.workspace.id;
  const like = likeContains(q.trim());
  const base = `/w/${ctx.workspace.slug}`;
  const money = (cents: number) => formatMoney(cents, ctx.workspace.currency);
  const [clients, projects, invoices, expenses] = await Promise.all([
    ctx.db
      .selectFrom('clients')
      .select(['id', 'name', 'company', 'email', 'status'])
      .where('workspace_id', '=', ws)
      .where((eb) =>
        eb.or([eb('name', 'like', like), eb('company', 'like', like), eb('email', 'like', like)]),
      )
      .orderBy('name')
      .limit(LIMIT)
      .execute(),
    ctx.db
      .selectFrom('projects as p')
      .innerJoin('clients as c', 'c.id', 'p.client_id')
      .select(['p.id', 'p.name', 'p.code', 'p.status', 'c.name as client_name'])
      .where('p.workspace_id', '=', ws)
      .where((eb) => eb.or([eb('p.name', 'like', like), eb('p.code', 'like', like)]))
      .orderBy('p.name')
      .limit(LIMIT)
      .execute(),
    ctx.db
      .selectFrom('invoices as i')
      .innerJoin('clients as c', 'c.id', 'i.client_id')
      .select(['i.id', 'i.number', 'i.status', 'i.total_cents', 'c.name as client_name'])
      .where('i.workspace_id', '=', ws)
      .where((eb) => eb.or([eb('i.number', 'like', like), eb('c.name', 'like', like)]))
      .orderBy('i.issue_date', 'desc')
      .limit(LIMIT)
      .execute(),
    ctx.db
      .selectFrom('expenses')
      .select(['id', 'vendor', 'description', 'status', 'total_cents'])
      .where('workspace_id', '=', ws)
      .where((eb) => eb.or([eb('vendor', 'like', like), eb('description', 'like', like)]))
      .orderBy('date', 'desc')
      .limit(LIMIT)
      .execute(),
  ]);
  const hits = {
    clients: clients.map<SearchHit>((c) => ({
      id: c.id,
      type: 'client',
      title: c.name,
      subtitle: [c.company, c.email, c.status === 'archived' ? 'archived' : '']
        .filter(Boolean)
        .join(' · '),
      link: `${base}/clients/${c.id}`,
    })),
    projects: projects.map<SearchHit>((p) => ({
      id: p.id,
      type: 'project',
      title: p.code ? `${p.code} · ${p.name}` : p.name,
      subtitle: `${p.client_name} · ${p.status.replace('_', ' ')}`,
      link: `${base}/projects/${p.id}`,
    })),
    invoices: invoices.map<SearchHit>((i) => ({
      id: i.id,
      type: 'invoice',
      title: i.number,
      subtitle: `${i.client_name} · ${money(i.total_cents)} · ${i.status.replace('_', ' ')}`,
      link: `${base}/invoices/${i.id}`,
    })),
    expenses: expenses.map<SearchHit>((e) => ({
      id: e.id,
      type: 'expense',
      title: e.vendor,
      subtitle: `${e.description} · ${money(e.total_cents)} · ${e.status.replace('_', ' ')}`,
      link: `${base}/expenses/${e.id}`,
    })),
  };
  return hits;
}
