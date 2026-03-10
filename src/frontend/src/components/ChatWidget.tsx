import { useState, useRef, useEffect, useMemo } from "react";
import { MessageCircle, X, Send, Bot, AlertCircle, RotateCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { sendChatMessage } from "@/lib/api";
import { useCompanies } from "@/hooks/useCompanies";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isError?: boolean;
}

function renderInlineMarkdown(text: string) {
  // Split on bold (**text**), links [text](url), and inline code (`text`)
  const parts = text.split(/(\*\*.*?\*\*|\[.*?\]\(.*?\)|`.*?`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-bold">{part.slice(2, -2)}</strong>;
    }
    const linkMatch = part.match(/^\[(.*?)\]\((.*?)\)$/);
    if (linkMatch) {
      return (
        <a key={i} href={linkMatch[2]} target="_blank" rel="noopener noreferrer"
          className="text-accent underline underline-offset-2 hover:text-accent/80 transition-colors">
          {linkMatch[1]}
        </a>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={i} className="text-[11px] bg-foreground/[0.06] px-1 py-0.5 rounded">{part.slice(1, -1)}</code>;
    }
    // Also detect bare URLs
    return <span key={i}>{part.split(/(https?:\/\/[^\s]+)/g).map((seg, j) =>
      seg.match(/^https?:\/\//) ? (
        <a key={j} href={seg} target="_blank" rel="noopener noreferrer"
          className="text-accent underline underline-offset-2 hover:text-accent/80 transition-colors break-all">
          {new URL(seg).hostname.replace("www.", "")}
        </a>
      ) : seg
    )}</span>;
  });
}

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

    try {
      const response = await sendChatMessage(text.trim());
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: "assistant",
        content: response,
        timestamp: new Date(),
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
            className="fixed bottom-6 right-6 z-50 w-[380px] h-[540px] glass-card shadow-chat flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50 mb-1">Intelligence</p>
                <p className="text-[15px] font-bold tracking-[-0.02em] text-foreground">Portfolio AI</p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                aria-label="Close chat"
                className="h-8 w-8 hover:bg-foreground/[0.05] flex items-center justify-center transition-colors focus-visible:ring-2 focus-visible:ring-foreground/20"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
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
                    {msg.content.split("\n").map((line, i) => (
                      <p key={i} className={cn(i > 0 && "mt-1.5", line.startsWith("- ") && "pl-3", msg.isError && "text-destructive")}>
                        {line.startsWith("- ") ? "• " : ""}
                        {renderInlineMarkdown(line.replace(/^- /, ""))}
                      </p>
                    ))}
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
                  </div>
                </motion.div>
              ))}

              {isTyping && (
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
