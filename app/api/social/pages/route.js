import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET() {
  const db = supabaseAdmin()
  const { data, error } = await db
    .from('social_pages')
    .select('page_id, page_name, ig_username, ig_profile_picture_url, client_name, is_active, synced_at')
    .order('page_name', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ pages: data })
}

// Set which client a Page belongs to (used in the report header) and
// active/inactive status. Body: { page_id, client_name?, is_active? }
export async function PATCH(request) {
  const body = await request.json()
  if (!body.page_id) return Response.json({ error: 'page_id required' }, { status: 400 })

  const db = supabaseAdmin()
  const update = {}
  if (body.client_name !== undefined) update.client_name = body.client_name
  if (body.is_active !== undefined) update.is_active = body.is_active

  const { error } = await db.from('social_pages').update(update).eq('page_id', body.page_id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
