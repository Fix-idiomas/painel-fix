import { NextResponse } from 'next/server'

export async function POST(req) {
  try {
    const { to, subject, text, html } = await req.json()

    if (!to || !subject || (!text && !html)) {
      return NextResponse.json(
        { ok: false, error: 'Campos obrigatórios: to, subject, text ou html' },
        { status: 400 }
      )
    }

    const domain = process.env.MAILGUN_DOMAIN
    const apiKey = process.env.MAILGUN_API_KEY
    const from   = process.env.MAIL_FROM || `Fix Idiomas <no-reply@${domain}>`
    const replyTo = process.env.MAIL_REPLY_TO || ''

    const auth = 'Basic ' + Buffer
      .from(`api:${apiKey}`)
      .toString('base64')

    const params = {
      from,
      to,
      subject,
      ...(text ? { text } : {}),
      ...(html ? { html } : {}),
      ...(replyTo ? { 'h:Reply-To': replyTo } : {})
    }

    const body = new URLSearchParams(params).toString()

    const resp = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
      method: 'POST',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
      cache: 'no-store',
    })

    const raw = await resp.text()
    if (!resp.ok) {
      console.error('Mailgun error:', resp.status, raw)
      return NextResponse.json(
        { ok: false, error: 'Mailgun error', detail: raw },
        { status: resp.status }
      )
    }

    let mg
    try { mg = JSON.parse(raw) } catch { mg = { raw } }

    return NextResponse.json({ ok: true, mailgun: mg })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}