import { jsPDF } from 'jspdf'
import autoTableImport from 'jspdf-autotable'
import { fetchImagesForPdf } from './imageUtils'
const autoTable = autoTableImport.default || autoTableImport

// Layout constants — A4 landscape, matching the Pratha PDF's slide-deck feel
const PAGE_W = 297
const PAGE_H = 210
const MARGIN = 18

const DEFAULT_PALETTE = {
  dark: [51, 46, 38],       // near-black heading text, matches the source deck
  accentBlue: [41, 171, 226],
  accentGreen: [125, 194, 66],
  cardBg: [247, 247, 245],
  border: [225, 225, 220],
  muted: [130, 130, 125],
}

function fmtNum(n) {
  if (n === null || n === undefined) return '—'
  return Number(n).toLocaleString('en-IN')
}

function fmtPeriodLabel(start, end) {
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  const opts = { day: 'numeric', month: 'short', year: 'numeric' }
  return `${s.toLocaleDateString('en-IN', opts)} – ${e.toLocaleDateString('en-IN', opts)}`
}

// ── Cover page ──────────────────────────────────────────────────────────
function drawCover(doc, { clientName, periodLabel, palette }) {
  doc.setFillColor(255, 255, 255)
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F')

  doc.setTextColor(...palette.dark)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(34)
  doc.text('Monthly', MARGIN, 70)
  doc.text('Performance Report', MARGIN, 90)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(13)
  doc.setTextColor(...palette.muted)
  doc.text(clientName || '', MARGIN, 102)

  // date pill, bottom-right — mirrors the "July 2026" badge on the source cover
  const pillW = 70, pillH = 12
  const px = PAGE_W - MARGIN - pillW, py = PAGE_H - 40
  doc.setDrawColor(...palette.accentBlue)
  doc.roundedRect(px, py, pillW, pillH, 6, 6, 'S')
  doc.setFontSize(11)
  doc.setTextColor(...palette.dark)
  doc.text(periodLabel, px + pillW / 2, py + pillH / 2 + 3, { align: 'center' })
}

// ── Section header bar ──────────────────────────────────────────────────
function drawSectionHeader(doc, title, palette) {
  doc.setFillColor(255, 255, 255)
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(24)
  doc.setTextColor(...palette.dark)
  doc.text(title, PAGE_W / 2, 30, { align: 'center' })
}

// ── A 2x2 stat-card grid, matching the "Views / Follows / Reach / Interactions" layout ──
function drawStatCards(doc, cards, startY, palette) {
  const cardW = (PAGE_W - MARGIN * 2 - 8) / 2
  const cardH = 42
  const gap = 8
  cards.forEach((card, i) => {
    const col = i % 2
    const row = Math.floor(i / 2)
    const x = MARGIN + col * (cardW + gap)
    const y = startY + row * (cardH + gap)

    doc.setFillColor(...palette.cardBg)
    doc.setDrawColor(...palette.border)
    doc.roundedRect(x, y, cardW, cardH, 3, 3, 'FD')

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...palette.muted)
    doc.text(card.label, x + 6, y + 9)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(20)
    doc.setTextColor(...palette.dark)
    doc.text(card.value, x + 6, y + 22)

    if (card.sub) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(...palette.muted)
      const lines = doc.splitTextToSize(card.sub, cardW - 12)
      doc.text(lines, x + 6, y + 30)
    }
  })
}

function drawInstagramStatsPage(doc, ig, palette) {
  drawSectionHeader(doc, 'Instagram Page Statistics', palette)
  const cards = [
    {
      label: 'Views',
      value: fmtNum(ig?.ig_views),
      sub: `From non-followers: ${fmtNum(ig?.ig_reach_from_non_followers)}`,
    },
    {
      label: 'Follows',
      value: fmtNum(ig?.ig_follows),
      sub: '',
    },
    {
      label: 'Reach',
      value: fmtNum(ig?.ig_reach),
      sub: `From followers: ${fmtNum(ig?.ig_reach_from_followers)}  •  Non-followers: ${fmtNum(ig?.ig_reach_from_non_followers)}`,
    },
    {
      label: 'Interactions',
      value: fmtNum(ig?.ig_content_interactions),
      sub: `From followers: ${fmtNum(ig?.ig_interactions_from_followers)}  •  Non-followers: ${fmtNum(ig?.ig_interactions_from_non_followers)}`,
    },
  ]
  drawStatCards(doc, cards, 55, palette)
}

function drawFacebookStatsPage(doc, fb, palette) {
  drawSectionHeader(doc, 'Facebook Page Statistics', palette)
  const cards = [
    { label: 'Views', value: fmtNum(fb?.fb_views), sub: '' },
    { label: 'Follows', value: fmtNum(fb?.fb_follows), sub: '' },
    { label: 'Content Interactions', value: fmtNum(fb?.fb_content_interactions), sub: '' },
    { label: 'Watch Time', value: fb?.fb_watch_time_seconds ? `${Math.round(fb.fb_watch_time_seconds / 60)}m` : '—', sub: '' },
  ]
  drawStatCards(doc, cards, 55, palette)
}

// ── Content Performance table (per-post reach/likes/shares) ─────────────
function drawContentPerformanceTable(doc, posts, palette) {
  drawSectionHeader(doc, 'Content Performance', palette)

  const rows = (posts || []).map((p) => [
    p.caption ? (p.caption.length > 40 ? p.caption.slice(0, 40) + '…' : p.caption) : '(no caption)',
    p.media_type || '',
    p.published_at ? new Date(p.published_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '',
    fmtNum(p.reach),
    fmtNum((p.likes || 0) + (p.comments || 0)),
    fmtNum(p.shares),
  ])

  autoTable(doc, {
    startY: 40,
    margin: { left: MARGIN, right: MARGIN },
    head: [['Title', 'Type', 'Published', 'Reach', 'Likes & reactions', 'Shares']],
    body: rows,
    styles: { fontSize: 9, cellPadding: 3, textColor: palette.dark },
    headStyles: { fillColor: palette.accentBlue, textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: palette.cardBg },
  })
}

// ── Content grid, paginated ─────────────────────────────────────────────
// Splits an arbitrary-length post list into as many 4-per-page grids as
// needed — a busy month with 30 posts gets 8 pages here, not a silent
// truncation to whatever fit on one page. Fetches images per-page (not
// all at once) so a huge month doesn't hold hundreds of decoded images
// in memory simultaneously.
async function drawContentGridPages(doc, title, posts, palette) {
  if (!posts.length) return

  const PER_PAGE = 4
  const pageCount = Math.ceil(posts.length / PER_PAGE)

  for (let p = 0; p < pageCount; p++) {
    const chunk = posts.slice(p * PER_PAGE, p * PER_PAGE + PER_PAGE)
    const images = await fetchImagesForPdf(chunk.map((post) => post.thumbnail_url))

    doc.addPage()
    const pageTitle = pageCount > 1 ? `${title} (${p + 1}/${pageCount})` : title
    drawSectionHeader(doc, pageTitle, palette)

    const cols = chunk.length
    const gap = 6
    const cellW = (PAGE_W - MARGIN * 2 - gap * (cols - 1)) / cols
    const cellImgH = 70
    const y = 45

    chunk.forEach((post, i) => {
      const x = MARGIN + i * (cellW + gap)
      const img = images[i]

      doc.setDrawColor(...palette.border)
      doc.setFillColor(...palette.cardBg)
      doc.roundedRect(x, y, cellW, cellImgH, 2, 2, 'FD')

      if (img) {
        const scale = Math.min(cellW / img.width, cellImgH / img.height)
        const drawW = img.width * scale
        const drawH = img.height * scale
        const dx = x + (cellW - drawW) / 2
        const dy = y + (cellImgH - drawH) / 2
        try {
          doc.addImage(img.dataUrl, img.format, dx, dy, drawW, drawH)
        } catch {
          // corrupt/unsupported image data slipped past the earlier check
        }
      } else {
        doc.setFontSize(8)
        doc.setTextColor(...palette.muted)
        doc.text('Image unavailable', x + cellW / 2, y + cellImgH / 2, { align: 'center' })
      }

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...palette.dark)
      const captionText = post.caption ? post.caption.slice(0, 60) : '(no caption)'
      const lines = doc.splitTextToSize(captionText, cellW)
      doc.text(lines.slice(0, 2), x, y + cellImgH + 6)

      doc.setTextColor(...palette.muted)
      doc.setFontSize(7.5)
      const statLine = `Reach ${fmtNum(post.reach)} · Likes ${fmtNum(post.likes)}`
      doc.text(statLine, x, y + cellImgH + (lines.length > 1 ? 15 : 11))
    })
  }
}

function drawThankYou(doc, palette) {
  doc.setFillColor(245, 244, 240)
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(30)
  doc.setTextColor(...palette.dark)
  doc.text('THANK YOU', PAGE_W / 2, PAGE_H / 2, { align: 'center' })
}

// ── Entry point ───────────────────────────────────────────────────────
// data: {
//   clientName, periodStart, periodEnd, fb, ig, posts, palette?,
//   featuredPosts?  — organic posts to render in "Social Media Content"
//                     (defaults to every non-optimization, non-story post
//                     in `posts` — not a top-N cutoff. A month with 30
//                     organic posts gets a 30-post grid across as many
//                     pages as needed)
//   optimizationPosts? — posts with social_posts.is_optimization=true,
//                     rendered in "Social Media Optimization" instead.
//                     Manually flagged, not auto-detected — see the
//                     column comment in the migration for why: Meta
//                     doesn't expose a reliable per-post paid/boosted
//                     signal across both Facebook and Instagram without
//                     cross-referencing Ads permissions this login
//                     deliberately doesn't have.
//   storyPosts?     — real archived stories (media_type='STORY'), from
//                     the frequent story-capture cron. Omitted or empty
//                     means the "Story Content" section is skipped
//                     entirely — it is never backfilled from regular
//                     posts, since that would misrepresent what was
//                     actually posted to Stories.
// }
export async function generateSocialReportPdf(data) {
  const palette = { ...DEFAULT_PALETTE, ...(data.palette || {}) }
  const periodLabel = fmtPeriodLabel(data.periodStart, data.periodEnd)

  const allPosts = data.posts || []
  const contentPosts = data.featuredPosts && data.featuredPosts.length ? data.featuredPosts : allPosts
  const optimizationPosts = data.optimizationPosts || []
  const storyPosts = data.storyPosts || []

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  drawCover(doc, { clientName: data.clientName, periodLabel, palette })

  await drawContentGridPages(doc, 'Social Media Content', contentPosts, palette)
  await drawContentGridPages(doc, 'Social Media Optimization', optimizationPosts, palette)
  await drawContentGridPages(doc, 'Story Content', storyPosts, palette)

  doc.addPage()
  drawContentPerformanceTable(doc, allPosts, palette)

  doc.addPage()
  drawInstagramStatsPage(doc, data.ig, palette)

  doc.addPage()
  drawFacebookStatsPage(doc, data.fb, palette)

  doc.addPage()
  drawThankYou(doc, palette)

  return doc
}

// Returns a Buffer, for API routes that stream the PDF back directly.
export async function generateSocialReportPdfBuffer(data) {
  const doc = await generateSocialReportPdf(data)
  return Buffer.from(doc.output('arraybuffer'))
}
