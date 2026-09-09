import type {
  AccountDto,
  ClientDto,
  InvoiceDetailDto,
  InvoiceDto,
  MetaDto,
  TaxRateDto,
  UserDto,
  WorkspaceDto,
  WorkspaceSummary,
} from '@ledgerline/shared';
import { DEFAULT_WORKSPACE_SETTINGS, uuidFromLabel } from '@ledgerline/shared';

export const TODAY = '2026-06-30';
export const SLUG = 'northlight';

export const user: UserDto = {
  id: uuidFromLabel('user:ada'),
  email: 'ada@northlight.studio',
  name: 'Ada Lovelace',
  createdAt: '2026-01-01T00:00:00.000Z',
};

export const workspaceSummary: WorkspaceSummary = {
  id: uuidFromLabel('ws:northlight'),
  name: 'Northlight Studio',
  slug: SLUG,
  currency: 'USD',
  role: 'owner',
  memberCount: 3,
};

export const workspace: WorkspaceDto = {
  id: workspaceSummary.id,
  name: 'Northlight Studio',
  slug: SLUG,
  currency: 'USD',
  settings: {
    ...DEFAULT_WORKSPACE_SETTINGS,
    address: '12 Harbour Lane\nBristol',
    email: 'hello@northlight.studio',
    phone: '+44 117 000 0000',
  },
  createdAt: '2026-01-01T00:00:00.000Z',
};

export const meta: MetaDto = { today: TODAY, version: 'test', fixedClock: true };

export function makeClient(overrides: Partial<ClientDto> = {}): ClientDto {
  return {
    id: uuidFromLabel(`client:${overrides.name ?? 'acme'}`),
    workspaceId: workspace.id,
    name: 'Acme Studios',
    company: 'Acme Studios Ltd',
    email: 'billing@acme.test',
    phone: '',
    addressLine1: '1 Main St',
    addressLine2: '',
    city: 'Bristol',
    region: '',
    postalCode: 'BS1 1AA',
    country: 'UK',
    taxId: '',
    paymentTermsDays: 30,
    notes: '',
    status: 'active',
    createdAt: '2026-01-05T00:00:00.000Z',
    updatedAt: '2026-01-05T00:00:00.000Z',
    outstandingCents: 125000,
    invoiceCount: 4,
    projectCount: 2,
    ...overrides,
  };
}

export const taxRates: TaxRateDto[] = [
  {
    id: uuidFromLabel('tax:vat'),
    workspaceId: workspace.id,
    name: 'VAT',
    rateBp: 2000,
    isDefault: true,
    archived: false,
  },
  {
    id: uuidFromLabel('tax:reduced'),
    workspaceId: workspace.id,
    name: 'Reduced',
    rateBp: 500,
    isDefault: false,
    archived: false,
  },
];

export const accounts: AccountDto[] = [
  {
    id: uuidFromLabel('acct:cash'),
    workspaceId: workspace.id,
    code: '1000',
    name: 'Operating Bank Account',
    type: 'asset',
    parentId: null,
    isSystem: true,
    systemKey: 'cash',
    archived: false,
    description: '',
    balanceCents: 500000,
  },
  {
    id: uuidFromLabel('acct:ar'),
    workspaceId: workspace.id,
    code: '1200',
    name: 'Accounts Receivable',
    type: 'asset',
    parentId: null,
    isSystem: true,
    systemKey: 'accounts_receivable',
    archived: false,
    description: '',
    balanceCents: 125000,
  },
  {
    id: uuidFromLabel('acct:equity'),
    workspaceId: workspace.id,
    code: '3000',
    name: "Owner's Equity",
    type: 'equity',
    parentId: null,
    isSystem: true,
    systemKey: 'owner_equity',
    archived: false,
    description: '',
    balanceCents: 0,
  },
  {
    id: uuidFromLabel('acct:services'),
    workspaceId: workspace.id,
    code: '4000',
    name: 'Services Revenue',
    type: 'revenue',
    parentId: null,
    isSystem: true,
    systemKey: 'services_revenue',
    archived: false,
    description: '',
    balanceCents: 900000,
  },
  {
    id: uuidFromLabel('acct:software'),
    workspaceId: workspace.id,
    code: '5100',
    name: 'Software & Subscriptions',
    type: 'expense',
    parentId: null,
    isSystem: true,
    systemKey: 'software_expense',
    archived: false,
    description: '',
    balanceCents: 40000,
  },
];

export function makeInvoice(overrides: Partial<InvoiceDto> = {}): InvoiceDto {
  const client = makeClient();
  return {
    id: uuidFromLabel(`invoice:${overrides.number ?? 'INV-1001'}`),
    workspaceId: workspace.id,
    clientId: client.id,
    clientName: client.name,
    projectId: null,
    projectName: null,
    number: 'INV-1001',
    status: 'sent',
    derivedStatus: 'sent',
    issueDate: '2026-06-01',
    dueDate: '2026-07-01',
    currency: 'USD',
    discountBp: 0,
    subtotalCents: 100000,
    discountCents: 0,
    taxCents: 20000,
    totalCents: 120000,
    amountPaidCents: 0,
    balanceCents: 120000,
    notes: '',
    terms: '',
    poNumber: '',
    sentAt: '2026-06-01T09:00:00.000Z',
    approvedAt: '2026-06-01T08:00:00.000Z',
    approvedBy: user.id,
    voidedAt: null,
    voidReason: '',
    createdBy: user.id,
    createdAt: '2026-06-01T07:00:00.000Z',
    updatedAt: '2026-06-01T09:00:00.000Z',
    ...overrides,
  };
}

export function makeInvoiceDetail(overrides: Partial<InvoiceDetailDto> = {}): InvoiceDetailDto {
  const base = makeInvoice(overrides);
  return {
    ...base,
    lines: [
      {
        id: uuidFromLabel('line:1'),
        invoiceId: base.id,
        position: 0,
        description: 'Design work',
        quantity: 10,
        unitPriceCents: 10000,
        taxRateId: taxRates[0]!.id,
        taxRateBp: 2000,
        accountId: accounts[3]!.id,
        lineTotalCents: 100000,
        taxCents: 20000,
      },
    ],
    client: makeClient(),
    project: null,
    payments: [],
    approvals: [],
    journalEntries: [],
    history: [],
    ...overrides,
  };
}
