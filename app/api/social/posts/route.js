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
    .select('ig_media_id, media_type, caption, thumbnail_url, permalink, published_at, reach, likes, comments, shares, featured, is_optimization')
    .eq('page_id', page_id)
    .gte('published_at', start)
    .lte('published_at', end + 'T23:59:59')
    .order('reach', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ posts: data })
}

// PATCH { ig_media_id, featured?, is_optimization? } — toggle a post's
// classification for the report's curated thumbnail grids. `featured`
// controls inclusion in "Social Media Content" (falls back to every
// post if none are flagged). `is_optimization` moves a post into "Social
// Media Optimization" instead — set this for posts that had paid/boosted
// distribution. Both are manual; see the is_optimization column comment
// in the migration for why this isn't auto-detected.
export async function PATCH(request) {
  const { ig_media_id, featured, is_optimization } = await request.json()
  if (!ig_media_id) return Response.json({ error: 'ig_media_id required' }, { status: 400 })

  const update = {}
  if (featured !== undefined) update.featured = !!featured
  if (is_optimization !== undefined) update.is_optimization = !!is_optimization
  if (Object.keys(update).length === 0) {
    return Response.json({ error: 'nothing to update' }, { status: 400 })
  }

  const db = supabaseAdmin()
  const { error } = await db.from('social_posts').update(update).eq('ig_media_id', ig_media_id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
