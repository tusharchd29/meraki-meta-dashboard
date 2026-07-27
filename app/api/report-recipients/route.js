import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Who receives the weekly/monthly report emails. Configured here instead
// of hardcoded in the cron/send-report code — see
// supabase/migrations/20260727_report_recipients.sql for the table (run
// once against the project's Supabase database if this route 404s on the
// table).

export async function GET() {
  try {
    const db = supabaseAdmin()
    const { data, error } = await db
      .from('meraki_report_recipients')
      .select('id, email, label, weekly, monthly, created_at')
      .order('created_at', { ascending: true })
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ recipients: data || [] })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request) {
  try {
    const { email, label, weekly, monthly } = await request.json()
    const clean = (email || '').trim().toLowerCase()
    if (!EMAIL_RE.test(clean)) return Response.json({ error: 'Enter a valid email address.' }, { status: 400 })

    const db = supabaseAdmin()
    const { data, error } = await db
      .from('meraki_report_recipients')
      .insert({
        email: clean,
        label: label?.trim() || null,
        weekly: weekly !== false,
        monthly: monthly !== false,
      })
      .select()
      .single()
    if (error) {
      if (error.code === '23505') return Response.json({ error: 'That email is already on the list.' }, { status: 400 })
      return Response.json({ error: error.message }, { status: 500 })
    }
    return Response.json({ ok: true, recipient: data })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}

// Toggle weekly/monthly for an existing recipient. Pass only what changed.
export async function PATCH(request) {
  try {
    const { id, weekly, monthly } = await request.json()
    if (!id) return Response.json({ error: 'missing id' }, { status: 400 })
    const update = {}
    if (typeof weekly === 'boolean') update.weekly = weekly
    if (typeof monthly === 'boolean') update.monthly = monthly
    if (Object.keys(update).length === 0) return Response.json({ error: 'nothing to update' }, { status: 400 })

    const db = supabaseAdmin()
    const { error } = await db.from('meraki_report_recipients').update(update).eq('id', id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return Response.json({ error: 'missing id' }, { status: 400 })
    const db = supabaseAdmin()
    const { error } = await db.from('meraki_report_recipients').delete().eq('id', id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
