/**
 * A Kysely dialect for Node's built-in `node:sqlite` module.
 *
 * `DatabaseSync` is synchronous and single-connection, so the driver hands out one logical
 * connection guarded by a mutex: a transaction holds the connection until it commits or rolls
 * back, and every other query waits. That keeps interleaved async work (two requests both
 * bumping the invoice counter, for instance) strictly serialised.
 */
import { DatabaseSync, type StatementSync } from 'node:sqlite';
import {
  CompiledQuery,
  SqliteAdapter,
  SqliteIntrospector,
  SqliteQueryCompiler,
  type DatabaseConnection,
  type DatabaseIntrospector,
  type Dialect,
  type DialectAdapter,
  type Driver,
  type Kysely,
  type QueryCompiler,
  type QueryResult,
} from 'kysely';

export interface NodeSqliteDialectConfig {
  /** File path or `:memory:`. */
  path: string;
  /** Called once after the database is opened; used for pragmas. */
  onOpen?: (db: DatabaseSync) => void;
}

type SqliteParam = null | number | bigint | string | Uint8Array;

/** SQLite cannot bind booleans or `undefined`; normalise them the way the app stores them. */
function toSqliteParam(value: unknown): SqliteParam {
  if (value === undefined || value === null) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'string')
    return value;
  if (value instanceof Uint8Array) return value;
  if (value instanceof Date) return value.toISOString();
  return JSON.stringify(value);
}

class ConnectionMutex {
  private waiting: Promise<void> | null = null;
  private release: (() => void) | null = null;

  async lock(): Promise<void> {
    while (this.waiting) await this.waiting;
    this.waiting = new Promise<void>((resolve) => {
      this.release = resolve;
    });
  }

  unlock(): void {
    const release = this.release;
    this.waiting = null;
    this.release = null;
    release?.();
  }
}

class NodeSqliteConnection implements DatabaseConnection {
  private readonly statements = new Map<string, StatementSync>();

  constructor(private readonly db: DatabaseSync) {}

  private prepare(sql: string): StatementSync {
    let stmt = this.statements.get(sql);
    if (!stmt) {
      if (this.statements.size > 500) this.statements.clear();
      stmt = this.db.prepare(sql);
      this.statements.set(sql, stmt);
    }
    return stmt;
  }

  async executeQuery<R>(compiled: CompiledQuery): Promise<QueryResult<R>> {
    const stmt = this.prepare(compiled.sql);
    const params = compiled.parameters.map(toSqliteParam);
    if (stmt.columns().length > 0) {
      const rows = stmt.all(...params) as R[];
      return { rows };
    }
    const info = stmt.run(...params);
    return {
      rows: [],
      numAffectedRows: BigInt(info.changes),
      insertId: BigInt(info.lastInsertRowid),
    };
  }

  async *streamQuery<R>(compiled: CompiledQuery): AsyncIterableIterator<QueryResult<R>> {
    const stmt = this.prepare(compiled.sql);
    const params = compiled.parameters.map(toSqliteParam);
    for (const row of stmt.iterate(...params)) {
      yield { rows: [row as R] };
    }
  }

  close(): void {
    this.statements.clear();
    this.db.close();
  }
}

class NodeSqliteDriver implements Driver {
  private connection: NodeSqliteConnection | null = null;
  private readonly mutex = new ConnectionMutex();

  constructor(private readonly config: NodeSqliteDialectConfig) {}

  async init(): Promise<void> {
    const db = new DatabaseSync(this.config.path);
    this.config.onOpen?.(db);
    this.connection = new NodeSqliteConnection(db);
  }

  async acquireConnection(): Promise<DatabaseConnection> {
    await this.mutex.lock();
    if (!this.connection) throw new Error('node:sqlite driver has not been initialised');
    return this.connection;
  }

  async beginTransaction(connection: DatabaseConnection): Promise<void> {
    await connection.executeQuery(CompiledQuery.raw('begin immediate'));
  }

  async commitTransaction(connection: DatabaseConnection): Promise<void> {
    await connection.executeQuery(CompiledQuery.raw('commit'));
  }

  async rollbackTransaction(connection: DatabaseConnection): Promise<void> {
    await connection.executeQuery(CompiledQuery.raw('rollback'));
  }

  async savepoint(connection: DatabaseConnection, name: string): Promise<void> {
    await connection.executeQuery(CompiledQuery.raw(`savepoint "${name}"`));
  }

  async rollbackToSavepoint(connection: DatabaseConnection, name: string): Promise<void> {
    await connection.executeQuery(CompiledQuery.raw(`rollback to "${name}"`));
  }

  async releaseSavepoint(connection: DatabaseConnection, name: string): Promise<void> {
    await connection.executeQuery(CompiledQuery.raw(`release "${name}"`));
  }

  async releaseConnection(): Promise<void> {
    this.mutex.unlock();
  }

  async destroy(): Promise<void> {
    this.connection?.close();
    this.connection = null;
  }
}

export class NodeSqliteDialect implements Dialect {
  constructor(private readonly config: NodeSqliteDialectConfig) {}

  createDriver(): Driver {
    return new NodeSqliteDriver(this.config);
  }

  createQueryCompiler(): QueryCompiler {
    return new SqliteQueryCompiler();
  }

  createAdapter(): DialectAdapter {
    return new SqliteAdapter();
  }

  createIntrospector(db: Kysely<unknown>): DatabaseIntrospector {
    return new SqliteIntrospector(db);
  }
}
