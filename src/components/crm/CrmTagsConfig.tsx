import { useState, useEffect } from 'react';
import {
  Tag as TagIcon,
  Plus,
  RefreshCw,
  Check,
  Save,
  Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { CrmTag } from './CrmLeadDetailModal';

interface CrmTagsConfigProps {
  tenantId: string;
  tags: CrmTag[];
  onReloadTags: () => void;
}

export function CrmTagsConfig({
  tenantId,
  tags,
  onReloadTags
}: CrmTagsConfigProps) {
  const [tagForms, setTagForms] = useState<Record<string, { name: string; color: string }>>(() => {
    const initial: Record<string, { name: string; color: string }> = {};
    tags.forEach((t) => {
      initial[t.id] = { name: t.name, color: t.color || '#04d25d' };
    });
    return initial;
  });

  const [savingId, setSavingId] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#04d25d');
  const [creating, setCreating] = useState(false);
  const [isAddingNew, setIsAddingNew] = useState(false);

  // Sync state when props update
  useEffect(() => {
    setTagForms((prev) => {
      const updated = { ...prev };
      tags.forEach((t) => {
        if (!updated[t.id]) {
          updated[t.id] = { name: t.name, color: t.color || '#04d25d' };
        }
      });
      return updated;
    });
  }, [tags]);

  const handleUpdateTag = async (tagId: string) => {
    const form = tagForms[tagId];
    if (!form || !form.name.trim()) {
      toast.error('O nome da tag não pode ficar vazio.');
      return;
    }

    setSavingId(tagId);
    try {
      const { error } = await (supabase.from('crm_tags' as any) as any)
        .update({
          name: form.name.trim(),
          color: form.color,
          updated_at: new Date().toISOString()
        })
        .eq('id', tagId);

      if (error) throw error;
      toast.success('Tag atualizada com sucesso!');
      onReloadTags();
    } catch (err: any) {
      console.error('Erro ao atualizar tag:', err);
      toast.error('Falha ao atualizar tag: ' + err.message);
    } finally {
      setSavingId(null);
    }
  };

  const handleToggleActive = async (tag: CrmTag) => {
    setSavingId(tag.id);
    try {
      const nextStatus = !tag.is_active;
      const { error } = await (supabase.from('crm_tags' as any) as any)
        .update({
          is_active: nextStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', tag.id);

      if (error) throw error;
      toast.success(`Tag ${nextStatus ? 'ativada' : 'desativada'} com sucesso!`);
      onReloadTags();
    } catch (err: any) {
      console.error('Erro ao alterar status da tag:', err);
      toast.error('Falha ao alterar status: ' + err.message);
    } finally {
      setSavingId(null);
    }
  };

  const handleDeleteTag = async (tag: CrmTag) => {
    if (!confirm(`Deseja realmente excluir a tag "${tag.name}"?`)) {
      return;
    }

    setSavingId(tag.id);
    try {
      const { error } = await (supabase.from('crm_tags' as any) as any)
        .delete()
        .eq('id', tag.id);

      if (error) throw error;
      toast.success('Tag excluída com sucesso!');
      onReloadTags();
    } catch (err: any) {
      console.error('Erro ao excluir tag:', err);
      toast.error('Falha ao excluir tag: ' + err.message);
    } finally {
      setSavingId(null);
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) {
      toast.error('Informe o nome da nova tag.');
      return;
    }

    setCreating(true);
    try {
      const { error } = await (supabase.from('crm_tags' as any) as any).insert([
        {
          tenant_id: tenantId,
          name: newTagName.trim(),
          color: newTagColor,
          is_active: true
        }
      ]);

      if (error) throw error;
      toast.success('Nova tag criada com sucesso!');
      setNewTagName('');
      setIsAddingNew(false);
      onReloadTags();
    } catch (err: any) {
      console.error('Erro ao criar tag:', err);
      toast.error('Falha ao criar tag: ' + err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border/70 rounded-2xl p-6 shadow-sm space-y-6">
        {/* Header Title */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
            <TagIcon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Gerenciar Tags</h2>
            <p className="text-xs text-muted-foreground">
              Crie tags personalizadas para organizar e categorizar seus leads e clientes em potencial.
            </p>
          </div>
        </div>

        {/* Tags Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {tags.map((tag) => {
            const form = tagForms[tag.id] || { name: tag.name, color: tag.color };
            const isSaving = savingId === tag.id;

            return (
              <div
                key={tag.id}
                style={{ borderColor: `${form.color}50` }}
                className={`bg-secondary/10 border-2 rounded-2xl p-4 flex flex-col justify-between space-y-4 transition-all shadow-xs ${
                  !tag.is_active ? 'opacity-55' : ''
                }`}
              >
                {/* Tag Preview & Status Header */}
                <div className="flex items-center justify-between">
                  <span
                    style={{
                      backgroundColor: `${form.color}20`,
                      borderColor: `${form.color}55`,
                      color: form.color
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border shadow-2xs truncate max-w-[150px]"
                  >
                    <TagIcon className="h-3 w-3 shrink-0" />
                    <span className="truncate">{form.name || 'Sem nome'}</span>
                  </span>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      tag.is_active
                        ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
                        : 'bg-muted text-muted-foreground border border-border/40'
                    }`}
                  >
                    {tag.is_active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>

                {/* Fields */}
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-muted-foreground">Nome da Tag</Label>
                    <Input
                      value={form.name}
                      onChange={(e) =>
                        setTagForms({
                          ...tagForms,
                          [tag.id]: { ...form, name: e.target.value }
                        })
                      }
                      placeholder="Ex: Lead Quente"
                      className="h-8 text-xs bg-card border-border/60"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-muted-foreground">Cor da Tag</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={form.color}
                        onChange={(e) =>
                          setTagForms({
                            ...tagForms,
                            [tag.id]: { ...form, color: e.target.value }
                          })
                        }
                        className="w-8 h-8 rounded-lg border border-border/60 cursor-pointer p-0.5 bg-card"
                      />
                      <Input
                        value={form.color}
                        onChange={(e) =>
                          setTagForms({
                            ...tagForms,
                            [tag.id]: { ...form, color: e.target.value }
                          })
                        }
                        className="h-8 text-xs bg-card border-border/60 font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-2 pt-3 border-t border-border/40">
                  <Button
                    size="sm"
                    disabled={isSaving}
                    onClick={() => handleUpdateTag(tag.id)}
                    className="w-full h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold gap-1.5 shadow-xs"
                  >
                    {isSaving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    <span>Salvar Alterações</span>
                  </Button>

                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isSaving}
                      onClick={() => handleToggleActive(tag)}
                      className={`h-7 text-xs font-semibold px-2 border-border/70 ${
                        tag.is_active
                          ? 'text-amber-500 hover:text-amber-600 hover:bg-amber-500/10'
                          : 'text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10'
                      }`}
                    >
                      {tag.is_active ? 'Desativar' : 'Ativar'}
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isSaving}
                      onClick={() => handleDeleteTag(tag)}
                      className="h-7 text-xs font-semibold px-2 text-destructive hover:text-destructive hover:bg-destructive/10 border-border/70 gap-1"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>Excluir</span>
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Add Tag Section */}
        {isAddingNew ? (
          <div className="p-4 border-2 border-dashed border-primary/40 rounded-2xl bg-secondary/10 max-w-md space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Nova Tag</h3>
            <div className="space-y-2">
              <Input
                placeholder="Nome da tag (Ex: Proposta Aceita)"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                className="h-9 text-xs bg-card"
              />
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={newTagColor}
                  onChange={(e) => setNewTagColor(e.target.value)}
                  className="w-9 h-9 rounded-lg border border-border/60 cursor-pointer p-0.5 bg-card"
                />
                <Input
                  value={newTagColor}
                  onChange={(e) => setNewTagColor(e.target.value)}
                  className="h-9 text-xs bg-card font-mono"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={() => setIsAddingNew(false)} className="text-xs">
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleCreateTag}
                disabled={creating || !newTagName.trim()}
                className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              >
                {creating ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Salvar Tag
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <Button
              onClick={() => setIsAddingNew(true)}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs cursor-pointer shadow-xs"
            >
              <Plus className="h-4 w-4" /> Adicionar Nova Tag
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
