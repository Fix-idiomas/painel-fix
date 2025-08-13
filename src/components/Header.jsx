'use client'

export default function Header({
  onExport,
  onImport,
  onExportBackup,
  onToggleValues,
  showValues
}) {
  return (
    <header className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center">
      <div className="flex items-center gap-4">
        {/* Logo */}
        <img
          src="/Logo Oficial.png"
          alt="Logo"
          className="h-32 w-32 rounded-lg border border-slate-200 object-contain bg-white"
        />
        <div>
          <h1 className="text-6xl font-bold text-slate-800">Painel Fix</h1>
          <p className="text-slate-500 mt-1">Central de Controle.</p>
        </div>
      </div>

      <div className="mt-4 sm:mt-0 flex gap-2">
        <button
          type="button"
          onClick={onToggleValues}
          className="px-4 py-2 rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 transition"
        >
          {showValues ? 'Ocultar valores' : 'Mostrar valores'}
        </button>
        <button
          type="button"
          onClick={onExportBackup}
          className="px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition"
        >
          Exportar Backup
        </button>
        <label className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium cursor-pointer">
          Importar Dados
          <input
            type="file"
            accept=".json"
            onChange={onImport}
            className="hidden"
          />
        </label>
        <button
          type="button"
          onClick={onExport}
          className="px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition"
        >
          Exportar CSV
        </button>
      </div>
    </header>
  )
}