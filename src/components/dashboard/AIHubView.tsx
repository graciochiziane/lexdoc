// ═══════════════════════════════════════════════════════════════
// LEXDOC — Centro de Inteligência Artificial (AI Hub View)
// Full-page AI command center with 4 tabs: Chat, Gerar Doc, Extrair Prazos, Histórico
// ═══════════════════════════════════════════════════════════════

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot,
  Send,
  Trash2,
  Sparkles,
  MessageSquare,
  FileText,
  Clock,
  History,
  Plus,
  Search,
  Copy,
  Download,
  Check,
  ChevronDown,
  AlertCircle,
  Loader2,
  CalendarClock,
  ArrowRight,
  FilePlus,
  Briefcase,
  Eye,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { aiApi, processesApi } from '@/lib/api-client';
import type { ConversationSummary, ConversationMessage, ExtractedDeadline, GenerationRecord } from '@/lib/api-client';
import { MarkdownContent } from '@/components/shared/MarkdownRenderer';

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
  knowledge_articles_used?: Array<{ id: string; title: string; category: string }>;
  timestamp: Date;
  isStreaming?: boolean;
}

const QUICK_PROMPTS = [
  { label: 'Calcular prazo processual', prompt: 'Como calcular prazo processual?', icon: '⏱️' },
  { label: 'Draftar petição inicial', prompt: 'Draftar uma petição inicial', icon: '📝' },
  { label: 'Código Civil Moçambicano', prompt: 'Explicar o Código Civil Moçambicano', icon: '📚' },
  { label: 'Lei do Trabalho', prompt: 'Principais alterações da Lei do Trabalho', icon: '⚖️' },
];

const DOC_TYPES = [
  { value: 'contract', label: 'Contrato' },
  { value: 'petition', label: 'Petição' },
  { value: 'peticao-inicial', label: 'Petição Inicial' },
  { value: 'contestacao', label: 'Contestação' },
  { value: 'contrato-trabalho', label: 'Contrato de Trabalho' },
  { value: 'procuracao', label: 'Procuração Forense' },
  { value: 'legal_opinion', label: 'Parecer Jurídico' },
  { value: 'notificacao', label: 'Notificação' },
  { value: 'requerimento', label: 'Requerimento' },
  { value: 'recurso', label: 'Recurso' },
  { value: 'summary', label: 'Resumo Jurídico' },
  { value: 'custom_document', label: 'Personalizado' },
];

const TYPE_BADGE_COLORS: Record<string, string> = {
  contract: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  petition: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  'peticao-inicial': 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  contestacao: 'bg-red-500/15 text-red-400 border-red-500/25',
  'contrato-trabalho': 'bg-cyan-500/15 text-cyan-400 border-cyan-500/25',
  procuracao: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/25',
  legal_opinion: 'bg-violet-500/15 text-violet-400 border-violet-500/25',
  notificacao: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  requerimento: 'bg-teal-500/15 text-teal-400 border-teal-500/25',
  recurso: 'bg-rose-500/15 text-rose-400 border-rose-500/25',
  summary: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25',
  custom_document: 'bg-gray-500/15 text-gray-400 border-gray-500/25',
};

const TYPE_LABELS: Record<string, string> = {
  contract: 'Contrato',
  petition: 'Petição',
  'peticao-inicial': 'Petição Inicial',
  contestacao: 'Contestação',
  'contrato-trabalho': 'Contrato de Trabalho',
  procuracao: 'Procuração Forense',
  legal_opinion: 'Parecer Jurídico',
  notificacao: 'Notificação',
  requerimento: 'Requerimento',
  recurso: 'Recurso',
  summary: 'Resumo Jurídico',
  custom_document: 'Personalizado',
};

// ─────────────────────────────────────────
// Shared utility: strip markdown for preview text
// ─────────────────────────────────────────
function stripMarkdown(text: unknown): string {
  if (text == null) return '';
  const raw = typeof text === 'string' ? text : (typeof text === 'object' && text !== null && 'content' in text ? String((text as { content: unknown }).content) : String(text));
  return raw
    .replace(/\*\*\[QUEST[ÃA]O\]\*\*\s*/gi, '')
    .replace(/\*\*/g, '')
    .replace(/#{1,6}\s/g, '')
    .replace(/```[\s\S]*?```/g, '[código]')
    .replace(/`[^`]+`/g, (match) => match.slice(1, -1))
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/---/g, '')
    .replace(/\n{2,}/g, ' ')
    .replace(/\n/g, ' ')
    .trim();
}

// ─────────────────────────────────────────
// Typing Indicator
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
        <motion.span className="size-2 rounded-full bg-emerald-400" animate={{ y: [0, -6, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0 }} />
        <motion.span className="size-2 rounded-full bg-emerald-400" animate={{ y: [0, -6, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.15 }} />
        <motion.span className="size-2 rounded-full bg-emerald-400" animate={{ y: [0, -6, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.3 }} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// Conversation Sidebar (Desktop)
// ─────────────────────────────────────────
function ConversationSidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  searchQuery,
  onSearchChange,
  isLoading,
}: {
  conversations: ConversationSummary[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  isLoading: boolean;
}) {
  const filtered = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="flex flex-col h-full w-72 border-r bg-muted/20">
      {/* Header */}
      <div className="p-3 space-y-3">
        <Button
          onClick={onNew}
          className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-md shadow-emerald-500/20 active:scale-[0.98] transition-all"
        >
          <Plus className="size-4 mr-2" />
          Nova Conversa
        </Button>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Pesquisar conversas..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
      </div>

      <Separator />

      {/* List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {isLoading ? (
            <div className="space-y-2 p-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center px-4">
              <MessageSquare className="size-8 text-muted-foreground/40 mb-2" />
              <p className="text-xs text-muted-foreground">
                {searchQuery ? 'Nenhuma conversa encontrada.' : 'Sem conversas ainda.'}
              </p>
            </div>
          ) : (
            filtered.map((conv) => (
              <motion.button
                key={conv.id}
                onClick={() => onSelect(conv.id)}
                whileHover={{ x: 2 }}
                className={`w-full text-left rounded-lg px-3 py-2.5 transition-all duration-150 group relative ${
                  activeId === conv.id
                    ? 'bg-emerald-500/10 border border-emerald-500/20'
                    : 'hover:bg-muted/60 border border-transparent'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium truncate ${activeId === conv.id ? 'text-emerald-700 dark:text-emerald-400' : 'text-foreground'}`}>
                      {stripMarkdown(conv.title)}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                      {conv.last_message ? stripMarkdown(String(conv.last_message)) : `${conv.message_count} mensagens`}
                    </p>
                  </div>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(conv.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.stopPropagation();
                        onDelete(conv.id);
                      }
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/10 hover:text-red-500 transition-all shrink-0 cursor-pointer"
                    title="Eliminar conversa"
                  >
                    <Trash2 className="size-3" />
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground/60 mt-1">
                  {new Date(conv.updated_at).toLocaleDateString('pt-MZ', { day: '2-digit', month: 'short' })}
                </p>
              </motion.button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ─────────────────────────────────────────
// Tab 1: Assistente IA (Enhanced Chat)
// ─────────────────────────────────────────
function AssistantChatTab() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingConv, setIsLoadingConv] = useState(false);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [convSearch, setConvSearch] = useState('');
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [convContext, setConvContext] = useState<string | undefined>();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load conversations list
  const loadConversations = useCallback(async () => {
    setIsLoadingList(true);
    try {
      const res = await aiApi.listConversations();
      if (res.success && res.data) {
        setConversations(res.data as ConversationSummary[]);
      }
    } catch {
      // silently fail — conversations are optional
    } finally {
      setIsLoadingList(false);
    }
  }, []);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  // Load conversation messages
  const loadConversation = useCallback(async (id: string) => {
    setIsLoadingConv(true);
    setActiveConvId(id);
    setError(null);
    try {
      const res = await aiApi.getConversation(id);
      if (res.success && res.data) {
        const detail = res.data as unknown as { messages: Array<Record<string, unknown>>; context?: string; title?: string; context_type?: string; context_id?: string };
        setConvContext(detail.context);
        const rawMessages = detail.messages ?? [];
        if (rawMessages.length === 0) {
          setMessages([]);
        } else {
          setMessages(
            rawMessages.map((m) => {
              // Safely extract sources — could be string[] or null
              let sources: string[] | undefined;
              if (Array.isArray(m.sources)) {
                sources = m.sources.filter((s): s is string => typeof s === 'string');
              }
              return {
                id: String(m.id ?? ''),
                role: (m.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
                content: String(m.content ?? ''),
                sources,
                knowledge_articles_used: undefined,
                timestamp: new Date(String(m.created_at ?? Date.now())),
              };
            }),
          );
        }
      } else {
        setError(res.error?.message ?? 'Erro ao carregar conversa.');
      }
    } catch (err) {
      console.error('[AIHub] loadConversation error:', err);
      setError('Erro de conexão ao carregar a conversa.');
    } finally {
      setIsLoadingConv(false);
    }
  }, []);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // New conversation
  const handleNewConversation = useCallback(() => {
    setActiveConvId(null);
    setMessages([]);
    setError(null);
    setConvContext(undefined);
  }, []);

  // Delete conversation
  const handleDeleteConversation = useCallback(async (id: string) => {
    try {
      await aiApi.deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConvId === id) {
        handleNewConversation();
      }
    } catch {
      // silently fail
    }
  }, [activeConvId, handleNewConversation]);

  // Send message (STREAMING)
  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    setError(null);
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    };
    const asstId = crypto.randomUUID();
    const asstMsg: ChatMessage = {
      id: asstId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    };
    setMessages((prev) => [...prev, userMsg, asstMsg]);
    setInputValue('');
    setIsLoading(true);

    let fullContent = '';
    let sources: string[] = [];

    try {
      for await (const event of aiApi.chatStream({
        message: trimmed,
        conversation_id: activeConvId ?? undefined,
      })) {
        if (event.type === 'init') {
          if (event.conversation_id && !activeConvId) {
            setActiveConvId(event.conversation_id);
            void loadConversations();
          }
          if (event.sources) sources = event.sources;
        } else if (event.type === 'chunk') {
          fullContent += event.content;
          setMessages((prev) => prev.map((m) => m.id === asstId ? { ...m, content: fullContent } : m));
        } else if (event.type === 'done') {
          fullContent = event.full_content || fullContent;
          setMessages((prev) => prev.map((m) => m.id === asstId ? { ...m, content: fullContent, isStreaming: false, sources } : m));
        } else if (event.type === 'error') {
          setError(event.message || 'Erro ao gerar resposta.');
          setMessages((prev) => prev.map((m) => m.id === asstId ? { ...m, isStreaming: false, content: fullContent || 'Não foi possível gerar resposta.' } : m));
        }
      }
      // Fallback: marcar streaming como terminado
      setMessages((prev) => prev.map((m) => m.id === asstId ? { ...m, isStreaming: false, sources: m.sources?.length ? m.sources : (sources.length ? sources : undefined) } : m));
    } catch {
      setError('Erro de conexão. Verifique a sua internet e tente novamente.');
      setMessages((prev) => prev.map((m) => m.id === asstId ? { ...m, isStreaming: false, content: fullContent || 'Erro de conexão.' } : m));
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, activeConvId, loadConversations]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    void sendMessage(inputValue);
  }, [inputValue, sendMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(inputValue);
    }
  }, [inputValue, sendMessage]);

  const handleQuickPrompt = useCallback((prompt: string) => {
    void sendMessage(prompt);
  }, [sendMessage]);

  const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;

  return (
    <div className="flex h-full min-h-[300px] rounded-xl border bg-card shadow-sm overflow-hidden">
      {/* Mobile conversation selector */}
      <div className="md:hidden p-3 border-b">
        <Button
          variant="outline"
          className="w-full justify-between"
          onClick={() => setMobileSheetOpen(true)}
        >
          <span className="flex items-center gap-2">
            <MessageSquare className="size-4" />
            {activeConvId ? conversations.find((c) => c.id === activeConvId)?.title ?? 'Conversa activa' : 'Nova conversa'}
          </span>
          <ChevronDown className="size-4" />
        </Button>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <ConversationSidebar
          conversations={conversations}
          activeId={activeConvId}
          onSelect={(id) => void loadConversation(id)}
          onNew={handleNewConversation}
          onDelete={(id) => void handleDeleteConversation(id)}
          searchQuery={convSearch}
          onSearchChange={setConvSearch}
          isLoading={isLoadingList}
        />
      </div>

      {/* Mobile Sheet */}
      <Sheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
        <SheetContent side="left" className="p-0 w-80">
          <SheetHeader className="p-3 pb-0">
            <SheetTitle className="text-sm">Conversas</SheetTitle>
          </SheetHeader>
          <div className="mt-2 h-[calc(100vh-6rem)]">
            <ConversationSidebar
              conversations={conversations}
              activeId={activeConvId}
              onSelect={(id) => { void loadConversation(id); setMobileSheetOpen(false); }}
              onNew={() => { handleNewConversation(); setMobileSheetOpen(false); }}
              onDelete={(id) => void handleDeleteConversation(id)}
              searchQuery={convSearch}
              onSearchChange={setConvSearch}
              isLoading={isLoadingList}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Context indicator */}
        {convContext && (
          <div className="px-4 py-2 bg-emerald-500/5 border-b border-emerald-500/10">
            <p className="text-[11px] text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
              <Briefcase className="size-3" />
              Contexto: {convContext}
            </p>
          </div>
        )}

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto">
          {/* Empty state */}
          {messages.length === 0 && !isLoading && !isLoadingConv && (
            <div className="flex flex-col items-center justify-center p-8 text-center h-full">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
                className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 flex items-center justify-center mb-5"
              >
                <Sparkles className="size-10 text-emerald-600 dark:text-emerald-400" />
              </motion.div>
              <motion.h3
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.15 }}
                className="text-lg font-bold text-foreground mb-1"
              >
                LexAssistent
              </motion.h3>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-sm text-muted-foreground mb-8 max-w-sm"
              >
                O seu assistente jurídico virtual especializado em direito moçambicano. Como posso ajudar?
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg w-full"
              >
                {QUICK_PROMPTS.map((qp) => (
                  <button
                    key={qp.prompt}
                    onClick={() => handleQuickPrompt(qp.prompt)}
                    className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/50 hover:border-emerald-300/50 dark:hover:border-emerald-700/50 px-4 py-3 text-left transition-all duration-200 active:scale-[0.98] group"
                  >
                    <span className="text-xl shrink-0">{qp.icon}</span>
                    <span className="text-sm font-medium text-foreground/80 group-hover:text-foreground transition-colors">
                      {qp.label}
                    </span>
                    <ArrowRight className="size-3.5 ml-auto text-muted-foreground/40 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all" />
                  </button>
                ))}
              </motion.div>
            </div>
          )}

          {/* Loading conversation */}
          {isLoadingConv && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="size-8 text-emerald-500 animate-spin" />
              <p className="text-sm text-muted-foreground">A carregar conversa...</p>
            </div>
          )}

          {/* Messages */}
          {!isLoadingConv && messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex items-start gap-3 px-4 py-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              {msg.role === 'assistant' ? (
                <Avatar className="size-8 shrink-0 mt-0.5">
                  <AvatarFallback className="bg-gradient-to-br from-emerald-400 to-teal-500 text-white text-[10px] font-bold">LA</AvatarFallback>
                </Avatar>
              ) : (
                <Avatar className="size-8 shrink-0 mt-0.5">
                  <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">EU</AvatarFallback>
                </Avatar>
              )}
              <div className="max-w-[80%] space-y-2">
                <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed break-words overflow-hidden ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-tr-sm whitespace-pre-wrap'
                    : 'bg-muted/60 text-foreground rounded-tl-sm'
                }`}>
                  {msg.role === 'user' ? (
                    msg.content
                  ) : msg.isStreaming && msg.content ? (
                    <span>
                      <MarkdownContent>{msg.content}</MarkdownContent>
                      <motion.span className="inline-block w-0.5 h-4 bg-emerald-500 ml-0.5 align-middle rounded-sm" animate={{ opacity: [1, 0] }} transition={{ duration: 0.8, repeat: Infinity, ease: 'steps(2)' }} />
                    </span>
                  ) : (
                    <MarkdownContent>{msg.content}</MarkdownContent>
                  )}
                </div>
                {/* Sources */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {msg.sources.map((src, i) => (
                      <Badge key={i} variant="outline" className="text-[9px] px-1.5 py-0 h-4 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20">
                        {src}
                      </Badge>
                    ))}
                  </div>
                )}
                {/* Knowledge articles */}
                {msg.knowledge_articles_used && msg.knowledge_articles_used.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-[9px] text-muted-foreground flex items-center gap-1 mr-1">
                      <BookIcon className="size-3" /> Fontes:
                    </span>
                    {msg.knowledge_articles_used.map((article) => (
                      <Badge key={article.id} variant="outline" className="text-[9px] px-1.5 py-0 h-4 text-teal-600 dark:text-teal-400 border-teal-200 dark:border-teal-800 bg-teal-50/50 dark:bg-teal-950/20">
                        {article.title}
                      </Badge>
                    ))}
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground/50">
                  {msg.timestamp.toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </motion.div>
          ))}

          {/* Typing indicator (only when no streaming message visible) */}
          {isLoading && !messages.some((m) => m.isStreaming) && <TypingIndicator />}

          {/* Error */}
          {error && (
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="px-4 pb-2">
              <div className="ml-11 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/50 px-3 py-2 text-xs text-red-600 dark:text-red-400">
                {error}
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t bg-background/80 backdrop-blur-sm px-4 py-3">
          <form onSubmit={handleSubmit} className="relative">
            <Textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escreva a sua pergunta..."
              disabled={isLoading}
              rows={2}
              style={{ fieldSizing: 'fixed' }}
              className="resize-none overflow-y-auto rounded-xl border-border/60 bg-muted/30 pr-14 min-h-[44px] max-h-[150px] text-sm placeholder:text-muted-foreground/50 focus-visible:ring-emerald-500/30 focus-visible:border-emerald-400/50"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!inputValue.trim() || isLoading}
              className="absolute right-2 bottom-2 size-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-md disabled:opacity-40 disabled:shadow-none transition-all active:scale-[0.92]"
            >
              <Send className="size-4" />
            </Button>
          </form>
          <p className="text-[10px] text-muted-foreground/50 mt-2 text-center">
            LexAssistent pode cometer erros. Verifique informações importantes.
          </p>
        </div>
      </div>
    </div>
  );
}

// Small book icon for knowledge sources
function BookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

// ─────────────────────────────────────────
// Tab 2: Gerar Documento
// ─────────────────────────────────────────
function GenerateDocumentTab() {
  const [docType, setDocType] = useState('');
  const [title, setTitle] = useState('');
  const [context, setContext] = useState('');
  const [processId, setProcessId] = useState('');
  const [processes, setProcesses] = useState<Array<{ id: string; process_number: string; title: string }>>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedResult, setGeneratedResult] = useState<{ title: string; result: string; type: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentGenerations, setRecentGenerations] = useState<GenerationRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Load processes for select
  useEffect(() => {
    async function load() {
      try {
        const res = await processesApi.list('limit=50');
        if (res.success && res.data) {
          setProcesses(res.data.map((p) => ({ id: p.id, process_number: p.process_number, title: p.title })));
        }
      } catch {
        // silently fail
      }
    }
    void load();
  }, []);

  // Load recent generations
  useEffect(() => {
    async function load() {
      setLoadingHistory(true);
      try {
        const res = await aiApi.listGenerations('limit=5');
        if (res.success && res.data) {
          setRecentGenerations(res.data);
        }
      } catch {
        // silently fail
      } finally {
        setLoadingHistory(false);
      }
    }
    void load();
  }, [generatedResult]);

  const handleGenerate = useCallback(async () => {
    if (!docType || !title.trim() || !context.trim()) {
      setError('Preencha o tipo, título e instruções do documento.');
      return;
    }
    setError(null);
    setIsGenerating(true);
    setGeneratedResult(null);

    try {
      const res = await aiApi.generate({
        type: docType,
        title: title.trim(),
        context: context.trim(),
        process_id: processId || undefined,
      });
      if (res.success && res.data) {
        setGeneratedResult({
          title: res.data.title,
          result: res.data.result,
          type: res.data.generation_type,
        });
      } else {
        setError(res.error?.message ?? 'Erro ao gerar documento.');
      }
    } catch {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setIsGenerating(false);
    }
  }, [docType, title, context, processId]);

  const handleCopy = useCallback(() => {
    if (!generatedResult) return;
    navigator.clipboard.writeText(generatedResult.result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [generatedResult]);

  const handleDownload = useCallback(() => {
    if (!generatedResult) return;
    const blob = new Blob([generatedResult.result], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${generatedResult.title.replace(/\s+/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [generatedResult]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Form */}
      <Card className="rounded-xl border shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <FilePlus className="size-5 text-emerald-500" />
            Gerar Documento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Tipo de Documento</label>
            <Select value={docType} onValueChange={setDocType}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar tipo..." />
              </SelectTrigger>
              <SelectContent>
                {DOC_TYPES.map((dt) => (
                  <SelectItem key={dt.value} value={dt.value}>{dt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Título do Documento</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Contrato de Prestação de Serviços"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Contexto / Instruções</label>
            <Textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Descreva detalhadamente o que pretende gerar. Inclua as partes envolvidas, cláusulas desejadas, e qualquer informação relevante..."
              rows={6}
              className="resize-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Processo Relacionado <span className="text-muted-foreground">(opcional)</span></label>
            <Select value={processId} onValueChange={setProcessId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar processo..." />
              </SelectTrigger>
              <SelectContent>
                {processes.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.process_number} — {p.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/50 px-3 py-2 text-xs text-red-600 dark:text-red-400">
              <AlertCircle className="size-4 shrink-0" />
              {error}
            </div>
          )}

          <Button
            onClick={() => void handleGenerate()}
            disabled={isGenerating || !docType || !title.trim() || !context.trim()}
            className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-md shadow-emerald-500/20 active:scale-[0.98] transition-all"
          >
            {isGenerating ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                A gerar documento...
              </>
            ) : (
              <>
                <Sparkles className="size-4 mr-2" />
                Gerar Documento
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Result */}
      <div className="space-y-4">
        {isGenerating && (
          <Card className="rounded-xl border shadow-sm">
            <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}>
                <Sparkles className="size-10 text-emerald-500" />
              </motion.div>
              <p className="text-sm font-medium text-foreground">A gerar documento com IA...</p>
              <p className="text-xs text-muted-foreground">Isto pode levar alguns segundos</p>
              <div className="w-48 h-1.5 rounded-full bg-muted overflow-hidden mt-2">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500"
                  initial={{ width: '0%' }}
                  animate={{ width: '90%' }}
                  transition={{ duration: 8, ease: 'easeOut' }}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {generatedResult && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="rounded-xl border shadow-sm overflow-hidden">
              <CardHeader className="pb-3 bg-gradient-to-r from-emerald-500/5 to-teal-500/5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">{generatedResult.title}</CardTitle>
                    <Badge variant="outline" className={`mt-1.5 text-[10px] ${TYPE_BADGE_COLORS[generatedResult.type] ?? TYPE_BADGE_COLORS.personalizado}`}>
                      {TYPE_LABELS[generatedResult.type] ?? generatedResult.type}
                    </Badge>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="outline" onClick={handleCopy} className="size-8" title="Copiar">
                      {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                    </Button>
                    <Button size="icon" variant="outline" onClick={handleDownload} className="size-8" title="Descarregar">
                      <Download className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <MarkdownContent className="text-sm leading-relaxed">
                    {generatedResult.result}
                  </MarkdownContent>
                </ScrollArea>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Recent generations */}
        {!isGenerating && !generatedResult && (
          <Card className="rounded-xl border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <History className="size-4 text-muted-foreground" />
                Gerações Recentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingHistory ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="size-9 rounded-lg" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : recentGenerations.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-center">
                  <FileText className="size-8 text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhuma geração recente.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentGenerations.map((gen) => (
                    <div key={gen.id} className="flex items-center gap-3 rounded-lg p-2.5 hover:bg-muted/50 transition-colors cursor-default">
                      <div className="size-9 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                        <FileText className="size-4 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{gen.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-3.5 ${TYPE_BADGE_COLORS[gen.generation_type] ?? TYPE_BADGE_COLORS.personalizado}`}>
                            {TYPE_LABELS[gen.generation_type] ?? gen.generation_type}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(gen.created_at).toLocaleDateString('pt-MZ')}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// Tab 3: Extrair Prazos
// ─────────────────────────────────────────
function ExtractDeadlinesTab() {
  const [text, setText] = useState('');
  const [processId, setProcessId] = useState('');
  const [processes, setProcesses] = useState<Array<{ id: string; process_number: string; title: string }>>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [deadlines, setDeadlines] = useState<ExtractedDeadline[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await processesApi.list('limit=50');
        if (res.success && res.data) {
          setProcesses(res.data.map((p) => ({ id: p.id, process_number: p.process_number, title: p.title })));
        }
      } catch {
        // silently fail
      }
    }
    void load();
  }, []);

  const handleExtract = useCallback(async () => {
    if (!text.trim()) {
      setError('Cole o texto legal para extrair prazos.');
      return;
    }
    setError(null);
    setIsExtracting(true);
    setDeadlines([]);

    try {
      const res = await aiApi.extractDeadlines({
        text: text.trim(),
        process_id: processId || undefined,
      });
      if (res.success && res.data) {
        setDeadlines(res.data.deadlines);
      } else {
        setError(res.error?.message ?? 'Erro ao extrair prazos.');
      }
    } catch {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setIsExtracting(false);
    }
  }, [text, processId]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input */}
      <Card className="rounded-xl border shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarClock className="size-5 text-emerald-500" />
            Extrair Prazos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Texto Legal</label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Cole aqui o texto legal do qual deseja extrair prazos processuais. Ex: decisões judiciais, citações, despachos..."
              rows={12}
              className="resize-none text-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Processo Relacionado <span className="text-muted-foreground">(opcional)</span></label>
            <Select value={processId} onValueChange={setProcessId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar processo..." />
              </SelectTrigger>
              <SelectContent>
                {processes.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.process_number} — {p.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/50 px-3 py-2 text-xs text-red-600 dark:text-red-400">
              <AlertCircle className="size-4 shrink-0" />
              {error}
            </div>
          )}

          <Button
            onClick={() => void handleExtract()}
            disabled={isExtracting || !text.trim()}
            className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-md shadow-emerald-500/20 active:scale-[0.98] transition-all"
          >
            {isExtracting ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                A extrair prazos...
              </>
            ) : (
              <>
                <Clock className="size-4 mr-2" />
                Extrair Prazos
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      <div className="space-y-4">
        {isExtracting && (
          <Card className="rounded-xl border shadow-sm">
            <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}>
                <Clock className="size-10 text-emerald-500" />
              </motion.div>
              <p className="text-sm font-medium text-foreground">A analisar texto legal...</p>
              <p className="text-xs text-muted-foreground">Identificando prazos e datas relevantes</p>
            </CardContent>
          </Card>
        )}

        {deadlines.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                {deadlines.length} {deadlines.length === 1 ? 'prazo encontrado' : 'prazos encontrados'}
              </h3>
              <Badge variant="outline" className="text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 text-xs">
                Extraídos com IA
              </Badge>
            </div>
            {deadlines.map((dl, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
              >
                <Card className="rounded-xl border shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-foreground">{dl.title}</h4>
                        <div className="flex items-center gap-2 mt-1.5">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800">
                            <Clock className="size-2.5 mr-1" />
                            {dl.due_date}
                          </Badge>
                        </div>
                        {dl.description && (
                          <p className="text-sm text-muted-foreground mt-2">{dl.description}</p>
                        )}
                        {dl.source_text && (
                          <div className="mt-2 rounded-lg bg-muted/40 px-3 py-2">
                            <p className="text-[11px] text-muted-foreground italic line-clamp-2">
                              &ldquo;{dl.source_text}&rdquo;
                            </p>
                          </div>
                        )}
                      </div>
                      <Button size="sm" variant="outline" className="shrink-0 text-xs border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30">
                        Criar no Processo
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )}

        {!isExtracting && deadlines.length === 0 && (
          <Card className="rounded-xl border shadow-sm">
            <CardContent className="flex flex-col items-center py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                <CalendarClock className="size-8 text-muted-foreground/40" />
              </div>
              <h3 className="text-sm font-semibold text-foreground mb-1">Extracção de Prazos</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Cole um texto legal no formulário e a IA identificará automaticamente todos os prazos processuais, datas e termos relevantes.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// Tab 4: Histórico
// ─────────────────────────────────────────
function HistoryTab() {
  const [generations, setGenerations] = useState<GenerationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedGen, setSelectedGen] = useState<GenerationRecord | null>(null);

  const loadGenerations = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = typeFilter !== 'all' ? `type=${typeFilter}` : '';
      const res = await aiApi.listGenerations(params);
      if (res.success && res.data) {
        setGenerations(res.data);
      }
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }, [typeFilter]);

  useEffect(() => {
    void loadGenerations();
  }, [loadGenerations]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await aiApi.deleteGeneration(id);
      setGenerations((prev) => prev.filter((g) => g.id !== id));
      if (selectedGen?.id === id) setSelectedGen(null);
    } catch {
      // silently fail
    }
  }, [selectedGen]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Filtrar por tipo:</span>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-48 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {DOC_TYPES.map((dt) => (
                <SelectItem key={dt.value} value={dt.value}>{dt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Badge variant="outline" className="text-xs">
          {generations.length} {generations.length === 1 ? 'geração' : 'gerações'}
        </Badge>
      </div>

      {/* Table */}
      <Card className="rounded-xl border shadow-sm overflow-hidden">
        {isLoading ? (
          <CardContent className="p-6 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="size-9 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-8 w-20" />
              </div>
            ))}
          </CardContent>
        ) : generations.length === 0 ? (
          <CardContent className="flex flex-col items-center py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
              <History className="size-8 text-muted-foreground/40" />
            </div>
            <h3 className="text-sm font-semibold text-foreground mb-1">Sem Histórico</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Ainda não gerou nenhum documento com IA. Use o separador &quot;Gerar Documento&quot; para começar.
            </p>
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Título</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tipo</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Data</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Acções</th>
                </tr>
              </thead>
              <tbody>
                {generations.map((gen) => (
                  <tr key={gen.id} className="border-b hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="size-9 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                          <FileText className="size-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <span className="font-medium truncate max-w-xs">{gen.title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={`text-[10px] ${TYPE_BADGE_COLORS[gen.generation_type] ?? TYPE_BADGE_COLORS.personalizado}`}>
                        {TYPE_LABELS[gen.generation_type] ?? gen.generation_type}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(gen.created_at).toLocaleDateString('pt-MZ', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => setSelectedGen(gen)} className="size-8 hover:bg-emerald-500/10 hover:text-emerald-600" title="Ver">
                          <Eye className="size-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => void handleDelete(gen.id)} className="size-8 hover:bg-red-500/10 hover:text-red-500" title="Eliminar">
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* View Dialog */}
      <Dialog open={!!selectedGen} onOpenChange={(open) => !open && setSelectedGen(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedGen?.title}
              {selectedGen && (
                <Badge variant="outline" className={`text-[10px] ${TYPE_BADGE_COLORS[selectedGen.generation_type] ?? TYPE_BADGE_COLORS.personalizado}`}>
                  {TYPE_LABELS[selectedGen.generation_type] ?? selectedGen.generation_type}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              Gerado em {selectedGen ? new Date(selectedGen.created_at).toLocaleDateString('pt-MZ', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
            </DialogDescription>
          </DialogHeader>
          {selectedGen && (
            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-sm leading-relaxed pb-4">
                {selectedGen.result}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────
// Main AIHubView Component
// ─────────────────────────────────────────
export function AIHubView() {
  const [activeTab, setActiveTab] = useState('chat');

  const tabs = [
    { id: 'chat', label: 'Assistente IA', icon: Bot },
    { id: 'gerar', label: 'Gerar Documento', icon: FilePlus },
    { id: 'extrair', label: 'Extrair Prazos', icon: CalendarClock },
    { id: 'historico', label: 'Histórico', icon: History },
  ] as const;

  type TabId = (typeof tabs)[number]['id'];

  return (
    <div className="flex flex-col h-full gap-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-xl border bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent p-6"
      >
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-1/2 w-48 h-48 bg-teal-500/5 rounded-full translate-y-1/2" />

        <div className="relative flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
            <Bot className="size-7 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              Centro de Inteligência Artificial
              <Badge className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-0 text-[10px] shadow-sm">
                IA
              </Badge>
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Assistente jurídico virtual, geração de documentos e análise inteligente
            </p>
          </div>
        </div>
      </motion.div>

      {/* Tabs — custom implementation for reliable switching */}
      <div role="tablist" className="flex bg-muted/60 p-1 rounded-xl h-auto w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-lg px-4 py-2.5 text-sm transition-all inline-flex items-center gap-2 ${
              activeTab === tab.id
                ? 'bg-background text-foreground shadow-sm font-medium'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <tab.icon className="size-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
            className={activeTab === 'chat' ? 'h-full' : ''}
            >
              {activeTab === 'chat' && <AssistantChatTab />}
              {activeTab === 'gerar' && <GenerateDocumentTab />}
              {activeTab === 'extrair' && <ExtractDeadlinesTab />}
              {activeTab === 'historico' && <HistoryTab />}
            </motion.div>
          </AnimatePresence>
        </div>
    </div>
  );
}
