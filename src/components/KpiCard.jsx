'use client'

export default function KpiCard({ label, value, labelClassName = '' }) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
      <h3 className={`text-sm font-medium ${labelClassName}`}>{label}</h3>
      <p className="text-3xl font-bold text-slate-800 mt-2">{value}</p>
    </div>
  )
}
