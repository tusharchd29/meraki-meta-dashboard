import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { fetchIgActiveStories } from '@/lib/socialInsights'

// App Router route — see cron-social-fetch/route.js for why (function-count
// limit on root-level /api/*.js functions).
//
// Runs daily. Stories only exist in Meta's API for ~24h after posting, so
// this is the only way a monthly report can include any story content at
// all: catch each story while it's still live and upsert it into
// social_posts, tagged media_type='STORY'. If this cron hasn't been
// running, there is no way to retroactively recover a month's stories
// once Meta expires them.

export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const db = supabaseAdmin()
  const { data: pages, error } = await db
    .from('social_pages')
    .select('page_id, page_access_token, ig_user_id')
    .eq('is_active', true)
    .not('ig_user_id', 'is', null)
  if (error) return Response.json({ error: error.message }, { status: 500 })

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

  return Response.json({ results })
}
