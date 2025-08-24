'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export const DEFAULT_TABS = [
  { label: 'Visão Geral',         href: '/' },
  { label: 'Alunos Ativos',       href: '/alunos-ativos' },
  { label: 'Alunos Inativos',     href: '/alunos-inativos' },
  { label: 'Professores',         href: '/professores' },
  { label: 'Pagadores',           href: '/pagadores' },
  { label: 'Pagamentos',          href: '/pagamentos' },
  { label: 'Evolução Pedagógica', href: '/evolucao' },
  { label: 'Turmas',              href: '/turmas' },
];

function isActive(pathname, href) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(href + '/');
}

export default function Tabs({ tabs = DEFAULT_TABS, className = '' }) {
  const pathname = usePathname() || '/';

  return (
    <nav className={`w-full border-b bg-white ${className}`}>
      <ul className="flex gap-1 overflow-x-auto px-2">
        {tabs.map((t) => {
          const active = isActive(pathname, t.href);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                className={[
                  'inline-block whitespace-nowrap rounded-t-md px-3 py-2 text-sm border-b-2',
                  active
                    ? 'font-medium border-indigo-600 text-indigo-700 bg-indigo-50'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50',
                ].join(' ')}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
