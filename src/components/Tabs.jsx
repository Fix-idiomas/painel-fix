'use client'
import { useState } from 'react'

export default function Tabs({ tabs = [], initial = 0 }) {
  const [active, setActive] = useState(initial)

  return (
    <div>
      {/* Barra de abas */}
      <div className="mb-6 border-b border-slate-200">
        <nav className="flex -mb-px space-x-6 overflow-x-auto">
          {tabs.map((t, idx) => {
            const isActive = idx === active
            return (
              <button
                key={t.key}
                onClick={() => setActive(idx)}
                className={`py-4 px-1 border-b-2 text-sm font-medium whitespace-nowrap transition-colors
                  ${isActive
                    ? 'border-orange-700 text-orange-700 font-semibold'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
              >
                {t.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Conteúdo da aba ativa */}
      <div>
        {tabs[active]?.content}
      </div>
    </div>
  )
}
