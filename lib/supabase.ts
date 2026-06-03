// Acesso ao Supabase via REST (PostgREST) com a chave service_role.
// SOMENTE servidor — nunca importar em componentes do cliente.
// Sem SDK: usa fetch puro pra manter o projeto leve.

const URL = process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export function supabaseConfigured() {
  return Boolean(URL && KEY)
}

function headers(extra: Record<string, string> = {}) {
  return {
    apikey: KEY as string,
    Authorization: `Bearer ${KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  }
}

/** Insere ou atualiza (upsert por id) uma linha em uma tabela. */
export async function sbUpsert(table: string, row: Record<string, unknown>) {
  if (!supabaseConfigured()) return
  await fetch(`${URL}/rest/v1/${table}?on_conflict=id`, {
    method: 'POST',
    headers: headers({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify(row),
  })
}

/** Insere uma linha. */
export async function sbInsert(table: string, row: Record<string, unknown>) {
  if (!supabaseConfigured()) return
  await fetch(`${URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: headers({ Prefer: 'return=minimal' }),
    body: JSON.stringify(row),
  })
}

/** Consulta linhas (querystring no padrão PostgREST). */
export async function sbSelect<T = unknown>(table: string, query = ''): Promise<T[]> {
  if (!supabaseConfigured()) return []
  const res = await fetch(`${URL}/rest/v1/${table}${query ? `?${query}` : ''}`, {
    method: 'GET',
    headers: headers(),
    cache: 'no-store',
  })
  if (!res.ok) return []
  return (await res.json()) as T[]
}
