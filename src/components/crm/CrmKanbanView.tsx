import React, { useState, useMemo } from 'react';
import {
  Search,
  RefreshCw,
  LayoutGrid,
  List as ListIcon,
  FileText,
  Bot,
  Users,
  Tag as TagIcon,
  Send
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { CrmColumn, CrmTag, CrmContact } from './CrmLeadDetailModal';

interface CrmKanbanViewProps {
  tenantId: string;
  contacts: CrmContact[];
  columns: CrmColumn[];
  tags: CrmTag[];
  loading: boolean;
  onRefresh: (forceSync?: boolean) => void;
  onSelectContactForDetails: (contact: CrmContact) => void;
  onOpenConversation: (contact: CrmContact) => void;
  onUpdateContactLocal: (contactId: string, updates: Partial<CrmContact>) => void;
}

export function CrmKanbanView({
  tenantId,
  contacts,
  columns,
  tags,
  loading,
  onRefresh,
  onSelectContactForDetails,
  onOpenConversation,
  onUpdateContactLocal
}: CrmKanbanViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>('all');
  const [automationFilter, setAutomationFilter] = useState<'all' | 'enabled' | 'paused'>('all');
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');

  // Drag & drop state
  const [draggedContactId, setDraggedContactId] = useState<string | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);

  // Filtered contacts
  const filteredContacts = useMemo(() => {
    return contacts.filter((c) => {
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = (c.name || '').toLowerCase().includes(q);
        const matchesUsername = (c.username || '').toLowerCase().includes(q);
        const matchesEmail = (c.email || '').toLowerCase().includes(q);
        const matchesPhone = (c.phone || '').toLowerCase().includes(q);
        const matchesNotes = (c.notes || '').toLowerCase().includes(q);
        if (!matchesName && !matchesUsername && !matchesEmail && !matchesPhone && !matchesNotes) {
          return false;
        }
      }

      // Tag filter
      if (selectedTagFilter !== 'all') {
        if (!c.tags || !c.tags.includes(selectedTagFilter)) {
          return false;
        }
      }

      // Automation filter
      if (automationFilter === 'enabled' && c.is_automation_enabled === false) {
        return false;
      }
      if (automationFilter === 'paused' && c.is_automation_enabled !== false) {
        return false;
      }

      return true;
    });
  }, [contacts, searchQuery, selectedTagFilter, automationFilter]);

  // Group contacts by column
  const contactsByColumn = useMemo(() => {
    const grouped: Record<string, CrmContact[]> = {};
    const sortedCols = [...columns].sort((a, b) => a.order_index - b.order_index);

    sortedCols.forEach((col) => {
      grouped[col.id] = [];
    });

    // Fallback bucket for contacts with no valid column
    const defaultColId = sortedCols[0]?.id;

    filteredContacts.forEach((c) => {
      const colId = c.crm_column_id && grouped[c.crm_column_id] ? c.crm_column_id : defaultColId;
      if (colId && grouped[colId]) {
        grouped[colId].push(c);
      }
    });

    return grouped;
  }, [columns, filteredContacts]);

  // Handle Drag Start
  const handleDragStart = (e: React.DragEvent, contactId: string) => {
    e.dataTransfer.setData('text/plain', contactId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedContactId(contactId);
  };

  // Handle Drag Over column
  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumnId !== columnId) {
      setDragOverColumnId(columnId);
    }
  };

  // Handle Drop on column
  const handleDrop = async (e: React.DragEvent, targetColumnId: string) => {
    e.preventDefault();
    const contactId = e.dataTransfer.getData('text/plain') || draggedContactId;
    setDraggedContactId(null);
    setDragOverColumnId(null);

    if (!contactId) return;

    const contact = contacts.find((c) => c.id === contactId || c.zernio_contact_id === contactId);
    if (!contact || contact.crm_column_id === targetColumnId) {
      return;
    }

    const targetColumn = columns.find((col) => col.id === targetColumnId);

    // Optimistic UI update
    onUpdateContactLocal(contact.id, { crm_column_id: targetColumnId });
    toast.success(`Lead movido para "${targetColumn?.name || 'nova etapa'}"`);

    // Persist to Supabase
    try {
      let query = supabase
        .from('zernio_contacts' as any)
        .update({
          crm_column_id: targetColumnId,
          updated_at: new Date().toISOString()
        })
        .eq('tenant_id', tenantId);

      if (contact.id) {
        query = query.or(`id.eq.${contact.id},zernio_contact_id.eq.${contact.id}`);
      } else if (contact.zernio_contact_id) {
        query = query.eq('zernio_contact_id', contact.zernio_contact_id);
      }

      const { error } = await query;
      if (error) {
        console.error('Failed to move column:', error);
        toast.error('Erro ao salvar alteração de etapa no banco');
        onRefresh(false);
      }
    } catch (err: any) {
      console.error('Drop error:', err);
      toast.error('Erro de conexão');
      onRefresh(false);
    }
  };

  // Quick toggle automation enabled/paused for a lead
  const handleToggleAutomation = async (contact: CrmContact, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const newStatus = contact.is_automation_enabled === false ? true : false;

    // Optimistic update
    onUpdateContactLocal(contact.id, { is_automation_enabled: newStatus });
    toast.info(`Automação para ${contact.name || 'contato'} ${newStatus ? 'ativada' : 'pausada'}`);

    try {
      let query = supabase
        .from('zernio_contacts' as any)
        .update({
          is_automation_enabled: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('tenant_id', tenantId);

      if (contact.id) {
        query = query.or(`id.eq.${contact.id},zernio_contact_id.eq.${contact.id}`);
      } else if (contact.zernio_contact_id) {
        query = query.eq('zernio_contact_id', contact.zernio_contact_id);
      }

      const { error } = await query;
      if (error) {
        console.error('Toggle error:', error);
        toast.error('Erro ao atualizar status de automação');
        onRefresh(false);
      }
    } catch (err) {
      console.error('Toggle exception:', err);
      onRefresh(false);
    }
  };

  // Helper to format follower count
  const formatFollowers = (count?: number) => {
    if (!count && count !== 0) return null;
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
    return count.toString();
  };

  // Helper to get tag color
  const getTagColor = (tagName: string) => {
    const match = tags.find((t) => t.name.toLowerCase() === tagName.toLowerCase());
    return match?.color || '#3b82f6';
  };

  return (
    <div className="space-y-5">
      {/* ── Top Filters & Actions Bar ── */}
      <div className="bg-card/70 backdrop-blur-md border border-border/70 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search box */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, @username, telefone ou anotação..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-10 text-sm bg-background/50 border-border/80 focus-visible:ring-primary/20 rounded-xl"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
              >
                Limpar
              </button>
            )}
          </div>

          {/* Filter selectors */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Tag filter */}
            <div className="flex items-center gap-1.5 bg-background/60 border border-border/80 rounded-xl px-3 py-1.5 text-xs">
              <TagIcon className="h-3.5 w-3.5 text-muted-foreground" />
              <select
                value={selectedTagFilter}
                onChange={(e) => setSelectedTagFilter(e.target.value)}
                aria-label="Filtrar contatos por tag"
                className="bg-transparent text-foreground border-none outline-hidden cursor-pointer font-medium text-xs pr-2"
              >
                <option value="all">Todas as Tags</option>
                {tags.map((t) => (
                  <option key={t.id} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Automation filter */}
            <div className="flex items-center gap-1.5 bg-background/60 border border-border/80 rounded-xl px-3 py-1.5 text-xs">
              <Bot className="h-3.5 w-3.5 text-muted-foreground" />
              <select
                value={automationFilter}
                onChange={(e) => setAutomationFilter(e.target.value as any)}
                aria-label="Filtrar por status de automação"
                className="bg-transparent text-foreground border-none outline-hidden cursor-pointer font-medium text-xs pr-2"
              >
                <option value="all">Todas Automações</option>
                <option value="enabled">🟢 Automação Ativa</option>
                <option value="paused">⏸️ Automação Pausada</option>
              </select>
            </div>

            {/* Mode Switcher: Kanban vs List */}
            <div className="flex items-center p-1 bg-secondary/60 rounded-xl border border-border/60">
              <button
                onClick={() => setViewMode('kanban')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === 'kanban'
                    ? 'bg-card text-foreground shadow-xs border border-border/40'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Modo Kanban"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span>Kanban</span>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === 'list'
                    ? 'bg-card text-foreground shadow-xs border border-border/40'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Modo Lista"
              >
                <ListIcon className="h-3.5 w-3.5" />
                <span>Lista</span>
              </button>
            </div>

            {/* Sync button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRefresh(true)}
              disabled={loading}
              className="gap-2 h-9 text-xs rounded-xl border-border/80 hover:bg-secondary/70"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-primary' : ''}`} />
              <span>{loading ? 'Sincronizando...' : 'Sincronizar'}</span>
            </Button>
          </div>
        </div>

        {/* Counter pill */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/40">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">
              {filteredContacts.length} {filteredContacts.length === 1 ? 'lead encontrado' : 'leads encontrados'}
            </span>
            {filteredContacts.length !== contacts.length && (
              <span className="text-muted-foreground">de {contacts.length} no total</span>
            )}
          </div>
          <span className="text-[11px] text-muted-foreground hidden sm:inline">
            Dica: arraste os cards de uma coluna para outra para atualizar o estágio no funil.
          </span>
        </div>
      </div>

      {/* ── Empty State ── */}
      {!loading && contacts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 bg-card/40 border border-dashed border-border/80 rounded-2xl text-center px-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Users className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-bold text-foreground mb-1">Nenhum lead encontrado</h3>
          <p className="text-sm text-muted-foreground max-w-md mb-5">
            Você ainda não possui contatos sincronizados ou não há registros com os filtros selecionados.
          </p>
          <Button onClick={() => onRefresh(true)} className="gap-2 rounded-xl">
            <RefreshCw className="h-4 w-4" />
            Sincronizar Leads Agora
          </Button>
        </div>
      )}

      {/* ── Kanban Board View ── */}
      {viewMode === 'kanban' && (
        <div className="flex gap-4 overflow-x-auto pb-6 pt-1 items-start scrollbar-thin">
          {columns
            .filter((c) => c.is_active)
            .sort((a, b) => a.order_index - b.order_index)
            .map((column) => {
              const colContacts = contactsByColumn[column.id] || [];
              const isDragOver = dragOverColumnId === column.id;

              return (
                <div
                  key={column.id}
                  onDragOver={(e) => handleDragOver(e, column.id)}
                  onDragLeave={() => setDragOverColumnId(null)}
                  onDrop={(e) => handleDrop(e, column.id)}
                  className={`flex flex-col shrink-0 w-[310px] sm:w-[330px] rounded-2xl bg-card/60 backdrop-blur-sm border transition-all duration-200 ${
                    isDragOver
                      ? 'border-primary shadow-lg ring-2 ring-primary/20 bg-primary/5 scale-[1.01]'
                      : 'border-border/70 hover:border-border'
                  }`}
                  style={{ minHeight: '620px' }}
                >
                  {/* Column Header */}
                  <div className="p-3.5 border-b border-border/60">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-3 h-3 rounded-full shrink-0 shadow-xs"
                          style={{ backgroundColor: column.color || '#3b82f6' }}
                        />
                        <h4 className="font-bold text-sm text-foreground truncate">{column.name}</h4>
                      </div>
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded-full border shadow-2xs shrink-0"
                        style={{
                          backgroundColor: `${column.color}15` || '#3b82f615',
                          color: column.color || '#3b82f6',
                          borderColor: `${column.color}30` || '#3b82f630'
                        }}
                      >
                        {colContacts.length}
                      </span>
                    </div>
                  </div>

                  {/* Column Cards Container */}
                  <div className="p-3 space-y-3 flex-1 overflow-y-auto max-h-[750px] scrollbar-thin">
                    {colContacts.length === 0 ? (
                      <div className="h-36 flex flex-col items-center justify-center border-2 border-dashed border-border/40 rounded-xl text-center p-3 text-muted-foreground text-xs">
                        <span>Nenhum lead nesta etapa</span>
                        <span className="text-[10px] opacity-70 mt-1">Arraste um card para cá</span>
                      </div>
                    ) : (
                      colContacts.map((contact) => {
                        const isDragging = draggedContactId === contact.id;
                        const isAutoEnabled = contact.is_automation_enabled !== false;
                        const initials = (contact.name || contact.username || '?')
                          .split(' ')
                          .map((w) => w[0])
                          .join('')
                          .toUpperCase()
                          .slice(0, 2);

                        return (
                          <div
                            key={contact.id}
                            draggable={true}
                            onDragStart={(e) => handleDragStart(e, contact.id)}
                            className={`group relative bg-card border border-border/80 hover:border-primary/50 hover:shadow-md rounded-xl p-3.5 transition-all cursor-grab active:cursor-grabbing select-none ${
                              isDragging ? 'opacity-40 scale-95 border-dashed border-primary' : ''
                            }`}
                          >
                            {/* Card Header: Avatar, Name, Handle, Channel */}
                            <div className="flex items-start gap-3">
                              {/* Avatar */}
                              <div className="relative shrink-0">
                                {contact.avatar_url || contact.avatarUrl ? (
                                  <img
                                    src={contact.avatar_url || contact.avatarUrl}
                                    alt={contact.name}
                                    className="w-11 h-11 rounded-full object-cover border border-border/80 shadow-2xs"
                                    onError={(e) => {
                                      (e.target as HTMLElement).style.display = 'none';
                                      const fallback = (e.target as HTMLElement).nextElementSibling as HTMLElement;
                                      if (fallback) fallback.style.display = 'flex';
                                    }}
                                  />
                                ) : null}
                                <div
                                  className={`w-11 h-11 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center text-primary font-bold text-xs shadow-2xs ${
                                    contact.avatar_url || contact.avatarUrl ? 'hidden' : ''
                                  }`}
                                >
                                  {initials}
                                </div>
                              </div>

                              {/* Info */}
                              <div className="min-w-0 flex-1">
                                <h5 className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">
                                  {contact.name || 'Lead sem nome'}
                                </h5>

                                {contact.username && (
                                  <p className="text-xs text-muted-foreground truncate">
                                    @{contact.username}
                                  </p>
                                )}

                                {/* Followers & Platforms */}
                                <div className="flex items-center gap-2 mt-1">
                                  {contact.follower_count !== undefined && contact.follower_count !== null && (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                                      <Users className="h-3 w-3 text-muted-foreground" />
                                      {formatFollowers(contact.follower_count)} seguidores
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Tags list */}
                            {contact.tags && contact.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-2.5">
                                {contact.tags.map((tag) => {
                                  const tagColor = getTagColor(tag);
                                  return (
                                    <span
                                      key={tag}
                                      className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md border shadow-2xs"
                                      style={{
                                        backgroundColor: `${tagColor}15`,
                                        color: tagColor,
                                        borderColor: `${tagColor}35`
                                      }}
                                    >
                                      <TagIcon className="h-2.5 w-2.5" />
                                      {tag}
                                    </span>
                                  );
                                })}
                              </div>
                            )}

                            {/* Automation Status Toggle Pill */}
                            <div className="mt-3 pt-2.5 border-t border-border/50 flex items-center justify-between">
                              <button
                                type="button"
                                onClick={(e) => handleToggleAutomation(contact, e)}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all border shadow-2xs ${
                                  isAutoEnabled
                                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/20'
                                    : 'bg-amber-500/10 text-amber-500 border-amber-500/30 hover:bg-amber-500/20'
                                }`}
                                title={
                                  isAutoEnabled
                                    ? 'Clique para pausar respostas automáticas'
                                    : 'Clique para reativar respostas automáticas'
                                }
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    isAutoEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                                  }`}
                                />
                                <span>{isAutoEnabled ? 'Automação: Ativada' : 'Automação: Pausada'}</span>
                              </button>
                            </div>

                            {/* Action Buttons: DirectFlow styling */}
                            <div className="grid grid-cols-2 gap-2 mt-2.5">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onSelectContactForDetails(contact)}
                                className="h-8 text-xs font-semibold rounded-lg border-border/80 hover:bg-secondary gap-1.5"
                              >
                                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                                <span>Ver Detalhes</span>
                              </Button>

                              <Button
                                size="sm"
                                onClick={() => onOpenConversation(contact)}
                                className="h-8 text-xs font-semibold rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 shadow-2xs"
                              >
                                <Send className="h-3 w-3" />
                                <span>Mensagem</span>
                              </Button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* ── Table / List View ── */}
      {viewMode === 'list' && (
        <div className="bg-card border border-border/70 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-secondary/50 border-b border-border/70 text-muted-foreground uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="p-3.5">Lead / Contato</th>
                  <th className="p-3.5">Estágio no Funil</th>
                  <th className="p-3.5">Tags</th>
                  <th className="p-3.5">Automação</th>
                  <th className="p-3.5">Seguidores</th>
                  <th className="p-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredContacts.map((contact) => {
                  const currentCol = columns.find((col) => col.id === contact.crm_column_id) || columns[0];
                  const isAutoEnabled = contact.is_automation_enabled !== false;
                  const initials = (contact.name || contact.username || '?')
                    .split(' ')
                    .map((w) => w[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2);

                  return (
                    <tr key={contact.id} className="hover:bg-secondary/30 transition-colors">
                      {/* Lead info */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-3">
                          <div className="relative shrink-0">
                            {contact.avatar_url || contact.avatarUrl ? (
                              <img
                                src={contact.avatar_url || contact.avatarUrl}
                                alt={contact.name}
                                className="w-9 h-9 rounded-full object-cover border border-border/80"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = 'none';
                                  const fallback = (e.target as HTMLElement).nextElementSibling as HTMLElement;
                                  if (fallback) fallback.style.display = 'flex';
                                }}
                              />
                            ) : null}
                            <div
                              className={`w-9 h-9 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center text-primary font-bold text-xs ${
                                contact.avatar_url || contact.avatarUrl ? 'hidden' : ''
                              }`}
                            >
                              {initials}
                            </div>
                          </div>
                          <div>
                            <p className="font-bold text-foreground text-sm">{contact.name || 'Lead sem nome'}</p>
                            {contact.username && (
                              <p className="text-muted-foreground text-xs">@{contact.username}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Stage selector */}
                      <td className="p-3.5">
                        <select
                          value={contact.crm_column_id || columns[0]?.id || ''}
                          aria-label={`Alterar estágio do lead ${contact.name || 'contato'}`}
                          onChange={async (e) => {
                            const newColId = e.target.value;
                            onUpdateContactLocal(contact.id, { crm_column_id: newColId });
                            try {
                              await supabase
                                .from('zernio_contacts' as any)
                                .update({ crm_column_id: newColId, updated_at: new Date().toISOString() })
                                .eq('tenant_id', tenantId)
                                .eq('id', contact.id);
                              toast.success('Estágio atualizado');
                            } catch {
                              toast.error('Erro ao salvar estágio');
                            }
                          }}
                          className="text-xs font-semibold rounded-lg px-2.5 py-1.5 border border-border/80 bg-background text-foreground cursor-pointer focus:outline-hidden"
                          style={{
                            borderColor: `${currentCol?.color}60`,
                            color: currentCol?.color
                          }}
                        >
                          {columns
                            .filter((c) => c.is_active)
                            .map((col) => (
                              <option key={col.id} value={col.id} className="text-foreground bg-card">
                                {col.name}
                              </option>
                            ))}
                        </select>
                      </td>

                      {/* Tags */}
                      <td className="p-3.5">
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {contact.tags && contact.tags.length > 0 ? (
                            contact.tags.map((tag) => {
                              const tagColor = getTagColor(tag);
                              return (
                                <span
                                  key={tag}
                                  className="text-[10px] font-semibold px-2 py-0.5 rounded-md border"
                                  style={{
                                    backgroundColor: `${tagColor}15`,
                                    color: tagColor,
                                    borderColor: `${tagColor}35`
                                  }}
                                >
                                  {tag}
                                </span>
                              );
                            })
                          ) : (
                            <span className="text-muted-foreground text-[11px]">-</span>
                          )}
                        </div>
                      </td>

                      {/* Automation status */}
                      <td className="p-3.5">
                        <button
                          type="button"
                          onClick={(e) => handleToggleAutomation(contact, e)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all border ${
                            isAutoEnabled
                              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-500 border-amber-500/30 hover:bg-amber-500/20'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isAutoEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                            }`}
                          />
                          <span>{isAutoEnabled ? 'Ativada' : 'Pausada'}</span>
                        </button>
                      </td>

                      {/* Followers */}
                      <td className="p-3.5 text-muted-foreground font-medium">
                        {contact.follower_count ? formatFollowers(contact.follower_count) : '-'}
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-right space-x-1.5 whitespace-nowrap">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onSelectContactForDetails(contact)}
                          className="h-8 text-xs font-medium rounded-lg"
                        >
                          <FileText className="h-3.5 w-3.5 mr-1" /> Detalhes
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => onOpenConversation(contact)}
                          className="h-8 text-xs font-semibold rounded-lg bg-primary text-primary-foreground shadow-2xs"
                        >
                          <Send className="h-3 w-3 mr-1" /> Mensagem
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
