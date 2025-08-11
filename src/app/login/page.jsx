'use client'
import LoginForm from '@/components/LoginForm'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function LoginPage() {
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) router.push('/')
    })
  }, [router])

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-300 overflow-hidden">
      {/* Marca d'água grande */}
      <img
        src="/Logo Oficial.png"
        alt="Logo marca d'água"
        className="pointer-events-none select-none opacity-90 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ width: '80vw', maxWidth: 950, minWidth: 300 }}
        aria-hidden="true"
      />
      <div className="bg-white shadow-xl rounded-2xl p-4 sm:p-6 w-full max-w-xs sm:max-w-md flex flex-col items-center relative z-10">
        <img
          src="/Logo Oficial.png"
          alt="Logo"
          className="w-20 h-20 sm:w-28 sm:h-28 mb-4 rounded-full shadow object-contain"
        />
        <h1 className="text-xl sm:text-2xl font-bold mb-2 text-slate-800 text-center">Bem-vindo ao Painel Fix</h1>
        <p className="text-slate-500 mb-4 sm:mb-6 text-center text-sm sm:text-base">
          Let's take care of your business.
        </p>
        <LoginForm onLogin={() => router.push('/')} />
      </div>
    </div>
  )
}