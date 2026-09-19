import { useState } from 'react';
import {
  X,
  MessageSquare,
  Bot,
  Tag as TagIcon,
  Phone,
  Mail,
  Instagram,
  Check,
  Save,
  FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export interface CrmColumn {
  id: string;
  name: string;
  color: string;
  order_index: number;
  is_active: boolean;
}

export interface CrmTag {
  id: string;
  name: string;
  color: string;
  is_active: boolean;
}

export interface CrmContact {
  id: string;
  zernio_contact_id?: string;
  name: string;
  username?: string;
  email?: string;
  phone?: string;
  avatar_url?: string;
  avatarUrl?: string;
  follower_count?: number;
  tags?: string[];
  platforms?: string[];
  crm_column_id?: string;
  is_automation_enabled: boolean;
  notes?: string;
  last_interaction_at?: string;
  raw_data?: any;
}

interface CrmLeadDetailModalProps {
  contact: CrmContact;
  columns: CrmColumn[];
  availableTags: CrmTag[];
  open: boolean;
  onClose: () => void;
  onUpdateContact: (updated: CrmContact) => void;
  onOpenConversation: (contact: CrmContact) => void;
}

export function CrmLeadDetailModal({
  contact,
  columns,
  availableTags,
  open,
  onClose,
  onUpdateContact,
  onOpenConversation
}: CrmLeadDetailModalProps) {
  if (!open) return null;

  const [notes, setNotes] = useState(contact.notes || '');
  const [selectedColumnId, setSelectedColumnId] = useState(contact.crm_column_id || columns[0]?.id || '');
  const [isAutomationEnabled, setIsAutomationEnabled] = useState(contact.is_automation_enabled !== false);
  const [selectedTags, setSelectedTags] = useState<string[]>(contact.tags || []);
  const [saving, setSaving] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');

  const initials = (contact.name || contact.username || '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const cleanUsername = contact.username ||
    contact.raw_data?.username ||
    contact.raw_data?.author?.username ||
    (contact.name?.startsWith('@') ? contact.name.slice(1) : contact.name);

  const followers = contact.follower_count ||
    contact.raw_data?.followerCount ||
    contact.raw_data?.author?.instagramProfile?.followerCount ||
    0;

  const formatFollowers = (count: number) => {
    if (!count) return null;
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M seguidores`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k seguidores`;
    return `${count} seguidores`;
  };

  const handleToggleTag = (tagName: string) => {
    if (selectedTags.includes(tagName)) {
      setSelectedTags(selectedTags.filter((t) => t !== tagName));
    } else {
      setSelectedTags([...selectedTags, tagName]);
    }
  };

  const handleAddCustomTag = () => {
    const val = newTagInput.trim();
    if (!val) return;
    if (!selectedTags.includes(val)) {
      setSelectedTags([...selectedTags, val]);
    }
    setNewTagInput('');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updatePayload = {
        crm_column_id: selectedColumnId,
        is_automation_enabled: isAutomationEnabled,
        notes: notes.trim(),
        tags: selectedTags,
        updated_at: new Date().toISOString()
      };

      const { error } = await (supabase.from('zernio_contacts' as any) as any)
        .update(updatePayload)
        .eq('id', contact.id);

      if (error) throw error;

      const updatedContact: CrmContact = {
        ...contact,
        ...updatePayload
      };

      onUpdateContact(updatedContact);
      toast.success('Informações do lead salvas com sucesso!');
      onClose();
    } catch (err: any) {
      console.error('Erro ao salvar lead:', err);
      toast.error('Erro ao salvar informações: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-card border border-border/70 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-border/50 flex items-center justify-between bg-secondary/15">
          <div className="flex items-center gap-3.5">
            <div className="relative">
              {contact.avatar_url || contact.avatarUrl ? (
                <img
                  src={contact.avatar_url || contact.avatarUrl}
                  alt={contact.name}
                  className="w-13 h-13 rounded-full object-cover border-2 border-primary/30 shadow-xs"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                    const fallback = (e.target as HTMLElement).nextElementSibling as HTMLElement;
                    if (fallback) fallback.style.display = 'flex';
                  }}
                />
              ) : null}
              <div
                className={`w-13 h-13 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-base border-2 border-primary/25 ${
                  contact.avatar_url || contact.avatarUrl ? 'hidden' : ''
                }`}
              >
                {initials}
              </div>
              <span className="absolute -bottom-1 -right-1 bg-gradient-to-tr from-amber-500 to-rose-500 text-white p-1 rounded-full text-[10px] shadow-xs">
                <Instagram className="h-3 w-3" />
              </span>
            </div>

            <div className="space-y-0.5">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                {contact.name || 'Lead sem nome'}
              </h2>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {cleanUsername && <span>@{cleanUsername}</span>}
                {followers > 0 && (
                  <>
                    <span>•</span>
                    <span className="text-primary font-medium">{formatFollowers(followers)}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={() => onOpenConversation(contact)}
              className="gap-2 text-xs bg-primary hover:bg-primary/90 cursor-pointer shadow-xs"
            >
              <MessageSquare className="h-3.5 w-3.5" /> Enviar Mensagem
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Funnel Stage & Automation Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Etapa do Funil (Kanban)
              </Label>
              <select
                value={selectedColumnId}
                onChange={(e) => setSelectedColumnId(e.target.value)}
                className="w-full text-sm bg-card text-foreground border border-border/70 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-primary font-medium [&>option]:bg-card [&>option]:text-card-foreground dark:[&>option]:bg-slate-900 dark:[&>option]:text-slate-100"
              >
                {columns.map((col) => (
                  <option key={col.id} value={col.id} className="bg-card text-card-foreground dark:bg-slate-900 dark:text-slate-100">
                    {col.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Automação com IA para este Lead
              </Label>
              <div className="flex items-center justify-between p-2.5 rounded-xl border border-border/70 bg-card">
                <div className="flex items-center gap-2">
                  <Bot className={`h-4 w-4 ${isAutomationEnabled ? 'text-emerald-500' : 'text-muted-foreground'}`} />
                  <span className="text-sm font-medium">
                    {isAutomationEnabled ? 'Automação Ativa' : 'Automação Pausada'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAutomationEnabled(!isAutomationEnabled)}
                  className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    isAutomationEnabled ? 'bg-emerald-500' : 'bg-muted'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      isAutomationEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground leading-tight">
                Pause a automação quando um atendente humano estiver negociando diretamente com o cliente.
              </p>
            </div>
          </div>

          {/* Contact Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-secondary/15 border border-border/50 text-xs">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="truncate">{contact.email || 'E-mail não informado'}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="truncate">{contact.phone || 'Telefone não informado'}</span>
            </div>
          </div>

          {/* Tags Manager */}
          <div className="space-y-2.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <TagIcon className="h-3.5 w-3.5 text-primary" /> Tags do Lead
            </Label>

            <div className="flex flex-wrap gap-1.5 min-h-[32px]">
              {selectedTags.map((tag) => {
                const tagMeta = availableTags.find((t) => t.name.toLowerCase() === tag.toLowerCase());
                const color = tagMeta?.color || '#3b82f6';
                return (
                  <span
                    key={tag}
                    style={{ backgroundColor: `${color}18`, borderColor: `${color}55`, color }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border shadow-2xs"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleToggleTag(tag)}
                      className="hover:opacity-75 cursor-pointer ml-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                );
              })}
              {selectedTags.length === 0 && (
                <span className="text-xs text-muted-foreground italic py-1">Nenhuma tag atribuída.</span>
              )}
            </div>

            {/* Quick tag selector */}
            <div className="pt-2 border-t border-border/40">
              <p className="text-[11px] font-medium text-muted-foreground mb-1.5">Tags sugeridas (clique para adicionar/remover):</p>
              <div className="flex flex-wrap gap-1.5">
                {availableTags.map((t) => {
                  const isSelected = selectedTags.includes(t.name);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleToggleTag(t.name)}
                      style={{
                        borderColor: isSelected ? t.color : undefined,
                        backgroundColor: isSelected ? `${t.color}25` : undefined,
                        color: isSelected ? t.color : undefined
                      }}
                      className={`text-xs px-2.5 py-1 rounded-md border transition-all cursor-pointer flex items-center gap-1.5 ${
                        isSelected
                          ? 'font-bold shadow-xs'
                          : 'border-border/60 bg-card hover:bg-secondary/40 text-muted-foreground'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />
                      {t.name}
                      {isSelected && <Check className="h-3 w-3" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Add custom tag */}
            <div className="flex gap-2 pt-1">
              <Input
                placeholder="Criar nova tag personalizada..."
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustomTag();
                  }
                }}
                className="h-8 text-xs bg-card"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddCustomTag}
                disabled={!newTagInput.trim()}
                className="h-8 text-xs px-3"
              >
                Adicionar
              </Button>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-primary" /> Anotações Internas / Histórico Comercial
            </Label>
            <textarea
              rows={4}
              placeholder="Adicione notas sobre as negociações, preferências do cliente, propostas enviadas ou combinados..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs bg-card border border-border/70 rounded-xl p-3 outline-none focus:ring-2 focus:ring-primary leading-relaxed resize-none"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border/50 bg-secondary/15 flex items-center justify-end gap-2.5">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving} className="text-xs">
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="gap-2 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-4 cursor-pointer"
          >
            <Save className="h-3.5 w-3.5" /> {saving ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </div>
      </div>
    </div>
  );
}
