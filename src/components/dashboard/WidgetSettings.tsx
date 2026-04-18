// ═══════════════════════════════════════════════════════════════
// LEXDOC — Configuração de Widgets do Painel
// Permite ao utilizador personalizar os widgets visíveis
// ═══════════════════════════════════════════════════════════════

'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Settings2, Eye, EyeOff } from 'lucide-react';

// ─────────────────────────────────────────
// Widget definitions
// ─────────────────────────────────────────
export interface WidgetConfig {
  id: string;
  label: string;
  description: string;
  icon: string;
  defaultVisible: boolean;
}

export const WIDGET_DEFINITIONS: WidgetConfig[] = [
  { id: 'welcome', label: 'Cartão de Boas-vindas', description: 'Saudação personalizada com estatísticas', icon: '✨', defaultVisible: true },
  { id: 'stats', label: 'Estatísticas', description: 'Cartões de contadores animados', icon: '📊', defaultVisible: true },
  { id: 'alerts', label: 'Alertas de Urgência', description: 'Prazos expirados e próximos', icon: '🚨', defaultVisible: true },
  { id: 'charts', label: 'Gráficos Analíticos', description: 'Distribuição por estado, prioridade e área', icon: '📈', defaultVisible: true },
  { id: 'activity', label: 'Feed de Actividade', description: 'Actividades recentes da equipa', icon: '📋', defaultVisible: true },
  { id: 'team', label: 'Equipa da Firma', description: 'Membros activos e últimos acessos', icon: '👥', defaultVisible: true },
];

const STORAGE_KEY = 'lexdoc_widget_visibility';

function loadVisibility(): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  const defaults: Record<string, boolean> = {};
  for (const w of WIDGET_DEFINITIONS) defaults[w.id] = w.defaultVisible;
  return defaults;
}

function saveVisibility(visibility: Record<string, boolean>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(visibility));
}

export function getWidgetVisibility(): Record<string, boolean> {
  return loadVisibility();
}

// ─────────────────────────────────────────
// Props
// ─────────────────────────────────────────
interface WidgetSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVisibilityChange?: () => void;
}

// ─────────────────────────────────────────
// Component
// ─────────────────────────────────────────
export function WidgetSettings({ open, onOpenChange, onVisibilityChange }: WidgetSettingsProps) {
  // Compute visibility directly from localStorage (no effect needed)
  const visibility = open ? loadVisibility() : ({} as Record<string, boolean>);
  const [, forceUpdate] = useState(0);

  const toggle = (id: string) => {
    const current = loadVisibility();
    const next = { ...current, [id]: !current[id] };
    saveVisibility(next);
    onVisibilityChange?.();
    forceUpdate((n) => n + 1);
  };

  const resetDefaults = () => {
    const defaults: Record<string, boolean> = {};
    for (const w of WIDGET_DEFINITIONS) defaults[w.id] = w.defaultVisible;
    setVisibility(defaults);
    saveVisibility(defaults);
    onVisibilityChange?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-w-[95vw]">
        <div className="bg-gradient-to-r from-violet-600 to-purple-500 -mx-6 -mt-6 px-6 pt-6 pb-5 rounded-t-lg">
          <DialogTitle className="flex items-center gap-2 text-white">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/20">
              <Settings2 className="size-5" />
            </div>
            <div>
              <p className="text-lg">Personalizar Painel</p>
              <DialogDescription className="text-white/80 mt-0.5">Escolha os widgets a exibir.</DialogDescription>
            </div>
          </DialogTitle>
        </div>
        <div className="space-y-3 py-2">
          {WIDGET_DEFINITIONS.map((widget) => (
            <div
              key={widget.id}
              className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">{widget.icon}</span>
                <div>
                  <p className="text-sm font-medium">{widget.label}</p>
                  <p className="text-[11px] text-muted-foreground">{widget.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {visibility[widget.id] !== false ? (
                  <Eye className="size-3.5 text-emerald-500" />
                ) : (
                  <EyeOff className="size-3.5 text-muted-foreground" />
                )}
                <Switch
                  checked={visibility[widget.id] !== false}
                  onCheckedChange={() => toggle(widget.id)}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={resetDefaults} className="text-xs">
            Restaurar Padrão
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
