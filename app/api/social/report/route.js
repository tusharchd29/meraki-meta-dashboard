import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { generateSocialReportPdfBuffer } from '@/lib/socialReportPdf'

// GET /api/social/report?page_id=...&start=YYYY-MM-DD&end=YYYY-MM-DD
// Reads the already-fetched snapshot + posts for that window and streams
// back a PDF matching the Pratha report structure. Call /api/social/fetch
// first if the snapshot for this window doesn't exist yet.
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const page_id = searchParams.get('page_id')
  const start = searchParams.get('start')
  const end = searchParams.get('end')

  if (!page_id || !start || !end) {
    return Response.json({ error: 'page_id, start, end required' }, { status: 400 })
  }

  const db = supabaseAdmin()

  const { data: page, error: pageErr } = await db
    .from('social_pages')
    .select('page_id, page_name, client_name, ig_username')
    .eq('page_id', page_id)
    .single()
  if (pageErr || !page) return Response.json({ error: 'page_not_found' }, { status: 404 })

  const { data: snapshot } = await db
    .from('social_insight_snapshots')
    .select('*')
    .eq('page_id', page_id)
    .eq('period_start', start)
    .eq('period_end', end)
    .maybeSingle()

  if (!snapshot) {
    return Response.json(
      { error: 'no_snapshot_for_window', hint: 'POST /api/social/fetch for this page_id/start/end first' },
      { status: 404 }
    )
  }

  const { data: posts } = await db
    .from('social_posts')
    .select('*')
    .eq('page_id', page_id)
    .neq('media_type', 'STORY')
    .gte('published_at', start)
    .lte('published_at', end + 'T23:59:59')
    .order('reach', { ascending: false })

  const { data: stories } = await db
    .from('social_posts')
    .select('*')
    .eq('page_id', page_id)
    .eq('media_type', 'STORY')
    .gte('published_at', start)
    .lte('published_at', end + 'T23:59:59')
    .order('published_at', { ascending: true })

  // Manually flagged posts (social_posts.featured = true) win if any exist
  // for this window; otherwise the grid falls back to every non-optimization
  // post fetched — generateSocialReportPdf does that fallback itself when
  // featuredPosts is empty, so only pass it through when curation happened.
  //
  // is_optimization splits posts into two grids: organic ("Social Media
  // Content") vs paid/boosted ("Social Media Optimization"). This is a
  // manual flag your team sets (see the migration comment on that column)
  // — Meta doesn't expose a reliable per-post boost signal without Ads
  // permissions this login deliberately doesn't have.
  const organicPosts = (posts || []).filter((p) => !p.is_optimization)
  const optimizationPosts = (posts || []).filter((p) => p.is_optimization)
  const featuredPosts = organicPosts.filter((p) => p.featured)

  // Thumbnail URLs from Meta are short-lived signed CDN links — fetching
  // and embedding them happens inside generateSocialReportPdfBuffer, so
  // this route just needs to await it like any other async work.
  const pdfBuffer = await generateSocialReportPdfBuffer({
    clientName: page.client_name || page.page_name,
    periodStart: start,
    periodEnd: end,
    ig: snapshot,
    fb: snapshot,
    posts: posts || [],
    featuredPosts,
    optimizationPosts,
    storyPosts: stories || [],
  })

  return new Response(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${(page.client_name || page.page_name || 'report').replace(/\s+/g, '_')}_${start}_to_${end}.pdf"`,
    },
  })
}
