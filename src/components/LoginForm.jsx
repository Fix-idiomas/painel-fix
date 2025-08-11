'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function LoginForm({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showReset, setShowReset] = useState(false)
  const [resetMsg, setResetMsg] = useState('')

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) setError('E-mail ou senha inválidos')
    else if (onLogin) onLogin()
  }

  async function handleReset(e) {
    e.preventDefault()
    setResetMsg('')
    setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    if (error) setError('Erro ao enviar e-mail de recuperação')
    else setResetMsg('E-mail de recuperação enviado! Verifique sua caixa de entrada.')
  }

  return (
    <form onSubmit={handleLogin} className="bg-white p-6 rounded shadow-md w-full max-w-xs flex flex-col gap-3">
      <h2 className="text-lg font-bold mb-2">Entrar no Painel</h2>
      <input
        type="email"
        placeholder="E-mail"
        className="border rounded px-3 py-2 text-slate-800 placeholder-slate-400 bg-white"
        value={email}
        onChange={e => setEmail(e.target.value)}
        required
      />
      <input
        type="password"
        placeholder="Senha"
        className="border rounded px-3 py-2 text-slate-800 placeholder-slate-400 bg-white"
        value={password}
        onChange={e => setPassword(e.target.value)}
        required
      />
      <button
        type="submit"
        className="bg-orange-600 text-white font-semibold px-4 py-2 rounded"
        disabled={loading}
      >
        {loading ? 'Entrando...' : 'Entrar'}
      </button>
      <button
        type="button"
        className="text-sm text-orange-600 underline"
        onClick={() => setShowReset(!showReset)}
      >
        Esqueci minha senha
      </button>
      {error && <div className="text-red-600 text-sm">{error}</div>}
      {resetMsg && <div className="text-green-600 text-sm">{resetMsg}</div>}
      {showReset && (
        <form onSubmit={handleReset} className="flex flex-col gap-2 mt-2">
          <input
            type="email"
            placeholder="Seu e-mail"
            className="border rounded px-3 py-2 text-slate-800 placeholder-slate-400 bg-white"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          <button
            type="submit"
            className="bg-slate-200 text-slate-700 rounded px-3 py-2"
          >
            Enviar link de recuperação
          </button>
        </form>
      )}
    </form>
  )
}