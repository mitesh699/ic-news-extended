import { ChartJSNodeCanvas } from 'chartjs-node-canvas'
import type { ChartConfiguration } from 'chart.js'

const WIDTH = 500
const HEIGHT = 300
const FONT_FAMILY = 'DejaVu Sans, sans-serif'

const renderer = new ChartJSNodeCanvas({
  width: WIDTH,
  height: HEIGHT,
  backgroundColour: '#ffffff',
  chartCallback: (ChartJS) => {
    ChartJS.defaults.font.family = FONT_FAMILY
    ChartJS.defaults.font.size = 12
    ChartJS.defaults.color = '#475569'
  },
})

export async function renderChart(config: ChartConfiguration): Promise<Buffer> {
  return renderer.renderToBuffer(config)
}

export async function renderSentimentPie(data: {
  positive: number
  negative: number
  neutral: number
}): Promise<Buffer> {
  const total = data.positive + data.negative + data.neutral
  return renderChart({
    type: 'doughnut',
    data: {
      labels: [
        `Positive (${data.positive})`,
        `Negative (${data.negative})`,
        `Neutral (${data.neutral})`,
      ],
      datasets: [{
        data: [data.positive, data.negative, data.neutral],
        backgroundColor: ['#22c55e', '#ef4444', '#94a3b8'],
        borderWidth: 0,
      }],
    },
    options: {
      plugins: {
        title: { display: true, text: `Sentiment Distribution (${total} articles)`, font: { size: 14, weight: 'bold' } },
        legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 12 } },
      },
    },
  })
}

export async function renderSectorBarChart(
  sectors: { sector: string; count: number }[]
): Promise<Buffer> {
  const sorted = sectors.sort((a, b) => b.count - a.count).slice(0, 10)
  return renderChart({
    type: 'bar',
    data: {
      labels: sorted.map(s => s.sector),
      datasets: [{
        label: 'Articles',
        data: sorted.map(s => s.count),
        backgroundColor: '#3b82f6',
        borderRadius: 4,
      }],
    },
    options: {
      indexAxis: 'y',
      plugins: {
        title: { display: true, text: 'Article Volume by Sector', font: { size: 14, weight: 'bold' } },
        legend: { display: false },
      },
      scales: {
        x: {
          grid: { color: '#e2e8f0' },
          ticks: { font: { size: 11 } },
        },
        y: {
          grid: { display: false },
          ticks: { font: { size: 11 } },
        },
      },
    },
  })
}

export async function renderSignalBreakdown(
  signals: Record<string, number>
): Promise<Buffer> {
  const SIGNAL_COLORS: Record<string, string> = {
    funding: '#22c55e',
    hiring: '#3b82f6',
    product: '#8b5cf6',
    regulatory: '#f59e0b',
    'M&A': '#06b6d4',
    risk: '#ef4444',
    partnership: '#10b981',
  }

  const entries = Object.entries(signals)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])

  return renderChart({
    type: 'bar',
    data: {
      labels: entries.map(([k]) => k),
      datasets: [{
        label: 'Count',
        data: entries.map(([, v]) => v),
        backgroundColor: entries.map(([k]) => SIGNAL_COLORS[k] || '#64748b'),
        borderRadius: 4,
      }],
    },
    options: {
      plugins: {
        title: { display: true, text: 'Signal Breakdown', font: { size: 14, weight: 'bold' } },
        legend: { display: false },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 11 } },
        },
        y: {
          grid: { color: '#e2e8f0' },
          beginAtZero: true,
          ticks: { font: { size: 11 } },
        },
      },
    },
  })
}

export async function renderSentimentTrend(
  data: { date: string; positive: number; negative: number; neutral: number }[]
): Promise<Buffer> {
  return renderChart({
    type: 'line',
    data: {
      labels: data.map(d => d.date),
      datasets: [
        {
          label: 'Positive',
          data: data.map(d => d.positive),
          borderColor: '#22c55e',
          backgroundColor: 'rgba(34,197,94,0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 3,
          pointBackgroundColor: '#22c55e',
        },
        {
          label: 'Negative',
          data: data.map(d => d.negative),
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239,68,68,0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 3,
          pointBackgroundColor: '#ef4444',
        },
        {
          label: 'Neutral',
          data: data.map(d => d.neutral),
          borderColor: '#94a3b8',
          backgroundColor: 'rgba(148,163,184,0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 3,
          pointBackgroundColor: '#94a3b8',
        },
      ],
    },
    options: {
      plugins: {
        title: { display: true, text: 'Sentiment Trend', font: { size: 14, weight: 'bold' } },
        legend: { position: 'bottom', labels: { font: { size: 11 }, usePointStyle: true, padding: 12 } },
      },
      scales: {
        x: {
          grid: { color: '#e2e8f0' },
          ticks: { font: { size: 10 }, maxRotation: 45 },
        },
        y: {
          grid: { color: '#e2e8f0' },
          beginAtZero: true,
          ticks: { font: { size: 11 } },
        },
      },
    },
  })
}
