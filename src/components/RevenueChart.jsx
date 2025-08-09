'use client'
import { useEffect, useRef } from 'react'
import Chart from 'chart.js/auto'

export default function RevenueChart({ labels = [], received = [], projected = [] }) {
  const canvasRef = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    if (chartRef.current) chartRef.current.destroy()
    const ctx = canvasRef.current.getContext('2d')

    chartRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Receita Realizada', data: received, backgroundColor: '#16a34a', borderRadius: 4 },
          { label: 'Receita Prevista', data: projected, backgroundColor: '#e2e8f0', borderRadius: 4 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, ticks: { callback: v => v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}) } },
          x: { grid: { display: false } },
        },
        plugins: {
          legend: { position: 'top', align: 'end' },
          tooltip: { callbacks: { label: c => `${c.dataset.label}: ${c.parsed.y.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}` } }
        }
      }
    })

    return () => chartRef.current?.destroy()
  }, [labels, received, projected])

  return (
    <div className="relative w-full max-w-3xl mx-auto h-[300px] md:h-[350px]">
      <canvas ref={canvasRef} />
    </div>
  )
}
