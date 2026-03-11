import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

export const sendEmail = createTool({
  id: 'send-email',
  description:
    'Sends an email via the Resend API. Requires RESEND_API_KEY to be set. Returns the message ID on success.',
  inputSchema: z.object({
    to: z.string().email(),
    subject: z.string(),
    html: z.string(),
  }),
  execute: async (inputData) => {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      return { sent: false, error: 'RESEND_API_KEY not configured' }
    }

    const from = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          from,
          to: inputData.to,
          subject: inputData.subject,
          html: inputData.html,
        }),
      })

      if (!res.ok) {
        const body = await res.text()
        return { sent: false, error: `Resend API ${res.status}: ${body}` }
      }

      const data = (await res.json()) as { id: string }
      return { sent: true, id: data.id }
    } catch (err) {
      return { sent: false, error: err instanceof Error ? err.message : String(err) }
    }
  },
})
