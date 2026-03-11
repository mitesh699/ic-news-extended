import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

const MAX_URL_BYTES = 16_384

export const generateChart = createTool({
  id: 'generate-chart',
  description:
    'Builds a QuickChart.io URL from a Chart.js configuration. Returns a URL that renders the chart as a PNG image.',
  inputSchema: z.object({
    type: z.enum(['bar', 'line', 'pie', 'doughnut']),
    labels: z.array(z.string()),
    data: z.array(z.number()),
    title: z.string().optional(),
  }),
  execute: async (inputData) => {
    const chartConfig = {
      type: inputData.type,
      data: {
        labels: inputData.labels,
        datasets: [
          {
            label: inputData.title || 'Data',
            data: inputData.data,
          },
        ],
      },
      options: {
        ...(inputData.title && {
          plugins: {
            title: { display: true, text: inputData.title },
          },
        }),
      },
    }

    const encoded = encodeURIComponent(JSON.stringify(chartConfig))
    const url = `https://quickchart.io/chart?c=${encoded}`

    if (Buffer.byteLength(url, 'utf8') > MAX_URL_BYTES) {
      return { url: '', error: `URL exceeds ${MAX_URL_BYTES} byte limit (${Buffer.byteLength(url, 'utf8')} bytes)` }
    }

    return { url }
  },
})
