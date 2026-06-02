/**
 * Paginate through a Supabase/PostgREST query to fetch ALL rows.
 *
 * PostgREST caps results at ~1 000 rows by default.  Tables that can exceed
 * that limit (e.g. predictions = entries × 104 matches) must be paginated so
 * every row is included.
 */

const PAGE_SIZE = 1000

export async function fetchAllRows<T>(
  buildQuery: () => {
    range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
  },
): Promise<T[]> {
  const all: T[] = []
  let from = 0
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1)
    if (error) {
      throw new Error(`Supabase pagination error at offset ${from}: ${JSON.stringify(error)}`)
    }
    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return all
}
