/**
 * A tiny stand-in for the Drizzle database in unit tests. Every chain
 * (`db.select().from(t).where(...)`, `tx.update(t).set(v).where(...).returning()`, `db.execute(sql)`,
 * `db.query.bookings.findFirst(...)`) resolves, when awaited, to the next value in `results`
 * (default `[]`). `throwing(err)` makes that await reject. `db.transaction(cb)` runs `cb(db)`.
 *
 *   const db = createMockDb([[listingRow], [], throwing(pgError('23P01'))]);
 *   ...
 *   expect(db.ops('update')[0]).toMatchObject({ set: { status: 'cancelled' } });
 */

export interface Op {
  name: string;
  args: unknown[];
}

export interface Query {
  ops: Op[];
  /** First op of the chain: 'select', 'update', 'insert', 'execute', 'query' ... */
  kind: string;
  /** Convenience: arguments of common chain steps. */
  set?: unknown;
  values?: unknown;
}

const THROW = Symbol('throw');
export const throwing = (err: unknown) => ({ [THROW]: err });

export interface MockDb {
  db: any;
  /** Every awaited chain, in order. */
  queries: Query[];
  /** Queries whose first op is `kind`. */
  ops(kind: string): Query[];
  /** Results still queued (to assert the test consumed what it set up). */
  remaining(): number;
  /** How many times db.transaction was called. */
  transactions(): number;
}

export function createMockDb(results: unknown[] = []): MockDb {
  const queue = [...results];
  const queries: Query[] = [];
  let txCount = 0;

  const record = (ops: Op[]) => {
    const q: Query = { ops, kind: ops[0]?.name ?? '' };
    const set = ops.find((o) => o.name === 'set');
    const values = ops.find((o) => o.name === 'values');
    if (set) q.set = set.args[0];
    if (values) q.values = values.args[0];
    queries.push(q);
  };

  const node = (ops: Op[]): any =>
    new Proxy(function () {}, {
      get(_t, prop) {
        if (typeof prop === 'symbol') return undefined;
        if (prop === 'then') {
          record(ops);
          const next = queue.length ? queue.shift() : [];
          const p =
            next && typeof next === 'object' && THROW in (next)
              ? Promise.reject((next as Record<typeof THROW, unknown>)[THROW])
              : Promise.resolve(next);
          return p.then.bind(p);
        }
        return node([...ops, { name: prop, args: [] }]);
      },
      apply(_t, _this, args: unknown[]) {
        const last = ops[ops.length - 1]!;
        return node([...ops.slice(0, -1), { name: last.name, args }]);
      },
    });

  const db: any = new Proxy(
    {},
    {
      get(_t, prop) {
        if (typeof prop === 'symbol' || prop === 'then') return undefined;
        if (prop === 'transaction') {
          return async (cb: (tx: unknown) => Promise<unknown>) => {
            txCount++;
            return cb(db);
          };
        }
        return node([{ name: prop, args: [] }]);
      },
    },
  );

  return {
    db,
    queries,
    ops: (kind) => queries.filter((q) => q.kind === kind),
    remaining: () => queue.length,
    transactions: () => txCount,
  };
}

/** An error shaped like node-postgres's, wrapped the way Drizzle wraps it. */
export function pgError(code: string, constraint?: string) {
  const cause = Object.assign(new Error(`pg ${code}`), { code, constraint });
  return Object.assign(new Error('Failed query'), { cause });
}
