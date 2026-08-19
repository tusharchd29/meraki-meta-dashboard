import { imageSize } from 'image-size'

// Instagram/Facebook CDN URLs are unauthenticated but time-limited signed
// URLs (they expire — typically within hours to a couple of days of being
// issued by the Graph API). This is why images are embedded into the PDF
// at report-generation time rather than the PDF just linking out to them:
// by the time someone opens a report from last month, the original CDN
// URL would already be dead.
//
// Returns null (never throws) on any failure — a broken/expired thumbnail
// should degrade to "skip this image," not crash the whole report.
export async function fetchImageForPdf(url) {
  if (!url) return null
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MerakiSocialReports/1.0)' },
    })
    if (!res.ok) return null

    const contentType = res.headers.get('content-type') || ''
    if (!contentType.startsWith('image/')) return null

    const arrayBuffer = await res.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    let dims
    try {
      dims = imageSize(buffer)
    } catch {
      return null // unreadable/corrupt image data
    }
    if (!dims?.width || !dims?.height) return null

    // jsPDF's addImage wants a format string it recognises
    const format = contentType.includes('png') ? 'PNG' : contentType.includes('webp') ? 'WEBP' : 'JPEG'

    return {
      dataUrl: `data:${contentType};base64,${buffer.toString('base64')}`,
      format,
      width: dims.width,
      height: dims.height,
    }
  } catch {
    return null
  }
}

// Fetches a batch concurrently but bounded, so a report with 20 posts
// doesn't fire 20 simultaneous CDN requests.
export async function fetchImagesForPdf(urls, concurrency = 4) {
  const results = new Array(urls.length).fill(null)
  let i = 0
  async function worker() {
    while (i < urls.length) {
      const idx = i++
      results[idx] = await fetchImageForPdf(urls[idx])
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker))
  return results
}
