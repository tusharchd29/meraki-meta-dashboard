import { supabaseAdmin } from '../lib/supabaseAdmin.js'
import { fetchIgActiveStories } from '../lib/socialInsights.js'

// Runs daily (Hobby-plan-safe schedule — see vercel.json). Stories only
// exist in Meta's API for ~24h after posting, so this is the only way a
// monthly report can include any story content at all: catch each story
// while it's still live and upsert it into social_posts, tagged
// media_type='STORY'. If this cron hasn't been running, there is no way
// to retroactively recover a month's stories once Meta expires them.

export default async function handler(req, res) {
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const db = supabaseAdmin()
  const { data: pages, error } = await db
    .from('social_pages')
    .select('page_id, page_access_token, ig_user_id')
    .eq('is_active', true)
    .not('ig_user_id', 'is', null)
  if (error) return res.status(500).json({ error: error.message })

  const results = []
  for (const page of pages || []) {
    try {
      const stories = await fetchIgActiveStories(page.ig_user_id, page.page_access_token)
      if (stories.length) {
        const rows = stories.map((s) => ({
          page_id: page.page_id,
          ig_media_id: s.ig_media_id,
          media_type: s.media_type,
          caption: s.caption,
          permalink: s.permalink,
          thumbnail_url: s.thumbnail_url,
          published_at: s.published_at,
          reach: s.reach,
          likes: s.likes,
          comments: s.comments,
          shares: s.shares,
          saves: s.saves,
          plays: s.plays,
          raw: s.raw,
          fetched_at: new Date().toISOString(),
        }))
        await db.from('social_posts').upsert(rows, { onConflict: 'page_id,ig_media_id' })
      }
      results.push({ page_id: page.page_id, ok: true, stories_captured: stories.length })
    } catch (e) {
      results.push({ page_id: page.page_id, ok: false, error: e.message })
    }
  }

  return res.status(200).json({ results })
}
