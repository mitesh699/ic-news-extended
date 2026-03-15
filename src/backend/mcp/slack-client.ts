import { MCPClient } from '@mastra/mcp'
import type { Tool } from '@mastra/core/tools'
import path from 'path'

let toolsCache: Record<string, Tool<any, any, any, any>> | null = null
let mcpInstance: MCPClient | null = null

function getClient(): MCPClient | null {
  if (mcpInstance) return mcpInstance
  if (!process.env.SLACK_BOT_TOKEN) return null

  const serverPath = path.resolve(__dirname, 'slack-server.ts')

  mcpInstance = new MCPClient({
    id: 'slack-mcp',
    servers: {
      slack: {
        command: 'npx',
        args: ['tsx', serverPath],
        env: {
          SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN,
          SLACK_DIGEST_CHANNEL_ID: process.env.SLACK_DIGEST_CHANNEL_ID ?? '',
        },
      },
    },
  })
  return mcpInstance
}

export async function getSlackTools(): Promise<Record<string, Tool<any, any, any, any>>> {
  if (toolsCache) return toolsCache
  const client = getClient()
  if (!client) return {}
  try {
    toolsCache = await client.listTools()
    return toolsCache
  } catch (err) {
    console.warn('[slack] MCP tools unavailable:', err instanceof Error ? err.message : String(err))
    return {}
  }
}
