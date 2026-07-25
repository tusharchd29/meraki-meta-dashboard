import nodemailer from 'nodemailer';
import { buildMonthlyReportData, buildBrandedPdf, buildSummaryHtml, defaultTargetMonth } from '@/lib/monthlyReport'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 60 // campaign-level Meta calls across many clients can take a while

export async function POST(request) {
  try {
    let month = defaultTargetMonth()
    try {
      const body = await request.json()
      if (body?.month) month = body.month
    } catch {
      // no body / not JSON — fine, use the default month
    }

    const { clientReports, label } = await buildMonthlyReportData(month)
    const pdfBase64 = buildBrandedPdf(clientReports, label)
    const html = buildSummaryHtml(clientReports, label)
    const overBudgetCount = clientReports.filter(c => c.pace === 'over_budget').length

    let emailed = false, emailError = null
    if (process.env.GMAIL_USER && process.env.GMAIL_PASS) {
      try {
        const transporter = nodemailer.createTransport({
          host: 'smtp.gmail.com',
          port: 465,
          secure: true,
          auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
        })
        await transporter.sendMail({
          from: `"Meraki Ads Meta" <${process.env.GMAIL_USER}>`,
          to: ['tusharchd29@gmail.com', 'heena@merakiads.in'],
          subject: `📊 Monthly Campaign Report — ${label}${overBudgetCount ? ` — ${overBudgetCount} over budget` : ''} (manual trigger)`,
          html,
          attachments: [{
            filename: `Meraki-Monthly-Report-${month}.pdf`,
            content: Buffer.from(pdfBase64, 'base64'),
            contentType: 'application/pdf',
          }],
        })
        emailed = true
      } catch (e) {
        emailError = e.message
      }
    }

    return Response.json({
      ok: true,
      month,
      label,
      clients: clientReports.length,
      overBudgetCount,
      emailed,
      emailError,
      pdfBase64, // let the dashboard offer an immediate "Open PDF" without waiting on email
    })
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 })
  }
}
