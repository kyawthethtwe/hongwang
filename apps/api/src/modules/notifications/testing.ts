/**
 * Test helper (not a spec): a stand-in for the Drizzle db. Each `db.select/insert/update/delete(...)`
 * starts a chain that records every call (`.from`, `.where`, `.values`, `.set` ...) and, when
 * awaited, resolves to the next queued result (or rejects if that result is an Error).
 *
 *   const fake = fakeDb([[{ id: 'log-1', status: 'queued' }]]);
 *   new EmailLogRepository(fake.db as never);
 *   expect(fake.chains[0]).toMatchObject([{ op: 'select' }, { op: 'from' }, ...]);
 */
export interface ChainCall {
  op: string;
  args: unknown[];
}

export function fakeDb(results: unknown[] = []) {
  const chains: ChainCall[][] = [];
  const queue = [...results];

  const start =
    (op: string) =>
    (...args: unknown[]) => {
      const chain: ChainCall[] = [{ op, args }];
      chains.push(chain);
      let settled: Promise<unknown> | undefined;
      const settle = () => {
        settled ??= (() => {
          const next = queue.length ? queue.shift() : [];
          return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
        })();
        return settled;
      };
      const proxy: unknown = new Proxy(
        {},
        {
          get(_target, prop) {
            if (prop === 'then') {
              return (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
                settle().then(onFulfilled, onRejected);
            }
            if (prop === 'catch') return (onRejected?: (e: unknown) => unknown) => settle().catch(onRejected);
            return (...callArgs: unknown[]) => {
              chain.push({ op: String(prop), args: callArgs });
              return proxy;
            };
          },
        },
      );
      return proxy;
    };

  const db = { select: start('select'), insert: start('insert'), update: start('update'), delete: start('delete') };
  /** The args of the first `op` call in chain `i`, e.g. call(1, 'values'). */
  const call = (i: number, op: string) => chains[i]?.find((c) => c.op === op)?.args;
  return { db, chains, call };
}
