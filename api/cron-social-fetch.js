import { supabaseAdmin } from '../lib/supabaseAdmin.js'
import { fetchFullReportData } from '../lib/socialInsights.js'

// Same convention as the other root-level /api/cron-*.js jobs (plain
// (req, res) handler, CRON_SECRET bearer check) — not the App Router
// app/api/.../route.js style used by the interactive endpoints.
//
// Snapshots the PREVIOUS full calendar month for every active connected
// social_pages row, so a monthly report is always ready the moment the
// month closes. Mirrors cron-monthly-report.js's "resolve last month in
// IST" pattern.
function lastMonthBounds() {
  const now = new Date()
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000)
  const start = new Date(ist.getFullYear(), ist.getMonth() - 1, 1)
  const end = new Date(ist.getFullYear(), ist.getMonth(), 0)
  const iso = (d) => d.toISOString().split('T')[0]
  return { start: iso(start), end: iso(end) }
}

export default async function handler(req, res) {
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const db = supabaseAdmin()
  const { data: pages, error } = await db.from('social_pages').select('*').eq('is_active', true)
  if (error) return res.status(500).json({ error: error.message })

  const { start, end } = lastMonthBounds()
  const results = []

  for (const page of pages || []) {
    try {
      const { fb, ig, posts } = await fetchFullReportData(page, start, end)

      await db.from('social_insight_snapshots').upsert(
        {
          page_id: page.page_id,
          period_start: start,
          period_end: end,
          ig_views: ig?.ig_views ?? null,
          ig_reach: ig?.ig_reach ?? null,
          ig_reach_from_followers: ig?.ig_reach_from_followers ?? null,
          ig_reach_from_non_followers: ig?.ig_reach_from_non_followers ?? null,
          ig_follows: ig?.ig_follows ?? null,
          ig_content_interactions: ig?.ig_content_interactions ?? null,
          fb_views: fb?.fb_views ?? null,
          fb_follows: fb?.fb_follows ?? null,
          fb_content_interactions: fb?.fb_content_interactions ?? null,
          raw: { fb: fb?.raw, ig: ig?.raw },
          fetched_at: new Date().toISOString(),
        },
        { onConflict: 'page_id,period_start,period_end' }
      )

      if (posts?.length) {
        const rows = posts.map((p) => ({
          page_id: page.page_id,
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
        await db.from('social_posts').upsert(rows, { onConflict: 'page_id,ig_media_id' })
      }

      await db.from('social_pages').update({ synced_at: new Date().toISOString() }).eq('page_id', page.page_id)
      results.push({ page_id: page.page_id, ok: true, posts: posts?.length || 0 })
    } catch (e) {
      results.push({ page_id: page.page_id, ok: false, error: e.message })
    }
  }

  return res.status(200).json({ period: { start, end }, results })
}
