import nodemailer from 'nodemailer';
import { buildMonthlyReportData, buildBrandedPdf, buildSummaryHtml, defaultTargetMonth, reportFileName } from '../lib/monthlyReport.js';

export default async function handler(req, res) {
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const targetMonth = req.query?.month || defaultTargetMonth();

  try {
    const { clientReports, label, droppedDuplicates } = await buildMonthlyReportData(targetMonth);
    const pdfBase64 = buildBrandedPdf(clientReports, label, droppedDuplicates);
    const html = buildSummaryHtml(clientReports, label);
    const overBudgetCount = clientReports.filter(c => c.pace === 'over_budget').length;

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
    });

    await transporter.sendMail({
      from: `"Meraki Ads Meta" <${process.env.GMAIL_USER}>`,
      to: ['tusharchd29@gmail.com', 'heena@merakiads.in'],
      subject: `📊 Monthly Campaign Report — ${label}${overBudgetCount ? ` — ${overBudgetCount} over budget` : ''}`,
      html,
      attachments: [{
        filename: reportFileName(targetMonth),
        content: Buffer.from(pdfBase64, 'base64'),
        contentType: 'application/pdf',
      }],
    });

    return res.status(200).json({ success: true, month: targetMonth, clients: clientReports.length, overBudgetCount });
  } catch (err) {
    console.error('Monthly report cron error:', err);
    return res.status(500).json({ error: err.message });
  }
}
