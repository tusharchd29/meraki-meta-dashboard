import nodemailer from 'nodemailer';
import { buildMonthlyReportData, buildBrandedPdf, buildSummaryHtml, resolveReportRange, reportFileName } from '../lib/monthlyReport.js';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';

// Without this, Vercel Functions default to a much shorter timeout than
// this needs — buildMonthlyReportData makes 2 Meta API calls per tracked
// client (insights + live campaign statuses), batched 4 at a time, which
// can run past 10s well before reaching 20 clients. Matches the manual
// /api/monthly-report route's own maxDuration.
export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const range = resolveReportRange({ mode: 'month', month: req.query?.month });

  try {
    const { clientReports, label, droppedDuplicates } = await buildMonthlyReportData(range);
    const pdfBase64 = buildBrandedPdf(clientReports, label, droppedDuplicates);
    const html = buildSummaryHtml(clientReports, label);
    const overBudgetCount = clientReports.filter(c => c.pace === 'over_budget').length;

    const db = supabaseAdmin();
    const { data: recipients, error: recErr } = await db
      .from('meraki_report_recipients')
      .select('email')
      .eq('monthly', true);
    if (recErr) throw new Error(`recipients: ${recErr.message}`);
    const toList = (recipients || []).map(r => r.email);
    if (toList.length === 0) {
      return res.status(200).json({ success: true, skipped: 'no monthly recipients configured', start: range.start, end: range.end, clients: clientReports.length, overBudgetCount });
    }

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
    });

    await transporter.sendMail({
      from: `"Meraki Ads Meta" <${process.env.GMAIL_USER}>`,
      to: toList,
      subject: `📊 Monthly Campaign Report — ${label}${overBudgetCount ? ` — ${overBudgetCount} over budget` : ''}`,
      html,
      attachments: [{
        filename: reportFileName(range),
        content: Buffer.from(pdfBase64, 'base64'),
        contentType: 'application/pdf',
      }],
    });

    return res.status(200).json({ success: true, start: range.start, end: range.end, clients: clientReports.length, overBudgetCount, recipients: toList });
  } catch (err) {
    console.error('Monthly report cron error:', err);
    return res.status(500).json({ error: err.message });
  }
}
