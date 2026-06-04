// Acesso ao Supabase via REST (PostgREST) com a chave service_role.
// SOMENTE servidor — nunca importar em componentes do cliente.
// Sem SDK: usa fetch puro pra manter o projeto leve.

// Higieniza valores de env: remove TODO espaço em branco (inclui \n e \r que
// vazam ao colar a chave no painel). JWT/base64 e a URL não têm espaços, então
// é seguro — e evita "TypeError: Headers.append: invalid header value".
const URL = (process.env.SUPABASE_URL || '').replace(/\s/g, '')
const KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\s/g, '')

export function supabaseConfigured() {
  return Boolean(URL && KEY)
}

function headers(extra: Record<string, string> = {}) {
  return {
    apikey: KEY,
    Authorization: `Bearer ${KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  }
}

// Base REST normalizada (tolera SUPABASE_URL com / no fim ou sem protocolo).
function restUrl(table: string, query = '') {
  let base = (URL || '').trim().replace(/\/+$/, '')
  if (base && !/^https?:\/\//i.test(base)) base = `https://${base}`
  return `${base}/rest/v1/${table}${query ? `?${query}` : ''}`
}

/** Insere ou atualiza (upsert por id) uma linha em uma tabela. Nunca lança. */
export async function sbUpsert(table: string, row: Record<string, unknown>) {
  if (!supabaseConfigured()) return
  try {
    await fetch(restUrl(table, 'on_conflict=id'), {
      method: 'POST',
      headers: headers({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify(row),
    })
  } catch (e) {
    console.error('[supabase] sbUpsert falhou:', e)
  }
}

/** Insere uma linha. Nunca lança. */
export async function sbInsert(table: string, row: Record<string, unknown>) {
  if (!supabaseConfigured()) return
  try {
    await fetch(restUrl(table), {
      method: 'POST',
      headers: headers({ Prefer: 'return=minimal' }),
      body: JSON.stringify(row),
    })
  } catch (e) {
    console.error('[supabase] sbInsert falhou:', e)
  }
}

/** Consulta linhas (querystring no padrão PostgREST). Nunca lança — retorna [] em falha. */
export async function sbSelect<T = unknown>(table: string, query = ''): Promise<T[]> {
  if (!supabaseConfigured()) return []
  try {
    const res = await fetch(restUrl(table, query), {
      method: 'GET',
      headers: headers(),
      cache: 'no-store',
    })
    if (!res.ok) {
      console.error(`[supabase] sbSelect ${table} HTTP ${res.status}:`, await res.text().catch(() => ''))
      return []
    }
    return (await res.json()) as T[]
  } catch (e) {
    console.error('[supabase] sbSelect falhou:', e)
    return []
  }
}
