import { buildMonthlyReportData, buildBrandedPdf, defaultTargetMonth } from '@/lib/monthlyReport'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 60 // campaign-level Meta calls across many clients can take a while

// Generates the PDF only. Does NOT send email — see /api/send-report for that.
export async function POST(request) {
  try {
    let month = defaultTargetMonth()
    try {
      const body = await request.json()
      if (body?.month) month = body.month
    } catch {
      // no body / not JSON — fine, use the default month
    }

    const { clientReports, label, droppedDuplicates } = await buildMonthlyReportData(month)
    const pdfBase64 = buildBrandedPdf(clientReports, label, droppedDuplicates)
    const overBudgetCount = clientReports.filter(c => c.pace === 'over_budget').length

    return Response.json({
      ok: true,
      month,
      label,
      clients: clientReports.length,
      overBudgetCount,
      pdfBase64,
    })
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 })
  }
}
