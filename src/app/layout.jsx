import './globals.css';
import Header from '@/components/layout/Header';
import Tabs from '@/components/Tabs';

export const metadata = {
  title: 'Fixdash',
  description: 'Painel Fix',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-neutral-50">
        {/* Topo fixo: logo + título + ações + abas */}
        <div className="border-b bg-white">
          <div className="mx-auto max-w-7xl px-6 py-5">
            <Header />
            <div className="mt-5">
              <Tabs
                tabs={[
                  { label: 'Visão Geral', href: '/' },
                  { label: 'Alunos Ativos', href: '/alunos-ativos' },
                  { label: 'Alunos Inativos', href: '/alunos-inativos' },
                  { label: 'Professores', href: '/professores' },
                  { label: 'Pagadores', href: '/pagadores' },
                  { label: 'Pagamentos', href: '/pagamentos' },
                  { label: 'Evolução Pedagógica', href: '/evolucao' },
                  { label: 'Turmas', href: '/turmas' },
                ]}
              />
            </div>
          </div>
        </div>

        {/* Container das páginas */}
        <div className="mx-auto max-w-7xl px-6 py-8">
          {children}
        </div>
      </body>
    </html>
  );
}
