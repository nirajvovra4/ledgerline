import { sql, type Kysely, type Migration } from 'kysely';

/**
 * Initial schema. Every workspace-owned table carries `workspace_id` with an index so that the
 * per-tenant queries stay cheap; uniqueness rules mirror DESIGN.md §2.
 */
export const migration001: Migration = {
  async up(db: Kysely<unknown>): Promise<void> {
    await db.schema
      .createTable('users')
      .addColumn('id', 'text', (c) => c.primaryKey())
      .addColumn('email', 'text', (c) => c.notNull().unique())
      .addColumn('name', 'text', (c) => c.notNull())
      .addColumn('password_hash', 'text', (c) => c.notNull())
      .addColumn('created_at', 'text', (c) => c.notNull())
      .addColumn('updated_at', 'text', (c) => c.notNull())
      .execute();

    await db.schema
      .createTable('sessions')
      .addColumn('id', 'text', (c) => c.primaryKey())
      .addColumn('user_id', 'text', (c) => c.notNull().references('users.id').onDelete('cascade'))
      .addColumn('expires_at', 'text', (c) => c.notNull())
      .addColumn('created_at', 'text', (c) => c.notNull())
      .execute();
    await db.schema.createIndex('sessions_user_idx').on('sessions').column('user_id').execute();

    await db.schema
      .createTable('workspaces')
      .addColumn('id', 'text', (c) => c.primaryKey())
      .addColumn('name', 'text', (c) => c.notNull())
      .addColumn('slug', 'text', (c) => c.notNull().unique())
      .addColumn('currency', 'text', (c) => c.notNull())
      .addColumn('settings', 'text', (c) => c.notNull())
      .addColumn('created_at', 'text', (c) => c.notNull())
      .addColumn('updated_at', 'text', (c) => c.notNull())
      .execute();

    await db.schema
      .createTable('memberships')
      .addColumn('workspace_id', 'text', (c) =>
        c.notNull().references('workspaces.id').onDelete('cascade'),
      )
      .addColumn('user_id', 'text', (c) => c.notNull().references('users.id').onDelete('cascade'))
      .addColumn('role', 'text', (c) => c.notNull())
      .addColumn('created_at', 'text', (c) => c.notNull())
      .addPrimaryKeyConstraint('memberships_pk', ['workspace_id', 'user_id'])
      .execute();
    await db.schema
      .createIndex('memberships_user_idx')
      .on('memberships')
      .column('user_id')
      .execute();

    await db.schema
      .createTable('invites')
      .addColumn('id', 'text', (c) => c.primaryKey())
      .addColumn('workspace_id', 'text', (c) =>
        c.notNull().references('workspaces.id').onDelete('cascade'),
      )
      .addColumn('email', 'text', (c) => c.notNull())
      .addColumn('role', 'text', (c) => c.notNull())
      .addColumn('token', 'text', (c) => c.notNull().unique())
      .addColumn('invited_by', 'text', (c) => c.notNull().references('users.id'))
      .addColumn('accepted_at', 'text')
      .addColumn('created_at', 'text', (c) => c.notNull())
      .execute();
    await db.schema
      .createIndex('invites_workspace_idx')
      .on('invites')
      .column('workspace_id')
      .execute();

    await db.schema
      .createTable('clients')
      .addColumn('id', 'text', (c) => c.primaryKey())
      .addColumn('workspace_id', 'text', (c) =>
        c.notNull().references('workspaces.id').onDelete('cascade'),
      )
      .addColumn('name', 'text', (c) => c.notNull())
      .addColumn('company', 'text', (c) => c.notNull().defaultTo(''))
      .addColumn('email', 'text', (c) => c.notNull().defaultTo(''))
      .addColumn('phone', 'text', (c) => c.notNull().defaultTo(''))
      .addColumn('address_line1', 'text', (c) => c.notNull().defaultTo(''))
      .addColumn('address_line2', 'text', (c) => c.notNull().defaultTo(''))
      .addColumn('city', 'text', (c) => c.notNull().defaultTo(''))
      .addColumn('region', 'text', (c) => c.notNull().defaultTo(''))
      .addColumn('postal_code', 'text', (c) => c.notNull().defaultTo(''))
      .addColumn('country', 'text', (c) => c.notNull().defaultTo(''))
      .addColumn('tax_id', 'text', (c) => c.notNull().defaultTo(''))
      .addColumn('payment_terms_days', 'integer', (c) => c.notNull().defaultTo(30))
      .addColumn('notes', 'text', (c) => c.notNull().defaultTo(''))
      .addColumn('status', 'text', (c) => c.notNull().defaultTo('active'))
      .addColumn('created_at', 'text', (c) => c.notNull())
      .addColumn('updated_at', 'text', (c) => c.notNull())
      .execute();
    await db.schema
      .createIndex('clients_workspace_idx')
      .on('clients')
      .columns(['workspace_id', 'name'])
      .execute();

    await db.schema
      .createTable('projects')
      .addColumn('id', 'text', (c) => c.primaryKey())
      .addColumn('workspace_id', 'text', (c) =>
        c.notNull().references('workspaces.id').onDelete('cascade'),
      )
      .addColumn('client_id', 'text', (c) => c.notNull().references('clients.id'))
      .addColumn('name', 'text', (c) => c.notNull())
      .addColumn('code', 'text', (c) => c.notNull().defaultTo(''))
      .addColumn('description', 'text', (c) => c.notNull().defaultTo(''))
      .addColumn('status', 'text', (c) => c.notNull().defaultTo('active'))
      .addColumn('billing_type', 'text', (c) => c.notNull().defaultTo('hourly'))
      .addColumn('hourly_rate_cents', 'integer', (c) => c.notNull().defaultTo(0))
      .addColumn('budget_cents', 'integer', (c) => c.notNull().defaultTo(0))
      .addColumn('start_date', 'text')
      .addColumn('end_date', 'text')
      .addColumn('created_at', 'text', (c) => c.notNull())
      .addColumn('updated_at', 'text', (c) => c.notNull())
      .execute();
    await db.schema
      .createIndex('projects_workspace_idx')
      .on('projects')
      .columns(['workspace_id', 'name'])
      .execute();
    await db.schema.createIndex('projects_client_idx').on('projects').column('client_id').execute();

    await db.schema
      .createTable('tax_rates')
      .addColumn('id', 'text', (c) => c.primaryKey())
      .addColumn('workspace_id', 'text', (c) =>
        c.notNull().references('workspaces.id').onDelete('cascade'),
      )
      .addColumn('name', 'text', (c) => c.notNull())
      .addColumn('rate_bp', 'integer', (c) => c.notNull())
      .addColumn('is_default', 'integer', (c) => c.notNull().defaultTo(0))
      .addColumn('archived', 'integer', (c) => c.notNull().defaultTo(0))
      .execute();
    await db.schema
      .createIndex('tax_rates_workspace_idx')
      .on('tax_rates')
      .column('workspace_id')
      .execute();

    await db.schema
      .createTable('accounts')
      .addColumn('id', 'text', (c) => c.primaryKey())
      .addColumn('workspace_id', 'text', (c) =>
        c.notNull().references('workspaces.id').onDelete('cascade'),
      )
      .addColumn('code', 'text', (c) => c.notNull())
      .addColumn('name', 'text', (c) => c.notNull())
      .addColumn('type', 'text', (c) => c.notNull())
      .addColumn('parent_id', 'text', (c) => c.references('accounts.id'))
      .addColumn('is_system', 'integer', (c) => c.notNull().defaultTo(0))
      .addColumn('system_key', 'text')
      .addColumn('archived', 'integer', (c) => c.notNull().defaultTo(0))
      .addColumn('description', 'text', (c) => c.notNull().defaultTo(''))
      .addColumn('created_at', 'text', (c) => c.notNull())
      .addUniqueConstraint('accounts_workspace_code_uq', ['workspace_id', 'code'])
      .execute();
    await db.schema
      .createIndex('accounts_workspace_idx')
      .on('accounts')
      .column('workspace_id')
      .execute();

    await db.schema
      .createTable('invoices')
      .addColumn('id', 'text', (c) => c.primaryKey())
      .addColumn('workspace_id', 'text', (c) =>
        c.notNull().references('workspaces.id').onDelete('cascade'),
      )
      .addColumn('client_id', 'text', (c) => c.notNull().references('clients.id'))
      .addColumn('project_id', 'text', (c) => c.references('projects.id'))
      .addColumn('number', 'text', (c) => c.notNull())
      .addColumn('status', 'text', (c) => c.notNull().defaultTo('draft'))
      .addColumn('issue_date', 'text', (c) => c.notNull())
      .addColumn('due_date', 'text', (c) => c.notNull())
      .addColumn('currency', 'text', (c) => c.notNull())
      .addColumn('discount_bp', 'integer', (c) => c.notNull().defaultTo(0))
      .addColumn('subtotal_cents', 'integer', (c) => c.notNull().defaultTo(0))
      .addColumn('discount_cents', 'integer', (c) => c.notNull().defaultTo(0))
      .addColumn('tax_cents', 'integer', (c) => c.notNull().defaultTo(0))
      .addColumn('total_cents', 'integer', (c) => c.notNull().defaultTo(0))
      .addColumn('amount_paid_cents', 'integer', (c) => c.notNull().defaultTo(0))
      .addColumn('notes', 'text', (c) => c.notNull().defaultTo(''))
      .addColumn('terms', 'text', (c) => c.notNull().defaultTo(''))
      .addColumn('po_number', 'text', (c) => c.notNull().defaultTo(''))
      .addColumn('sent_at', 'text')
      .addColumn('approved_at', 'text')
      .addColumn('approved_by', 'text')
      .addColumn('voided_at', 'text')
      .addColumn('void_reason', 'text', (c) => c.notNull().defaultTo(''))
      .addColumn('created_by', 'text', (c) => c.notNull().references('users.id'))
      .addColumn('created_at', 'text', (c) => c.notNull())
      .addColumn('updated_at', 'text', (c) => c.notNull())
      .addUniqueConstraint('invoices_workspace_number_uq', ['workspace_id', 'number'])
      .execute();
    await db.schema
      .createIndex('invoices_workspace_idx')
      .on('invoices')
      .columns(['workspace_id', 'issue_date'])
      .execute();
    await db.schema.createIndex('invoices_client_idx').on('invoices').column('client_id').execute();
    await db.schema
      .createIndex('invoices_status_idx')
      .on('invoices')
      .columns(['workspace_id', 'status'])
      .execute();

    await db.schema
      .createTable('invoice_lines')
      .addColumn('id', 'text', (c) => c.primaryKey())
      .addColumn('invoice_id', 'text', (c) =>
        c.notNull().references('invoices.id').onDelete('cascade'),
      )
      .addColumn('position', 'integer', (c) => c.notNull())
      .addColumn('description', 'text', (c) => c.notNull())
      .addColumn('quantity', 'real', (c) => c.notNull())
      .addColumn('unit_price_cents', 'integer', (c) => c.notNull())
      .addColumn('tax_rate_id', 'text', (c) => c.references('tax_rates.id'))
      .addColumn('tax_rate_bp', 'integer', (c) => c.notNull().defaultTo(0))
      .addColumn('account_id', 'text', (c) => c.notNull().references('accounts.id'))
      .addColumn('line_total_cents', 'integer', (c) => c.notNull())
      .addColumn('tax_cents', 'integer', (c) => c.notNull())
      .execute();
    await db.schema
      .createIndex('invoice_lines_invoice_idx')
      .on('invoice_lines')
      .column('invoice_id')
      .execute();

    await db.schema
      .createTable('time_entries')
      .addColumn('id', 'text', (c) => c.primaryKey())
      .addColumn('workspace_id', 'text', (c) =>
        c.notNull().references('workspaces.id').onDelete('cascade'),
      )
      .addColumn('project_id', 'text', (c) => c.notNull().references('projects.id'))
      .addColumn('user_id', 'text', (c) => c.notNull().references('users.id'))
      .addColumn('date', 'text', (c) => c.notNull())
      .addColumn('minutes', 'integer', (c) => c.notNull())
      .addColumn('description', 'text', (c) => c.notNull().defaultTo(''))
      .addColumn('billable', 'integer', (c) => c.notNull().defaultTo(1))
      .addColumn('invoice_line_id', 'text', (c) =>
        c.references('invoice_lines.id').onDelete('set null'),
      )
      .addColumn('created_at', 'text', (c) => c.notNull())
      .addColumn('updated_at', 'text', (c) => c.notNull())
      .execute();
    await db.schema
      .createIndex('time_entries_workspace_idx')
      .on('time_entries')
      .columns(['workspace_id', 'date'])
      .execute();
    await db.schema
      .createIndex('time_entries_project_idx')
      .on('time_entries')
      .column('project_id')
      .execute();
    await db.schema
      .createIndex('time_entries_user_idx')
      .on('time_entries')
      .column('user_id')
      .execute();
    await db.schema
      .createIndex('time_entries_line_idx')
      .on('time_entries')
      .column('invoice_line_id')
      .execute();

    await db.schema
      .createTable('journal_entries')
      .addColumn('id', 'text', (c) => c.primaryKey())
      .addColumn('workspace_id', 'text', (c) =>
        c.notNull().references('workspaces.id').onDelete('cascade'),
      )
      .addColumn('entry_number', 'integer', (c) => c.notNull())
      .addColumn('date', 'text', (c) => c.notNull())
      .addColumn('memo', 'text', (c) => c.notNull())
      .addColumn('source_type', 'text', (c) => c.notNull())
      .addColumn('source_id', 'text')
      .addColumn('reversed_entry_id', 'text', (c) => c.references('journal_entries.id'))
      .addColumn('posted_by', 'text', (c) => c.notNull().references('users.id'))
      .addColumn('created_at', 'text', (c) => c.notNull())
      .addUniqueConstraint('journal_entries_workspace_number_uq', ['workspace_id', 'entry_number'])
      .execute();
    await db.schema
      .createIndex('journal_entries_workspace_date_idx')
      .on('journal_entries')
      .columns(['workspace_id', 'date'])
      .execute();
    await db.schema
      .createIndex('journal_entries_source_idx')
      .on('journal_entries')
      .columns(['source_type', 'source_id'])
      .execute();

    await db.schema
      .createTable('journal_lines')
      .addColumn('id', 'text', (c) => c.primaryKey())
      .addColumn('entry_id', 'text', (c) =>
        c.notNull().references('journal_entries.id').onDelete('cascade'),
      )
      .addColumn('position', 'integer', (c) => c.notNull())
      .addColumn('account_id', 'text', (c) => c.notNull().references('accounts.id'))
      .addColumn('debit_cents', 'integer', (c) => c.notNull().defaultTo(0))
      .addColumn('credit_cents', 'integer', (c) => c.notNull().defaultTo(0))
      .addColumn('description', 'text', (c) => c.notNull().defaultTo(''))
      .execute();
    await db.schema
      .createIndex('journal_lines_entry_idx')
      .on('journal_lines')
      .column('entry_id')
      .execute();
    await db.schema
      .createIndex('journal_lines_account_idx')
      .on('journal_lines')
      .column('account_id')
      .execute();

    await db.schema
      .createTable('payments')
      .addColumn('id', 'text', (c) => c.primaryKey())
      .addColumn('workspace_id', 'text', (c) =>
        c.notNull().references('workspaces.id').onDelete('cascade'),
      )
      .addColumn('invoice_id', 'text', (c) =>
        c.notNull().references('invoices.id').onDelete('cascade'),
      )
      .addColumn('date', 'text', (c) => c.notNull())
      .addColumn('amount_cents', 'integer', (c) => c.notNull())
      .addColumn('method', 'text', (c) => c.notNull())
      .addColumn('reference', 'text', (c) => c.notNull().defaultTo(''))
      .addColumn('note', 'text', (c) => c.notNull().defaultTo(''))
      .addColumn('journal_entry_id', 'text', (c) => c.references('journal_entries.id'))
      .addColumn('created_by', 'text', (c) => c.notNull().references('users.id'))
      .addColumn('created_at', 'text', (c) => c.notNull())
      .execute();
    await db.schema
      .createIndex('payments_workspace_idx')
      .on('payments')
      .columns(['workspace_id', 'date'])
      .execute();
    await db.schema
      .createIndex('payments_invoice_idx')
      .on('payments')
      .column('invoice_id')
      .execute();

    await db.schema
      .createTable('expenses')
      .addColumn('id', 'text', (c) => c.primaryKey())
      .addColumn('workspace_id', 'text', (c) =>
        c.notNull().references('workspaces.id').onDelete('cascade'),
      )
      .addColumn('vendor', 'text', (c) => c.notNull())
      .addColumn('description', 'text', (c) => c.notNull())
      .addColumn('date', 'text', (c) => c.notNull())
      .addColumn('due_date', 'text')
      .addColumn('account_id', 'text', (c) => c.notNull().references('accounts.id'))
      .addColumn('amount_cents', 'integer', (c) => c.notNull())
      .addColumn('tax_rate_id', 'text', (c) => c.references('tax_rates.id'))
      .addColumn('tax_rate_bp', 'integer', (c) => c.notNull().defaultTo(0))
      .addColumn('tax_cents', 'integer', (c) => c.notNull().defaultTo(0))
      .addColumn('total_cents', 'integer', (c) => c.notNull())
      .addColumn('status', 'text', (c) => c.notNull().defaultTo('draft'))
      .addColumn('client_id', 'text', (c) => c.references('clients.id'))
      .addColumn('project_id', 'text', (c) => c.references('projects.id'))
      .addColumn('billable', 'integer', (c) => c.notNull().defaultTo(0))
      .addColumn('paid_at', 'text')
      .addColumn('payment_method', 'text')
      .addColumn('reference', 'text', (c) => c.notNull().defaultTo(''))
      .addColumn('notes', 'text', (c) => c.notNull().defaultTo(''))
      .addColumn('created_by', 'text', (c) => c.notNull().references('users.id'))
      .addColumn('created_at', 'text', (c) => c.notNull())
      .addColumn('updated_at', 'text', (c) => c.notNull())
      .execute();
    await db.schema
      .createIndex('expenses_workspace_idx')
      .on('expenses')
      .columns(['workspace_id', 'date'])
      .execute();
    await db.schema
      .createIndex('expenses_status_idx')
      .on('expenses')
      .columns(['workspace_id', 'status'])
      .execute();

    await db.schema
      .createTable('approvals')
      .addColumn('id', 'text', (c) => c.primaryKey())
      .addColumn('workspace_id', 'text', (c) =>
        c.notNull().references('workspaces.id').onDelete('cascade'),
      )
      .addColumn('subject_type', 'text', (c) => c.notNull())
      .addColumn('subject_id', 'text', (c) => c.notNull())
      .addColumn('requested_by', 'text', (c) => c.notNull().references('users.id'))
      .addColumn('status', 'text', (c) => c.notNull().defaultTo('pending'))
      .addColumn('decided_by', 'text', (c) => c.references('users.id'))
      .addColumn('comment', 'text', (c) => c.notNull().defaultTo(''))
      .addColumn('created_at', 'text', (c) => c.notNull())
      .addColumn('decided_at', 'text')
      .execute();
    await db.schema
      .createIndex('approvals_workspace_idx')
      .on('approvals')
      .columns(['workspace_id', 'status'])
      .execute();
    await db.schema
      .createIndex('approvals_subject_idx')
      .on('approvals')
      .columns(['subject_type', 'subject_id'])
      .execute();

    await db.schema
      .createTable('notifications')
      .addColumn('id', 'text', (c) => c.primaryKey())
      .addColumn('workspace_id', 'text', (c) =>
        c.notNull().references('workspaces.id').onDelete('cascade'),
      )
      .addColumn('user_id', 'text', (c) => c.notNull().references('users.id').onDelete('cascade'))
      .addColumn('kind', 'text', (c) => c.notNull())
      .addColumn('title', 'text', (c) => c.notNull())
      .addColumn('body', 'text', (c) => c.notNull().defaultTo(''))
      .addColumn('link', 'text', (c) => c.notNull().defaultTo(''))
      .addColumn('read_at', 'text')
      .addColumn('created_at', 'text', (c) => c.notNull())
      .execute();
    await db.schema
      .createIndex('notifications_user_idx')
      .on('notifications')
      .columns(['workspace_id', 'user_id', 'read_at'])
      .execute();

    await db.schema
      .createTable('activity_log')
      .addColumn('id', 'text', (c) => c.primaryKey())
      .addColumn('workspace_id', 'text', (c) =>
        c.notNull().references('workspaces.id').onDelete('cascade'),
      )
      .addColumn('actor_id', 'text', (c) => c.notNull().references('users.id'))
      .addColumn('entity_type', 'text', (c) => c.notNull())
      .addColumn('entity_id', 'text', (c) => c.notNull())
      .addColumn('action', 'text', (c) => c.notNull())
      .addColumn('summary', 'text', (c) => c.notNull())
      .addColumn('meta', 'text', (c) => c.notNull().defaultTo('{}'))
      .addColumn('created_at', 'text', (c) => c.notNull())
      .execute();
    await db.schema
      .createIndex('activity_workspace_idx')
      .on('activity_log')
      .columns(['workspace_id', 'created_at'])
      .execute();
    await db.schema
      .createIndex('activity_entity_idx')
      .on('activity_log')
      .columns(['entity_type', 'entity_id'])
      .execute();
  },

  async down(db: Kysely<unknown>): Promise<void> {
    for (const table of [
      'activity_log',
      'notifications',
      'approvals',
      'expenses',
      'payments',
      'journal_lines',
      'journal_entries',
      'time_entries',
      'invoice_lines',
      'invoices',
      'accounts',
      'tax_rates',
      'projects',
      'clients',
      'invites',
      'memberships',
      'workspaces',
      'sessions',
      'users',
    ]) {
      await sql`drop table if exists ${sql.table(table)}`.execute(db);
    }
  },
};
