import { useState, useRef, useEffect, useMemo } from "react";
import { MessageCircle, X, Send, Bot, AlertCircle, RotateCw, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { sendChatMessage, streamChatMessage } from "@/lib/api";
import { useCompanies } from "@/hooks/useCompanies";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isError?: boolean;
  followUps?: string[];
}

const markdownComponents = {
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="text-[15px] font-bold tracking-[-0.02em] text-foreground mt-3 mb-1.5 first:mt-0">{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="text-[14px] font-bold tracking-[-0.01em] text-foreground mt-3 mb-1 first:mt-0">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="text-[13px] font-bold text-foreground/90 mt-2 mb-0.5 first:mt-0">{children}</h3>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="mt-1.5 first:mt-0 leading-[1.6]">{children}</p>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-bold text-foreground">{children}</strong>
  ),
  em: ({ children }: { children?: React.ReactNode }) => (
    <em className="italic text-foreground/80">{children}</em>
  ),
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="text-accent underline underline-offset-2 hover:text-accent/80 transition-colors break-all">
      {children}
    </a>
  ),
  code: ({ children }: { children?: React.ReactNode }) => (
    <code className="text-[11px] bg-foreground/[0.06] px-1 py-0.5 rounded font-mono">{children}</code>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="mt-1 space-y-0.5 pl-0">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="mt-1 space-y-0.5 pl-4 list-decimal">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="text-[13px] leading-[1.55] pl-1 before:content-['•'] before:mr-1.5 before:text-muted-foreground/40 before:text-[10px]">{children}</li>
  ),
  hr: () => (
    <hr className="my-2.5 border-border/30" />
  ),
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="overflow-x-auto mt-2 mb-1 -mx-1">
      <table className="w-full text-[11px] border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }: { children?: React.ReactNode }) => (
    <thead className="border-b border-border/40">{children}</thead>
  ),
  tbody: ({ children }: { children?: React.ReactNode }) => (
    <tbody className="divide-y divide-border/20">{children}</tbody>
  ),
  tr: ({ children }: { children?: React.ReactNode }) => (
    <tr>{children}</tr>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="text-left font-bold text-foreground/80 px-2 py-1.5 text-[10px] uppercase tracking-[0.08em]">{children}</th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="px-2 py-1.5 text-foreground/70">{children}</td>
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="border-l-2 border-accent/40 pl-3 my-1.5 text-foreground/60 italic">{children}</blockquote>
  ),
} as Record<string, React.ComponentType<Record<string, unknown>>>

export function ChatWidget() {
  const { data: companies } = useCompanies();

  // Pick a random company with recent articles for the suggestion
  const dynamicSuggestions = useMemo(() => {
    const withArticles = companies?.filter(c => c.newsArticles.length > 0) || [];
    const picked = withArticles.length > 0
      ? withArticles[Math.floor(Math.random() * withArticles.length)].name
      : "Opendoor";
    return [
      `Latest news on ${picked}?`,
      "Negative coverage recap",
      "Any AI sector news?",
      "Breaking this week",
    ];
  }, [companies]);
  const [isOpen, setIsOpen] = useState(false);
  const [agentMode, setAgentMode] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Portfolio intelligence at your fingertips. Ask about company news, coverage signals, or trends.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [activeToolCall, setActiveToolCall] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const streamingMsgId = useRef<string | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text.trim(),
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);
    setActiveToolCall(null);

    const history = messages
      .filter(m => m.id !== "welcome" && !m.isError)
      .map(m => ({ role: m.role, content: m.content }))
      .slice(-10);

    if (agentMode) {
      // Streaming agent mode
      const msgId = crypto.randomUUID();
      streamingMsgId.current = msgId;

      // Add empty assistant message that we'll fill progressively
      setMessages(prev => [...prev, {
        id: msgId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
      }]);

      try {
        await streamChatMessage(
          text.trim(),
          {
            onToken: (token) => {
              setMessages(prev =>
                prev.map(m => m.id === msgId ? { ...m, content: m.content + token } : m)
              );
            },
            onToolCall: (toolName) => {
              const label = toolName.replace(/_/g, ' ');
              setActiveToolCall(label);
            },
            onToolResult: () => {
              setActiveToolCall(null);
            },
            onDone: (followUps) => {
              setMessages(prev =>
                prev.map(m => m.id === msgId ? { ...m, followUps } : m)
              );
              setIsTyping(false);
              setActiveToolCall(null);
              streamingMsgId.current = null;
            },
            onError: (error) => {
              setMessages(prev =>
                prev.map(m => m.id === msgId ? { ...m, content: m.content || `Error: ${error}`, isError: !m.content } : m)
              );
              setIsTyping(false);
              setActiveToolCall(null);
              streamingMsgId.current = null;
            },
          },
          history.length > 0 ? history : undefined,
        );
      } catch {
        setMessages(prev =>
          prev.map(m => m.id === msgId ? { ...m, content: "Something went wrong — couldn't reach the server.", isError: true } : m)
        );
        setIsTyping(false);
        setActiveToolCall(null);
        streamingMsgId.current = null;
      }
    } else {
      // Basic mode — non-streaming
      try {
        const data = await sendChatMessage(text.trim(), undefined, history.length > 0 ? history : undefined, false);
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.response,
          timestamp: new Date(),
          followUps: data.followUps,
        }]);
      } catch {
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Something went wrong — couldn't reach the server.",
          timestamp: new Date(),
          isError: true,
        }]);
      } finally {
        setIsTyping(false);
      }
    }
  };

  return (
    <>
      {/* FAB */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="fixed bottom-6 right-6 z-50"
          >
            <button
              onClick={() => setIsOpen(true)}
              aria-label="Open portfolio chat"
              className="h-12 w-12 bg-foreground text-background shadow-chat-button flex items-center justify-center hover:scale-105 active:scale-95 transition-transform glow-accent focus-visible:ring-2 focus-visible:ring-foreground/20"
            >
              <MessageCircle className="h-5 w-5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed bottom-6 right-6 z-50 w-[480px] h-[700px] glass-card shadow-chat flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50 mb-1">Intelligence</p>
                <p className="text-[15px] font-bold tracking-[-0.02em] text-foreground">Portfolio AI</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAgentMode(!agentMode)}
                  aria-label={agentMode ? "Disable agent mode" : "Enable agent mode"}
                  title={agentMode ? "Agent mode: ON — tools + web search" : "Agent mode: OFF — fast context-only"}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.08em] border transition-all",
                    agentMode
                      ? "border-accent/60 bg-accent/10 text-accent"
                      : "border-border/50 bg-transparent text-muted-foreground/50 hover:border-border hover:text-muted-foreground"
                  )}
                >
                  <Zap className={cn("h-3 w-3", agentMode && "fill-accent/30")} />
                  Agent
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  aria-label="Close chat"
                  className="h-8 w-8 hover:bg-foreground/[0.05] flex items-center justify-center transition-colors focus-visible:ring-2 focus-visible:ring-foreground/20"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 custom-scrollbar">
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className={cn(
                    msg.role === "user" ? "flex justify-end" : "flex justify-start"
                  )}
                >
                  {msg.role === "assistant" && (
                    <div className={cn(
                      "h-6 w-6 border flex items-center justify-center mr-2 mt-0.5 shrink-0",
                      msg.isError ? "border-destructive/40" : "border-border/60"
                    )}>
                      {msg.isError
                        ? <AlertCircle className="h-3 w-3 text-destructive/70" />
                        : <Bot className="h-3 w-3 text-foreground/60" />}
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[82%] px-3.5 py-2.5 text-[13px] leading-[1.6]",
                      msg.role === "user"
                        ? "chat-bubble-user"
                        : msg.isError
                          ? "chat-bubble-ai border border-destructive/30 bg-destructive/5"
                          : "chat-bubble-ai border border-border/30"
                    )}
                  >
                    {msg.role === "assistant" && !msg.isError ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                        {msg.content}
                      </ReactMarkdown>
                    ) : (
                      <p className={cn(msg.isError && "text-destructive")}>{msg.content}</p>
                    )}
                    {msg.isError && (
                      <button
                        onClick={() => {
                          const lastUserMsg = [...messages].reverse().find(m => m.role === "user");
                          if (lastUserMsg) {
                            setMessages(prev => prev.filter(m => m.id !== msg.id));
                            sendMessage(lastUserMsg.content);
                          }
                        }}
                        className="flex items-center gap-1.5 mt-2 text-[10px] font-bold uppercase tracking-[0.1em] text-destructive/70 hover:text-destructive transition-colors"
                      >
                        <RotateCw className="h-3 w-3" />
                        Retry
                      </button>
                    )}
                    {msg.followUps && msg.followUps.length > 0 && !isTyping && (
                      <div className="flex flex-wrap gap-1 mt-2.5 pt-2 border-t border-border/20">
                        {msg.followUps.map((s) => (
                          <button
                            key={s}
                            onClick={() => sendMessage(s)}
                            className="text-[8px] font-bold uppercase tracking-[0.08em] text-accent/70 hover:text-accent border border-accent/20 hover:border-accent/40 bg-transparent px-2 py-1 transition-colors"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}

              {isTyping && !streamingMsgId.current && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-2"
                >
                  <div className="h-6 w-6 border border-border/60 flex items-center justify-center shrink-0">
                    <Bot className="h-3 w-3 text-foreground/60" />
                  </div>
                  <div className="chat-bubble-ai border border-border/30 px-4 py-3">
                    <div className="flex gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                </motion.div>
              )}
              {activeToolCall && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-2 px-2 py-1"
                >
                  <div className="h-3 w-3 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                  <span className="text-[10px] text-accent/70 mono uppercase tracking-[0.1em]">
                    {activeToolCall}...
                  </span>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Suggestions */}
            {messages.length <= 1 && (
              <div className="px-5 pb-3 flex flex-wrap gap-1.5">
                {dynamicSuggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground border border-border/60 hover:border-foreground/30 hover:text-foreground bg-transparent px-3 py-1.5 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="p-4 border-t border-border/40">
              <form
                onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
                className="flex items-center gap-2"
              >
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about portfolio news…"
                  aria-label="Type your question"
                  className="flex-1 h-10 bg-foreground/[0.03] border border-border/50 px-3.5 text-[13px] text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-foreground/30 focus-visible:ring-2 focus-visible:ring-foreground/20 transition-colors"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!input.trim() || isTyping}
                  className="h-10 w-10 shrink-0 rounded-none"
                >
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
