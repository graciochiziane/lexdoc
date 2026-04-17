// ═══════════════════════════════════════════════════════════════
// LEXDOC — Painel de Chat IA (LexAssistent)
// Chat flutuante com glassmorphism, prompts rápidos, animações
// ═══════════════════════════════════════════════════════════════

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot,
  X,
  Send,
  Trash2,
  Sparkles,
  MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
// ScrollArea removed — using native overflow instead for chat messages
import { Badge } from '@/components/ui/badge';
import { aiApi } from '@/lib/api-client';
import { MarkdownContent } from '@/components/shared/MarkdownRenderer';

// ─────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
  timestamp: Date;
}

// ─────────────────────────────────────────
// Prompts rápidos
// ─────────────────────────────────────────
const QUICK_PROMPTS = [
  {
    label: 'Calcular prazo processual',
    prompt: 'Como calcular prazo processual?',
    icon: '⏱️',
  },
  {
    label: 'Draftar petição inicial',
    prompt: 'Draftar uma petição inicial',
    icon: '📝',
  },
  {
    label: 'Código Civil Moçambicano',
    prompt: 'Explicar o Código Civil Moçambicano',
    icon: '📚',
  },
  {
    label: 'Lei do Trabalho',
    prompt: 'Principais alterações da Lei do Trabalho',
    icon: '⚖️',
  },
];

// ─────────────────────────────────────────
// Indicador de digitação (typing)
// ─────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <Avatar className="size-8 shrink-0">
        <AvatarFallback className="bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 text-xs font-bold">
          LA
        </AvatarFallback>
      </Avatar>
      <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm bg-muted/60 px-4 py-3">
        <motion.span
          className="size-2 rounded-full bg-emerald-400"
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
        />
        <motion.span
          className="size-2 rounded-full bg-emerald-400"
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: 0.15 }}
        />
        <motion.span
          className="size-2 rounded-full bg-emerald-400"
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: 0.3 }}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────
export function AIChatPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Scroll para o fundo quando há novas mensagens ──
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  // ── Focus no textarea ao abrir ──
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 300);
    }
  }, [isOpen]);

  // ── Enviar mensagem ──
  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      setError(null);

      // Adicionar mensagem do utilizador
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: trimmed,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInputValue('');
      setIsLoading(true);

      try {
        const response = await aiApi.chat({ message: trimmed });

        if (response.success && response.data) {
          const assistantMessage: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: response.data.message,
            sources: response.data.sources,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, assistantMessage]);
        } else {
          setError(response.error?.message ?? 'Erro ao comunicar com o assistente.');
        }
      } catch {
        setError('Erro de conexão. Verifique a sua internet e tente novamente.');
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading],
  );

  // ── Handler do formulário ──
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      void sendMessage(inputValue);
    },
    [inputValue, sendMessage],
  );

  // ── Handler do Enter (Shift+Enter para nova linha) ──
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void sendMessage(inputValue);
      }
    },
    [inputValue, sendMessage],
  );

  // ── Limpar conversa ──
  const handleClearChat = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  // ── Quick prompt click ──
  const handleQuickPrompt = useCallback(
    (prompt: string) => {
      void sendMessage(prompt);
    },
    [sendMessage],
  );

  return (
    <>
      {/* ── Botão flutuante (acima do FAB) ── */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-24 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-xl shadow-emerald-500/25 flex items-center justify-center print:hidden group"
            aria-label="Abrir assistente IA"
          >
            <Bot className="size-6 group-hover:scale-110 transition-transform" />
            {/* Badge indicador */}
            <span className="absolute -top-1 -right-1 flex size-4">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
              <span className="relative inline-flex size-4 rounded-full bg-emerald-400 border-2 border-background" />
            </span>
            {/* Tooltip */}
            <motion.span
              initial={{ opacity: 0, x: 4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 4 }}
              className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-popover text-popover-foreground shadow-md rounded-md px-2.5 py-1 text-xs font-medium border whitespace-nowrap hidden sm:block"
            >
              LexAssistent
            </motion.span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Painel de Chat ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
            className="fixed bottom-6 right-6 z-50 flex flex-col
              w-[calc(100vw-3rem)] sm:w-[420px] h-[min(600px,calc(100vh-8rem))]
              rounded-2xl overflow-hidden
              bg-background/80 backdrop-blur-xl
              border border-border/60
              shadow-2xl shadow-black/10
              print:hidden"
          >
            {/* ── Header ── */}
            <div className="relative flex items-center justify-between px-4 py-3 border-b border-border/50 bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Avatar className="size-10">
                    <AvatarFallback className="bg-gradient-to-br from-emerald-400 to-teal-500 text-white text-sm font-bold">
                      LA
                    </AvatarFallback>
                  </Avatar>
                  <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-emerald-400 border-2 border-background" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <Sparkles className="size-3.5 text-emerald-500" />
                      LexAssistent
                    </h3>
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/30">
                      IA
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Assistente jurídico virtual
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10 active:scale-[0.95]"
                  onClick={handleClearChat}
                  title="Limpar conversa"
                  disabled={messages.length === 0}
                >
                  <Trash2 className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-foreground hover:bg-foreground/5 active:scale-[0.95]"
                  onClick={() => setIsOpen(false)}
                  title="Fechar chat"
                >
                  <X className="size-4" />
                </Button>
              </div>
            </div>

            {/* ── Área de mensagens ── */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto"
            >
                <div className="flex flex-col">
                  {/* Estado vazio — Prompts rápidos */}
                  {messages.length === 0 && !isLoading && (
                    <div className="flex flex-col items-center justify-center p-6 text-center flex-1">
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 flex items-center justify-center mb-4"
                      >
                        <MessageSquare className="size-7 text-emerald-600 dark:text-emerald-400" />
                      </motion.div>
                      <motion.h4
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.15 }}
                        className="text-sm font-semibold text-foreground mb-1"
                      >
                        Olá! Sou o LexAssistent
                      </motion.h4>
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="text-xs text-muted-foreground mb-6 max-w-[280px]"
                      >
                        O seu assistente jurídico virtual para direito moçambicano. Como posso ajudar?
                      </motion.p>

                      {/* Quick prompts */}
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.25 }}
                        className="w-full space-y-2"
                      >
                        {QUICK_PROMPTS.map((qp) => (
                          <button
                            key={qp.prompt}
                            onClick={() => handleQuickPrompt(qp.prompt)}
                            className="w-full flex items-center gap-3 rounded-xl border border-border/50 bg-muted/30 hover:bg-muted/60 hover:border-emerald-300/50 dark:hover:border-emerald-700/50 px-3.5 py-2.5 text-left transition-all duration-200 active:scale-[0.98] group"
                          >
                            <span className="text-lg shrink-0">{qp.icon}</span>
                            <span className="text-xs font-medium text-foreground/80 group-hover:text-foreground transition-colors">
                              {qp.label}
                            </span>
                          </button>
                        ))}
                      </motion.div>
                    </div>
                  )}

                  {/* Mensagens */}
                  {messages.map((msg) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      className={`flex items-start gap-3 px-4 py-3 ${
                        msg.role === 'user' ? 'flex-row-reverse' : ''
                      }`}
                    >
                      {/* Avatar */}
                      {msg.role === 'assistant' ? (
                        <Avatar className="size-8 shrink-0 mt-0.5">
                          <AvatarFallback className="bg-gradient-to-br from-emerald-400 to-teal-500 text-white text-[10px] font-bold">
                            LA
                          </AvatarFallback>
                        </Avatar>
                      ) : (
                        <Avatar className="size-8 shrink-0 mt-0.5">
                          <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">
                            EU
                          </AvatarFallback>
                        </Avatar>
                      )}

                      {/* Content */}
                      <div
                        className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed break-words overflow-hidden ${
                          msg.role === 'user'
                            ? 'bg-primary text-primary-foreground rounded-tr-sm whitespace-pre-wrap'
                            : 'bg-muted/60 text-foreground rounded-tl-sm'
                        }`}
                      >
                        {msg.role === 'user' ? (
                          msg.content
                        ) : (
                          <MarkdownContent>{msg.content}</MarkdownContent>
                        )}
                      </div>
                    </motion.div>
                  ))}

                  {/* Sources */}
                  {messages.length > 0 && messages[messages.length - 1]?.role === 'assistant' && messages[messages.length - 1]?.sources && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="px-4 pb-2"
                    >
                      <div className="flex flex-wrap gap-1.5 ml-11">
                        {messages[messages.length - 1].sources!.map((source, i) => (
                          <Badge
                            key={i}
                            variant="outline"
                            className="text-[9px] px-1.5 py-0 h-4 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20"
                          >
                            {source}
                          </Badge>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* Typing indicator */}
                  {isLoading && <TypingIndicator />}

                  {/* Error */}
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="px-4 pb-2"
                    >
                      <div className="ml-11 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/50 px-3 py-2 text-xs text-red-600 dark:text-red-400">
                        {error}
                      </div>
                    </motion.div>
                  )}

                  {/* Ref para scroll */}
                  <div ref={messagesEndRef} />
                </div>
            </div>

            {/* ── Input area ── */}
            <div className="border-t border-border/50 bg-background/60 backdrop-blur-sm px-3 py-3">
              <form onSubmit={handleSubmit} className="relative">
                <Textarea
                  ref={textareaRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Escreva a sua pergunta..."
                  disabled={isLoading}
                  rows={1}
                  style={{ fieldSizing: 'fixed' }}
                  className="resize-none overflow-y-auto rounded-xl border-border/60 bg-muted/30 pr-12 min-h-[42px] max-h-[120px] text-sm placeholder:text-muted-foreground/50 focus-visible:ring-emerald-500/30 focus-visible:border-emerald-400/50"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!inputValue.trim() || isLoading}
                  className="absolute right-2 bottom-2 size-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-md disabled:opacity-40 disabled:shadow-none transition-all active:scale-[0.92]"
                >
                  <Send className="size-3.5" />
                </Button>
              </form>
              <p className="text-[9px] text-muted-foreground/50 mt-2 text-center">
                LexAssistent pode cometer erros. Verifique informações importantes.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
