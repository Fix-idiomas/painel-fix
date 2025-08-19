'use client'
import { useState } from 'react'

export default function SendMailPanel() {
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [text, setText] = useState('')
  const [html, setHtml] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  async function handleSend(e) {
    e.preventDefault()
    setLoading(true)
    setResult(null)
    setError('')
    try {
      const res = await fetch('/api/send-mail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, text, html }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || 'Erro ao enviar')
      setResult('E-mail enviado com sucesso!')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 max-w-xl mx-auto my-8">
      <h2 className="text-lg font-semibold mb-4">Teste de envio de e-mail (Mailgun)</h2>
      <form onSubmit={handleSend} className="space-y-3">
        <div>
          <label className="block text-sm mb-1">Para (to):</label>
          <input
            type="email"
            className="w-full border rounded px-3 py-2"
            value={to}
            onChange={e => setTo(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Assunto:</label>
          <input
            className="w-full border rounded px-3 py-2"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Texto (plain text):</label>
          <textarea
            className="w-full border rounded px-3 py-2"
            value={text}
            onChange={e => setText(e.target.value)}
            rows={3}
          />
        </div>
        <div>
          <label className="block text-sm mb-1">HTML (opcional):</label>
          <textarea
            className="w-full border rounded px-3 py-2 font-mono"
            value={html}
            onChange={e => setHtml(e.target.value)}
            rows={3}
            placeholder="<b>Olá!</b> Este é um teste."
          />
        </div>
        <button
          type="submit"
          className="bg-slate-900 text-white px-4 py-2 rounded disabled:opacity-60"
          disabled={loading}
        >
          {loading ? 'Enviando...' : 'Enviar'}
        </button>
      </form>
      {result && <div className="mt-4 text-green-700">{result}</div>}
      {error && <div className="mt-4 text-red-600">{error}</div>}
    </div>
  )
}