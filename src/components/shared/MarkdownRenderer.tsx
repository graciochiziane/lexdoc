// ═══════════════════════════════════════════════════════════════
// LEXDOC — Markdown Renderer Component
// Renders Markdown content with GFM support and emerald theming
// ═══════════════════════════════════════════════════════════════

'use client';

import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// ─────────────────────────────────────────
// Props
// ─────────────────────────────────────────
interface MarkdownContentProps {
  children: string;
  className?: string;
}

// ─────────────────────────────────────────
// Component
// ─────────────────────────────────────────
export function MarkdownContent({ children, className = '' }: MarkdownContentProps) {
  return (
    <div
      className={`prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed
        [&_strong]:text-emerald-700 [&_strong]:dark:text-emerald-400 [&_strong]:font-semibold
        [&_h3]:text-emerald-700 [&_h3]:dark:text-emerald-400 [&_h3]:text-base [&_h3]:font-bold [&_h3]:mt-4 [&_h3]:mb-2
        [&_h4]:text-emerald-700 [&_h4]:dark:text-emerald-400 [&_h4]:text-sm [&_h4]:font-semibold [&_h4]:mt-3 [&_h4]:mb-1.5
        [&_h2]:text-emerald-700 [&_h2]:dark:text-emerald-400 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:mt-5 [&_h2]:mb-2
        [&_blockquote]:border-l-2 [&_blockquote]:border-emerald-500 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-muted-foreground
        [&_code]:bg-muted [&_code]:rounded [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-xs [&_code]:font-mono
        [&_pre]:bg-muted [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:overflow-x-auto
        [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:rounded-none
        [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1
        [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1
        [&_li]:text-sm
        [&_a]:text-emerald-600 [&_a]:dark:text-emerald-400 [&_a]:underline [&_a]:underline-offset-2
        [&_table]:w-full [&_table]:text-sm [&_table]:border-collapse
        [&_th]:border [&_th]:border-border [&_th]:px-3 [&_th]:py-1.5 [&_th]:bg-muted [&_th]:font-semibold [&_th]:text-left
        [&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-1.5
        [&_hr]:border-border [&_hr]:my-4
        [&_p]:my-1.5
        ${className}`}
    >
      <Markdown remarkPlugins={[remarkGfm]}>{children}</Markdown>
    </div>
  );
}
