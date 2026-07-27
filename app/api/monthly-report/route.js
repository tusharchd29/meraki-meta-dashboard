import { buildMonthlyReportData, buildBrandedPdf, resolveReportRange, reportFileName } from '@/lib/monthlyReport'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 60 // campaign-level Meta calls across many clients can take a while

// Generates the PDF only. Does NOT send email — see /api/send-report for that.
// Body: { mode: 'month'|'week'|'range', month?: 'YYYY-MM', start?, end?: 'YYYY-MM-DD' }
// mode defaults to 'month' when only `month` (or nothing) is given, so the
// existing "just pick a month" flow keeps working unchanged.
export async function POST(request) {
  try {
    let body = {}
    try { body = await request.json() } catch { /* no body — use defaults */ }

    const range = resolveReportRange(body)
    const { clientReports, label, droppedDuplicates } = await buildMonthlyReportData(range)
    const pdfBase64 = buildBrandedPdf(clientReports, label, droppedDuplicates)
    const overBudgetCount = clientReports.filter(c => c.pace === 'over_budget').length

    return Response.json({
      ok: true,
      start: range.start,
      end: range.end,
      label,
      fileName: reportFileName(range),
      clients: clientReports.length,
      overBudgetCount,
      pdfBase64,
    })
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 })
  }
}
