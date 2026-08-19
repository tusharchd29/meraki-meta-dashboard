const GRAPH = 'https://graph.facebook.com/v22.0'

async function graphGet(path, token, params = {}) {
  const url = new URL(`${GRAPH}/${path}`)
  url.searchParams.set('access_token', token)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString())
  const json = await res.json()
  if (json.error) throw new Error(`${path}: ${json.error.message}`)
  return json
}

// Sums a metric's `values[].value` array from an /insights response, or
// picks the `total_value.value` shape (newer metrics like views/reach use
// this instead of a daily-values array).
function extractMetric(insightsResponse, metricName) {
  const entry = insightsResponse?.data?.find((m) => m.name === metricName)
  if (!entry) return null
  if (entry.total_value?.value != null) return entry.total_value.value
  if (Array.isArray(entry.values)) {
    return entry.values.reduce((sum, v) => sum + (typeof v.value === 'number' ? v.value : 0), 0)
  }
  return null
}

function extractBreakdown(insightsResponse, metricName, breakdownKey) {
  const entry = insightsResponse?.data?.find((m) => m.name === metricName)
  const results = entry?.total_value?.breakdowns?.[0]?.results
  if (!results) return null
  const row = results.find((r) => r.dimension_values?.[0] === breakdownKey)
  return row?.value ?? null
}

// ── Instagram: account-level insights (views, reach, follows, interactions) ──
// since/until are YYYY-MM-DD. IG Insights v22 wants unix timestamps for
// since/until on the `views`/`reach` metrics — converted below.
export async function fetchIgAccountInsights(igUserId, pageAccessToken, periodStart, periodEnd) {
  const sinceTs = Math.floor(new Date(`${periodStart}T00:00:00Z`).getTime() / 1000)
  const untilTs = Math.floor(new Date(`${periodEnd}T23:59:59Z`).getTime() / 1000)

  const views = await graphGet(`${igUserId}/insights`, pageAccessToken, {
    metric: 'views',
    metric_type: 'total_value',
    breakdown: 'media_product_type',
    period: 'day',
    since: sinceTs,
    until: untilTs,
  })

  const reach = await graphGet(`${igUserId}/insights`, pageAccessToken, {
    metric: 'reach',
    metric_type: 'total_value',
    breakdown: 'follow_type',
    period: 'day',
    since: sinceTs,
    until: untilTs,
  })

  const follows = await graphGet(`${igUserId}/insights`, pageAccessToken, {
    metric: 'follows_and_unfollows',
    metric_type: 'total_value',
    breakdown: 'follow_type',
    period: 'day',
    since: sinceTs,
    until: untilTs,
  })

  const interactions = await graphGet(`${igUserId}/insights`, pageAccessToken, {
    metric: 'content_interactions',
    metric_type: 'total_value',
    breakdown: 'follow_type',
    period: 'day',
    since: sinceTs,
    until: untilTs,
  })

  return {
    ig_views: extractMetric(views, 'views'),
    ig_reach: extractMetric(reach, 'reach'),
    ig_reach_from_followers: extractBreakdown(reach, 'reach', 'FOLLOWER'),
    ig_reach_from_non_followers: extractBreakdown(reach, 'reach', 'NON_FOLLOWER'),
    ig_follows: extractBreakdown(follows, 'follows_and_unfollows', 'FOLLOWER'), // follows counted this way per Graph API v22 semantics
    ig_content_interactions: extractMetric(interactions, 'content_interactions'),
    ig_interactions_from_followers: extractBreakdown(interactions, 'content_interactions', 'FOLLOWER'),
    ig_interactions_from_non_followers: extractBreakdown(interactions, 'content_interactions', 'NON_FOLLOWER'),
    raw: { views, reach, follows, interactions },
  }
}

// ── Facebook Page: views, follows, visits, interactions, watch time ──
export async function fetchFbPageInsights(pageId, pageAccessToken, periodStart, periodEnd) {
  const since = periodStart
  const until = periodEnd

  const metrics = [
    'page_views_total',
    'page_follows',
    'page_fans_online', // presence signal, cheap to include
    'page_post_engagements',
  ].join(',')

  const data = await graphGet(`${pageId}/insights`, pageAccessToken, {
    metric: metrics,
    period: 'day',
    since,
    until,
  })

  return {
    fb_views: extractMetric(data, 'page_views_total'),
    fb_follows: extractMetric(data, 'page_follows'),
    fb_content_interactions: extractMetric(data, 'page_post_engagements'),
    raw: data,
  }
}

// ── IG media list + per-media insights, for the Content Performance table ──
export async function fetchIgMediaWithInsights(igUserId, pageAccessToken, periodStart, periodEnd, limit = 25) {
  const media = await graphGet(`${igUserId}/media`, pageAccessToken, {
    fields: 'id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,timestamp',
    limit: String(limit),
  })

  const since = new Date(`${periodStart}T00:00:00Z`)
  const until = new Date(`${periodEnd}T23:59:59Z`)
  const inWindow = (media.data || []).filter((m) => {
    const t = new Date(m.timestamp)
    return t >= since && t <= until
  })

  const results = []
  for (const item of inWindow) {
    const isReel = item.media_product_type === 'REELS'
    const metricList = isReel
      ? 'reach,likes,comments,shares,saved,plays'
      : 'reach,likes,comments,shares,saved'
    try {
      const insights = await graphGet(`${item.id}/insights`, pageAccessToken, { metric: metricList })
      const val = (name) => insights.data?.find((m) => m.name === name)?.values?.[0]?.value ?? null
      results.push({
        ig_media_id: item.id,
        media_type: item.media_product_type || item.media_type,
        caption: item.caption || null,
        permalink: item.permalink,
        thumbnail_url: item.thumbnail_url || item.media_url,
        published_at: item.timestamp,
        reach: val('reach'),
        likes: val('likes'),
        comments: val('comments'),
        shares: val('shares'),
        saves: val('saved'),
        plays: isReel ? val('plays') : null,
        raw: insights,
      })
    } catch (e) {
      // A single post's insights failing (e.g. it's an ad-boosted post
      // with restricted metrics) shouldn't take down the whole report —
      // record it with nulls and keep going.
      results.push({
        ig_media_id: item.id,
        media_type: item.media_product_type || item.media_type,
        caption: item.caption || null,
        permalink: item.permalink,
        thumbnail_url: item.thumbnail_url || item.media_url,
        published_at: item.timestamp,
        reach: null, likes: null, comments: null, shares: null, saves: null, plays: null,
        raw: { error: e.message },
      })
    }
  }

  return results
}

// ── IG Stories — Meta only exposes CURRENTLY LIVE stories via this
// endpoint (they expire from the API ~24h after posting, same as they
// expire from the app). This means a month's worth of "Story Content"
// for a report is only possible if something has been polling and
// archiving stories regularly throughout the month — see
// app/api/cron-social-stories/route.js, which should run every few hours,
// not monthly like the main insights cron.
export async function fetchIgActiveStories(igUserId, pageAccessToken) {
  const data = await graphGet(`${igUserId}/stories`, pageAccessToken, {
    fields: 'id,media_type,media_url,thumbnail_url,timestamp,permalink',
  })

  const results = []
  for (const item of data.data || []) {
    try {
      const insights = await graphGet(`${item.id}/insights`, pageAccessToken, {
        metric: 'impressions,reach,replies,taps_forward,taps_back,exits',
      })
      const val = (name) => insights.data?.find((m) => m.name === name)?.values?.[0]?.value ?? null
      results.push({
        ig_media_id: item.id,
        media_type: 'STORY',
        caption: null,
        permalink: item.permalink || null,
        thumbnail_url: item.thumbnail_url || item.media_url,
        published_at: item.timestamp,
        reach: val('reach'),
        likes: null,
        comments: null,
        shares: null,
        saves: null,
        plays: null,
        raw: { story: item, insights },
      })
    } catch (e) {
      results.push({
        ig_media_id: item.id,
        media_type: 'STORY',
        caption: null,
        permalink: item.permalink || null,
        thumbnail_url: item.thumbnail_url || item.media_url,
        published_at: item.timestamp,
        reach: null, likes: null, comments: null, shares: null, saves: null, plays: null,
        raw: { error: e.message },
      })
    }
  }
  return results
}

// One call that gathers everything a report for one Page/window needs.
export async function fetchFullReportData(page, periodStart, periodEnd) {
  const [fb, ig, posts] = await Promise.all([
    fetchFbPageInsights(page.page_id, page.page_access_token, periodStart, periodEnd),
    page.ig_user_id
      ? fetchIgAccountInsights(page.ig_user_id, page.page_access_token, periodStart, periodEnd)
      : Promise.resolve(null),
    page.ig_user_id
      ? fetchIgMediaWithInsights(page.ig_user_id, page.page_access_token, periodStart, periodEnd)
      : Promise.resolve([]),
  ])

  return { fb, ig, posts }
}
