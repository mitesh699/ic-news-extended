import { MCPClient } from '@mastra/mcp'
import type { Tool } from '@mastra/core/tools'

let toolsCache: Record<string, Tool<any, any, any, any>> | null = null
let mcpInstance: MCPClient | null = null

function getClient(): MCPClient | null {
  if (mcpInstance) return mcpInstance
  if (!process.env.SLACK_BOT_TOKEN) return null
  mcpInstance = new MCPClient({
    id: 'slack-mcp',
    servers: {
      slack: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-slack'],
        env: { SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN },
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
    console.warn('Slack MCP tools unavailable:', err instanceof Error ? err.message : String(err))
    return {}
  }
}
