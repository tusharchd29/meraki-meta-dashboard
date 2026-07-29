import nodemailer from 'nodemailer';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';

// Runs after cron-budget-snapshot (which computes pace_status daily).
// This job's only job is to turn 'overspending'/'underspending' rows that
// are otherwise just sitting in meraki_budget_snapshots into an actual
// email — closing the "deviations not getting flagged in time" gap.
//
// Alert cadence: notify the day a deviation is first seen, then remind
// every 3 days if it's still unresolved, rather than emailing daily for
// the same ongoing issue (SOP Escalation Matrix: flag "same day it is
// detected", but repeat daily noise would just get filtered/ignored).
const REMINDER_GAP_DAYS = 3;

export default async function handler(req, res) {
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const db = supabaseAdmin();
  const now = new Date();
  const istNow = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const today = istNow.toISOString().split('T')[0];

  try {
    // 1. Today's deviating snapshots
    const { data: snapshots, error: sErr } = await db
      .from('meraki_budget_snapshots')
      .select('client_id, pace_status, expected_pct, actual_pct, blended_spend_inr, budget')
      .eq('snapshot_date', today)
      .in('pace_status', ['overspending', 'underspending']);
    if (sErr) throw new Error(`snapshots: ${sErr.message}`);

    if (!snapshots?.length) {
      return res.status(200).json({ success: true, date: today, alerted: 0, note: 'no deviations today' });
    }

    // 2. Client names
    const clientIds = [...new Set(snapshots.map(s => s.client_id))];
    const { data: clients, error: cErr } = await db
      .from('meraki_clients')
      .select('id, name')
      .in('id', clientIds);
    if (cErr) throw new Error(`clients: ${cErr.message}`);
    const nameById = Object.fromEntries((clients || []).map(c => [c.id, c.name]));

    // 3. Dedup — skip clients alerted for the same pace_status within the
    //    reminder gap
    const cutoff = new Date(istNow);
    cutoff.setDate(cutoff.getDate() - REMINDER_GAP_DAYS);
    const cutoffStr = cutoff.toISOString().split('T')[0];

    const { data: recentAlerts, error: aErr } = await db
      .from('meraki_budget_alerts_log')
      .select('client_id, pace_status, alert_date')
      .in('client_id', clientIds)
      .gte('alert_date', cutoffStr);
    if (aErr) throw new Error(`alerts_log: ${aErr.message}`);

    const recentlyAlerted = new Set(
      (recentAlerts || []).map(a => `${a.client_id}:${a.pace_status}`)
    );

    const toAlert = snapshots.filter(
      s => !recentlyAlerted.has(`${s.client_id}:${s.pace_status}`)
    );

    if (!toAlert.length) {
      return res.status(200).json({
        success: true,
        date: today,
        alerted: 0,
        note: `${snapshots.length} deviation(s) today, all already alerted within last ${REMINDER_GAP_DAYS} days`,
      });
    }

    // 4. Recipients
    const { data: recipients, error: rErr } = await db
      .from('meraki_report_recipients')
      .select('email')
      .eq('budget_alerts', true);
    if (rErr) throw new Error(`recipients: ${rErr.message}`);
    const toList = (recipients || []).map(r => r.email);

    if (!toList.length) {
      return res.status(200).json({ success: true, date: today, alerted: 0, note: 'deviations found but no budget_alerts recipients configured' });
    }

    // 5. Compose + send
    const rows = toAlert.map(s => {
      const diff = (s.actual_pct ?? 0) - (s.expected_pct ?? 0);
      return { ...s, name: nameById[s.client_id] || 'Unknown client', diff };
    }).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

    const rowsHtml = rows.map(r => {
      const isOver = r.pace_status === 'overspending';
      const badgeColor = isOver ? '#DC2626' : '#D97706';
      const badgeBg = isOver ? '#FEE2E2' : '#FEF3C7';
      return `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #eee;">${r.name}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;">
            <span style="background:${badgeBg};color:${badgeColor};padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;">
              ${isOver ? 'OVERSPENDING' : 'UNDERSPENDING'}
            </span>
          </td>
          <td style="padding:8px;border-bottom:1px solid #eee;">₹${Math.round(r.blended_spend_inr || 0).toLocaleString('en-IN')}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;">₹${Math.round(r.budget || 0).toLocaleString('en-IN')}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;">${(r.expected_pct ?? 0).toFixed(1)}%</td>
          <td style="padding:8px;border-bottom:1px solid #eee;">${(r.actual_pct ?? 0).toFixed(1)}%</td>
          <td style="padding:8px;border-bottom:1px solid #eee;font-weight:600;color:${badgeColor};">${r.diff > 0 ? '+' : ''}${r.diff.toFixed(1)}pp</td>
        </tr>`;
    }).join('');

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:700px;">
        <div style="background:#7DC242;padding:16px;color:#fff;">
          <h2 style="margin:0;font-size:16px;">⚠️ Budget Pacing Alert — ${today}</h2>
        </div>
        <p style="color:#374151;font-size:14px;">
          ${rows.length} client${rows.length > 1 ? 's are' : ' is'} pacing more than 15 percentage points off the expected monthly spend curve.
        </p>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="background:#F9FAFB;text-align:left;">
              <th style="padding:8px;">Client</th>
              <th style="padding:8px;">Status</th>
              <th style="padding:8px;">Spend MTD</th>
              <th style="padding:8px;">Budget</th>
              <th style="padding:8px;">Expected</th>
              <th style="padding:8px;">Actual</th>
              <th style="padding:8px;">Deviation</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <p style="color:#6B7280;font-size:12px;margin-top:16px;">
          Per SOP: flag cause + corrective action + review date internally today, then in the client group if it's client-caused.
          ${REMINDER_GAP_DAYS}-day reminder cadence — you won't get this again for the same issue until it's still unresolved in ${REMINDER_GAP_DAYS} days.
        </p>
      </div>`;

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
    });

    await transporter.sendMail({
      from: `"Meraki Ads Budget Alerts" <${process.env.GMAIL_USER}>`,
      to: toList,
      subject: `⚠️ Budget Pacing Alert — ${rows.length} client${rows.length > 1 ? 's' : ''} off track — ${today}`,
      html,
    });

    // 6. Log so we don't re-alert within the reminder gap
    const logRows = toAlert.map(s => ({
      client_id: s.client_id,
      pace_status: s.pace_status,
      deviation_pct: (s.actual_pct ?? 0) - (s.expected_pct ?? 0),
      alert_date: today,
    }));
    const { error: logErr } = await db.from('meraki_budget_alerts_log').insert(logRows);
    if (logErr) console.error('Failed to write alert log (email was still sent):', logErr.message);

    return res.status(200).json({
      success: true,
      date: today,
      alerted: toAlert.length,
      skipped_recent: snapshots.length - toAlert.length,
      recipients: toList,
    });
  } catch (err) {
    console.error('Budget alert cron error:', err);
    return res.status(500).json({ error: err.message });
  }
}
