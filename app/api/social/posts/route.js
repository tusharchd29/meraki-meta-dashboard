import { supabaseAdmin } from '@/lib/supabaseAdmin'

// GET /api/social/posts?page_id=...&start=...&end=...
// Lists fetched posts for a window, ordered by reach — for a curation UI
// to pick which ones become the "Social Media Content"/"Story Content"
// thumbnail grids in the exported report.
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const page_id = searchParams.get('page_id')
  const start = searchParams.get('start')
  const end = searchParams.get('end')
  if (!page_id || !start || !end) {
    return Response.json({ error: 'page_id, start, end required' }, { status: 400 })
  }

  const db = supabaseAdmin()
  const { data, error } = await db
    .from('social_posts')
    .select('ig_media_id, media_type, caption, thumbnail_url, permalink, published_at, reach, likes, comments, shares, featured')
    .eq('page_id', page_id)
    .gte('published_at', start)
    .lte('published_at', end + 'T23:59:59')
    .order('reach', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ posts: data })
}

// PATCH { ig_media_id, featured } — toggle a post's inclusion in the
// report's curated thumbnail grids. If no posts are flagged for a given
// window, the report falls back to top-by-reach automatically (see
// generateSocialReportPdf in lib/socialReportPdf.js) — this is purely for
// overriding that default with a manual pick.
export async function PATCH(request) {
  const { ig_media_id, featured } = await request.json()
  if (!ig_media_id) return Response.json({ error: 'ig_media_id required' }, { status: 400 })

  const db = supabaseAdmin()
  const { error } = await db.from('social_posts').update({ featured: !!featured }).eq('ig_media_id', ig_media_id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
