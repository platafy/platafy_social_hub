import { useState, useEffect } from 'react';
import {
  Columns3,
  Plus,
  GripVertical,
  RefreshCw,
  Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { CrmColumn } from './CrmLeadDetailModal';

interface CrmColumnsConfigProps {
  tenantId: string;
  columns: CrmColumn[];
  onReloadColumns: () => void;
}

export function CrmColumnsConfig({
  tenantId,
  columns,
  onReloadColumns
}: CrmColumnsConfigProps) {
  const [columnForms, setColumnForms] = useState<Record<string, { name: string; color: string }>>(() => {
    const initial: Record<string, { name: string; color: string }> = {};
    columns.forEach((col) => {
      initial[col.id] = { name: col.name, color: col.color || '#758fff' };
    });
    return initial;
  });

  const [savingId, setSavingId] = useState<string | null>(null);
  const [newColumnName, setNewColumnName] = useState('');
  const [newColumnColor, setNewColumnColor] = useState('#3b82f6');
  const [creating, setCreating] = useState(false);
  const [isAddingNew, setIsAddingNew] = useState(false);

  // Re-sync local state when props change
  useEffect(() => {
    setColumnForms((prev) => {
      const updated = { ...prev };
      columns.forEach((col) => {
        if (!updated[col.id]) {
          updated[col.id] = { name: col.name, color: col.color || '#758fff' };
        }
      });
      return updated;
    });
  }, [columns]);

  const handleUpdateColumn = async (columnId: string) => {
    const form = columnForms[columnId];
    if (!form || !form.name.trim()) {
      toast.error('O nome da coluna não pode ficar vazio.');
      return;
    }

    setSavingId(columnId);
    try {
      const { error } = await (supabase.from('crm_columns' as any) as any)
        .update({
          name: form.name.trim(),
          color: form.color,
          updated_at: new Date().toISOString()
        })
        .eq('id', columnId);

      if (error) throw error;
      toast.success('Coluna atualizada com sucesso!');
      onReloadColumns();
    } catch (err: any) {
      console.error('Erro ao atualizar coluna:', err);
      toast.error('Falha ao atualizar coluna: ' + err.message);
    } finally {
      setSavingId(null);
    }
  };

  const handleToggleActive = async (column: CrmColumn) => {
    setSavingId(column.id);
    try {
      const nextStatus = !column.is_active;
      const { error } = await (supabase.from('crm_columns' as any) as any)
        .update({
          is_active: nextStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', column.id);

      if (error) throw error;
      toast.success(`Coluna ${nextStatus ? 'ativada' : 'desativada'} com sucesso!`);
      onReloadColumns();
    } catch (err: any) {
      console.error('Erro ao alterar status da coluna:', err);
      toast.error('Falha ao alterar status: ' + err.message);
    } finally {
      setSavingId(null);
    }
  };

  const handleDeleteColumn = async (column: CrmColumn) => {
    if (columns.length <= 1) {
      toast.error('Você precisa ter pelo menos uma etapa no seu funil.');
      return;
    }

    if (!confirm(`Deseja realmente excluir a coluna "${column.name}"? Os leads vinculados a ela permanecerão no CRM sem etapa definida.`)) {
      return;
    }

    setSavingId(column.id);
    try {
      const { error } = await (supabase.from('crm_columns' as any) as any)
        .delete()
        .eq('id', column.id);

      if (error) throw error;
      toast.success('Coluna excluída com sucesso!');
      onReloadColumns();
    } catch (err: any) {
      console.error('Erro ao excluir coluna:', err);
      toast.error('Falha ao excluir coluna: ' + err.message);
    } finally {
      setSavingId(null);
    }
  };

  const handleCreateColumn = async () => {
    if (!newColumnName.trim()) {
      toast.error('Informe o nome da nova coluna.');
      return;
    }

    setCreating(true);
    try {
      const nextOrder = columns.length > 0 ? Math.max(...columns.map((c) => c.order_index)) + 1 : 0;
      const { error } = await (supabase.from('crm_columns' as any) as any).insert([
        {
          tenant_id: tenantId,
          name: newColumnName.trim(),
          color: newColumnColor,
          order_index: nextOrder,
          is_active: true
        }
      ]);

      if (error) throw error;
      toast.success('Nova coluna criada com sucesso!');
      setNewColumnName('');
      setIsAddingNew(false);
      onReloadColumns();
    } catch (err: any) {
      console.error('Erro ao criar coluna:', err);
      toast.error('Falha ao criar coluna: ' + err.message);
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
            <Columns3 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Configurar Colunas do Kanban</h2>
            <p className="text-xs text-muted-foreground">
              Configure as etapas do seu funil de vendas para categorizar os leads das redes sociais.
            </p>
          </div>
        </div>

        {/* Columns Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {columns.map((col, index) => {
            const form = columnForms[col.id] || { name: col.name, color: col.color };
            const isSaving = savingId === col.id;

            return (
              <div
                key={col.id}
                style={{ borderColor: `${form.color}50` }}
                className={`bg-secondary/10 border-2 rounded-2xl p-4 flex flex-col justify-between space-y-4 transition-all shadow-xs ${
                  !col.is_active ? 'opacity-55' : ''
                }`}
              >
                {/* Column Card Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-md bg-secondary/30 text-foreground border border-border/40">
                    <GripVertical className="h-3.5 w-3.5 text-muted-foreground cursor-grab" />
                    <span>Coluna #{index + 1}</span>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      col.is_active
                        ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
                        : 'bg-muted text-muted-foreground border border-border/40'
                    }`}
                  >
                    {col.is_active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>

                {/* Fields */}
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-muted-foreground">Nome da Coluna</Label>
                    <Input
                      value={form.name}
                      onChange={(e) =>
                        setColumnForms({
                          ...columnForms,
                          [col.id]: { ...form, name: e.target.value }
                        })
                      }
                      placeholder="Ex: Em Negociação"
                      className="h-8 text-xs bg-card border-border/60"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-muted-foreground">Cor da Coluna</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={form.color}
                        onChange={(e) =>
                          setColumnForms({
                            ...columnForms,
                            [col.id]: { ...form, color: e.target.value }
                          })
                        }
                        className="w-8 h-8 rounded-lg border border-border/60 cursor-pointer p-0.5 bg-card"
                      />
                      <Input
                        value={form.color}
                        onChange={(e) =>
                          setColumnForms({
                            ...columnForms,
                            [col.id]: { ...form, color: e.target.value }
                          })
                        }
                        className="h-8 text-xs bg-card border-border/60 font-mono"
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground block pt-0.5">
                      Identificação visual da coluna no Kanban
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-border/40">
                  <Button
                    size="sm"
                    variant="default"
                    disabled={isSaving}
                    onClick={() => handleUpdateColumn(col.id)}
                    className="h-7 text-[11px] px-1 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                  >
                    {isSaving ? <RefreshCw className="h-3 w-3 animate-spin" /> : 'Atualizar'}
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isSaving}
                    onClick={() => handleToggleActive(col)}
                    className={`h-7 text-[11px] px-1 font-semibold ${
                      col.is_active ? 'text-amber-500 hover:text-amber-600' : 'text-emerald-500 hover:text-emerald-600'
                    }`}
                  >
                    {col.is_active ? 'Desativar' : 'Ativar'}
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isSaving}
                    onClick={() => handleDeleteColumn(col)}
                    className="h-7 text-[11px] px-1 text-destructive hover:bg-destructive/10 font-semibold"
                  >
                    Deletar
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Add Column Section */}
        {isAddingNew ? (
          <div className="p-4 border-2 border-dashed border-primary/40 rounded-2xl bg-secondary/10 max-w-md space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Nova Etapa do Funil</h3>
            <div className="space-y-2">
              <Input
                placeholder="Nome da etapa (Ex: Proposta Apresentada)"
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
                className="h-9 text-xs bg-card"
              />
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={newColumnColor}
                  onChange={(e) => setNewColumnColor(e.target.value)}
                  className="w-9 h-9 rounded-lg border border-border/60 cursor-pointer p-0.5 bg-card"
                />
                <Input
                  value={newColumnColor}
                  onChange={(e) => setNewColumnColor(e.target.value)}
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
                onClick={handleCreateColumn}
                disabled={creating || !newColumnName.trim()}
                className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              >
                {creating ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Salvar Etapa
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <Button
              onClick={() => setIsAddingNew(true)}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs cursor-pointer shadow-xs"
            >
              <Plus className="h-4 w-4" /> Adicionar Nova Coluna
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
