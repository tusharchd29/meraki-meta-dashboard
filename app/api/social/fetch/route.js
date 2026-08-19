import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { fetchFullReportData } from '@/lib/socialInsights'

// POST { page_id, period_start, period_end }
// Pulls live data from Meta and snapshots it — call this before generating
// a report for a new window; the report route itself only reads snapshots,
// it never calls Meta directly, so re-rendering a report is instant and
// doesn't re-spend API quota.
export async function POST(request) {
  const { page_id, period_start, period_end } = await request.json()
  if (!page_id || !period_start || !period_end) {
    return Response.json({ error: 'page_id, period_start, period_end required' }, { status: 400 })
  }

  const db = supabaseAdmin()
  const { data: page, error: pageErr } = await db
    .from('social_pages')
    .select('*')
    .eq('page_id', page_id)
    .single()

  if (pageErr || !page) return Response.json({ error: 'page_not_found' }, { status: 404 })

  try {
    const { fb, ig, posts } = await fetchFullReportData(page, period_start, period_end)

    const { error: snapErr } = await db.from('social_insight_snapshots').upsert(
      {
        page_id,
        period_start,
        period_end,
        ig_views: ig?.ig_views ?? null,
        ig_reach: ig?.ig_reach ?? null,
        ig_reach_from_followers: ig?.ig_reach_from_followers ?? null,
        ig_reach_from_non_followers: ig?.ig_reach_from_non_followers ?? null,
        ig_follows: ig?.ig_follows ?? null,
        ig_content_interactions: ig?.ig_content_interactions ?? null,
        ig_interactions_from_followers: ig?.ig_interactions_from_followers ?? null,
        ig_interactions_from_non_followers: ig?.ig_interactions_from_non_followers ?? null,
        fb_views: fb?.fb_views ?? null,
        fb_follows: fb?.fb_follows ?? null,
        fb_content_interactions: fb?.fb_content_interactions ?? null,
        raw: { fb: fb?.raw, ig: ig?.raw },
        fetched_at: new Date().toISOString(),
      },
      { onConflict: 'page_id,period_start,period_end' }
    )
    if (snapErr) return Response.json({ error: `snapshot_error: ${snapErr.message}` }, { status: 500 })

    if (posts?.length) {
      const rows = posts.map((p) => ({
        page_id,
        ig_media_id: p.ig_media_id,
        media_type: p.media_type,
        caption: p.caption,
        permalink: p.permalink,
        thumbnail_url: p.thumbnail_url,
        published_at: p.published_at,
        reach: p.reach,
        likes: p.likes,
        comments: p.comments,
        shares: p.shares,
        saves: p.saves,
        plays: p.plays,
        raw: p.raw,
        fetched_at: new Date().toISOString(),
      }))
      const { error: postErr } = await db.from('social_posts').upsert(rows, { onConflict: 'page_id,ig_media_id' })
      if (postErr) return Response.json({ error: `posts_error: ${postErr.message}` }, { status: 500 })
    }

    await db.from('social_pages').update({ synced_at: new Date().toISOString() }).eq('page_id', page_id)

    return Response.json({ ok: true, posts_fetched: posts?.length || 0 })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
