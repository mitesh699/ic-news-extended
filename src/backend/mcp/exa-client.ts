import { MCPClient } from '@mastra/mcp'
import type { Tool } from '@mastra/core/tools'

let toolsCache: Record<string, Tool<any, any, any, any>> | null = null
let mcpInstance: MCPClient | null = null

function getClient(): MCPClient | null {
  if (mcpInstance) return mcpInstance
  if (!process.env.EXA_API_KEY) return null
  mcpInstance = new MCPClient({
    id: 'exa-mcp',
    servers: {
      exa: {
        url: new URL('https://mcp.exa.ai/mcp'),
        requestInit: {
          headers: { Authorization: `Bearer ${process.env.EXA_API_KEY}` },
        },
      },
    },
  })
  return mcpInstance
}

export async function getExaTools(): Promise<Record<string, Tool<any, any, any, any>>> {
  if (toolsCache) return toolsCache
  const client = getClient()
  if (!client) return {}
  try {
    toolsCache = await client.listTools()
    return toolsCache
  } catch (err) {
    console.warn('Exa MCP tools unavailable:', err instanceof Error ? err.message : String(err))
    return {}
  }
}
