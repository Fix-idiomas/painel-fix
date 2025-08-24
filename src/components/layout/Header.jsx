export default function Header({ title = 'Painel Fix', subtitle = 'Central de Controle.' }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <img src="/Logo Oficial.png" alt="Fix Idiomas" className="h-24 w-30 rounded-full" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button className="rounded-md border px-3 py-2 text-sm hover:bg-slate-50">Ocultar valores</button>
        <button className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800">Exportar Backup</button>
        <button className="rounded-md border px-3 py-2 text-sm hover:bg-slate-50">Importar Dados</button>
        <button className="rounded-md border px-3 py-2 text-sm hover:bg-slate-50">Exportar CSV</button>
        <button className="rounded-md bg-slate-100 px-3 py-2 text-sm hover:bg-slate-200">Sair</button>
      </div>
    </div>
  );
}
