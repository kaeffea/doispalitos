import { useState, useEffect } from 'react'
import {
  X,
  Trash2,
  CheckCircle2,
  Package,
  Zap,
  Info,
} from 'lucide-react'
import api from '@/lib/api'
import { CurrencyInput, formatCurrencyBRL } from '@/components/CurrencyInput'
import { DayCalendarData } from './PurchasingCalendar'
import { getLocalDateString, formatDateBR, formatDateMask, parseDateBRtoISO, parseISOtoDateBR } from '@/lib/dateUtils'

interface BatchItemRow {
  id: string
  inventory_item_id: string
  name: string
  category: string
  base_unit: string
  current_stock: number
  frequency_days: number
  cycle_consumption_qty: number
  lead_time_days: number
  supplier_id: string
  brand_name: string
  quantity: string | number
  unit_cost: number
  total_cost: number
  packagings?: any[]
  custom_next_date?: string
  reschedule_next: boolean
}

interface PurchasingBatchModalProps {
  isOpen: boolean
  onClose: () => void
  dayData: DayCalendarData | null
  allItems: any[]
  suppliers: any[]
  onSuccess: () => void
  showFeedback: (type: 'success' | 'error', message: string) => void
}

export function PurchasingBatchModal({
  isOpen,
  onClose,
  dayData,
  allItems,
  suppliers,
  onSuccess,
  showFeedback,
}: PurchasingBatchModalProps) {
  const [purchaseType, setPurchaseType] = useState<'scheduled' | 'urgent'>('scheduled')
  const [purchaseDateBR, setPurchaseDateBR] = useState<string>('')
  const [notes, setNotes] = useState<string>('')
  const [rows, setRows] = useState<BatchItemRow[]>([])
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [selectedExtraItemId, setSelectedExtraItemId] = useState<string>('')

  // Popula linhas iniciais com os itens agendados para a data
  useEffect(() => {
    if (!dayData) return

    const todayStr = getLocalDateString()
    const isFuture = dayData.date > todayStr
    // Se o usuário clicou em um dia futuro no calendário, a data da compra realizada padrão é HOJE
    const initialIso = isFuture ? todayStr : dayData.date
    setPurchaseDateBR(parseISOtoDateBR(initialIso))
    setPurchaseType(dayData.scheduled_items.length > 0 ? 'scheduled' : 'urgent')
    setNotes('')

    const initialRows: BatchItemRow[] = dayData.scheduled_items.map((si) => {
      const fullItem = allItems.find((it) => it.id === si.item_id)
      const defaultSupplier = fullItem?.primary_supplier_id || suppliers[0]?.id || ''
      const defaultBrand = fullItem?.brand_name || ''
      const qty = si.suggested_buy_qty || si.cycle_consumption_qty || 1
      const uCost = fullItem?.average_cost_per_unit || si.unit_cost || 0
      const tCost = qty * uCost

      return {
        id: Math.random().toString(36).substring(2, 9),
        inventory_item_id: si.item_id,
        name: si.name,
        category: si.category,
        base_unit: si.base_unit,
        current_stock: si.current_stock,
        frequency_days: si.frequency_days || 7,
        cycle_consumption_qty: si.cycle_consumption_qty || 10,
        lead_time_days: si.lead_time_days || 0,
        supplier_id: defaultSupplier,
        brand_name: defaultBrand,
        quantity: String(qty),
        unit_cost: uCost,
        total_cost: tCost,
        packagings: fullItem?.packagings || [],
        reschedule_next: true,
      }
    })

    setRows(initialRows)
  }, [dayData, allItems, suppliers])

  if (!isOpen || !dayData) return null

  // Total da Compra
  const grandTotalCost = rows.reduce((acc, r) => acc + (Number(r.total_cost) || 0), 0)

  const handleUpdateRow = (id: string, updates: Partial<BatchItemRow>) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row
        const next = { ...row, ...updates }

        if (updates.quantity !== undefined || updates.total_cost !== undefined) {
          const qty = parseFloat(String(next.quantity)) || 0
          const tot = Number(next.total_cost) || 0
          next.unit_cost = qty > 0 ? tot / qty : 0
        }

        return next
      })
    )
  }

  const handleAddExtraItem = (itemId: string) => {
    if (!itemId) return
    const item = allItems.find((it) => it.id === itemId)
    if (!item) return

    const already = rows.find((r) => r.inventory_item_id === itemId)
    if (already) {
      showFeedback('error', `O insumo "${item.name}" já está na lista da compra.`)
      return
    }

    const qty = Number(item.cycle_consumption_qty) || Number(item.ideal_stock) || 1
    const uCost = Number(item.average_cost_per_unit) || 0
    const tCost = qty * uCost

    const newRow: BatchItemRow = {
      id: Math.random().toString(36).substring(2, 9),
      inventory_item_id: item.id,
      name: item.name,
      category: item.category,
      base_unit: item.base_unit,
      current_stock: Number(item.current_stock) || 0,
      frequency_days: Number(item.frequency_days) || 7,
      cycle_consumption_qty: qty,
      lead_time_days: Number(item.lead_time_days) || 0,
      supplier_id: item.primary_supplier_id || suppliers[0]?.id || '',
      brand_name: item.brand_name || '',
      quantity: String(qty),
      unit_cost: uCost,
      total_cost: tCost,
      packagings: item.packagings || [],
      reschedule_next: purchaseType === 'scheduled',
    }

    setRows((prev) => [...prev, newRow])
    setSelectedExtraItemId('')
  }

  const handleRemoveRow = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id))
  }

  const handleSaveBatch = async (e: React.FormEvent) => {
    e.preventDefault()

    if (rows.length === 0) {
      showFeedback('error', 'Adicione pelo menos 1 insumo para registrar a compra.')
      return
    }

    const parsedIso = parseDateBRtoISO(purchaseDateBR)
    if (!parsedIso) {
      showFeedback('error', 'Informe uma data válida no formato DD/MM/AAAA (ex: 23/08/2026).')
      return
    }

    const todayStr = getLocalDateString()
    if (parsedIso > todayStr) {
      showFeedback('error', 'Não é possível registrar compras com data futura. Registre com a data de hoje ou anterior.')
      return
    }

    try {
      setIsSaving(true)
      const payload = {
        purchase_date: parsedIso,
        purchase_type: purchaseType,
        notes: notes.trim() || null,
        items: rows.map((r) => {
          const qty = parseFloat(String(r.quantity)) || 0
          const tot = Number(r.total_cost) || 0
          const uCost = qty > 0 ? tot / qty : 0
          return {
            inventory_item_id: r.inventory_item_id,
            supplier_id: r.supplier_id || null,
            brand_name: r.brand_name.trim() || null,
            quantity: qty,
            unit_cost: uCost,
            total_cost: tot,
            reschedule_next: purchaseType === 'scheduled' ? r.reschedule_next : false,
            custom_next_date: r.custom_next_date || null,
          }
        }),
      }

      await api.post('/restaurant/inventory/purchases/batch', payload)
      showFeedback('success', `Compra de ${rows.length} insumos salva e estoque atualizado com sucesso!`)
      onSuccess()
      onClose()
    } catch (err: any) {
      showFeedback('error', err.response?.data?.message || 'Erro ao salvar compras do dia.')
    } finally {
      setIsSaving(false)
    }
  }

  const availableItemsToAdd = allItems.filter(
    (it) => !rows.some((r) => r.inventory_item_id === it.id)
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-5xl max-h-[94vh] flex flex-col bg-white dark:bg-[#121316] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden font-mono text-xs">
        
        {/* ─── Header da Planilha de Compras ──────────────────────────────── */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/80 dark:bg-zinc-900/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#F5DC55]/20 flex items-center justify-center text-[#D4B316] dark:text-[#F5DC55]">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-bold text-zinc-950 dark:text-zinc-50">
                  Planilha de Compras & Reposição
                </h3>
                <span className="px-2 py-0.5 bg-zinc-200/60 dark:bg-zinc-800 rounded text-[11px] font-bold text-zinc-600 dark:text-zinc-300">
                  {purchaseDateBR || formatDateBR(dayData.date)}
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 font-light">
                Confira as quantidades, marcas e preços para dar entrada no estoque com 1 clique.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ─── Configurações Rápidas do Cabeçalho da Compra ─────────────────── */}
        <div className="px-6 py-3 bg-zinc-100/50 dark:bg-zinc-900/30 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          
          {/* Seletor de Tipo de Compra */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-zinc-500 uppercase font-medium">Tipo:</span>
            <div className="flex items-center bg-white dark:bg-[#151619] border border-zinc-300 dark:border-zinc-700 p-0.5 rounded-lg">
              <button
                type="button"
                onClick={() => setPurchaseType('scheduled')}
                className={`px-3 py-1 rounded text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  purchaseType === 'scheduled'
                    ? 'bg-[#F5DC55] text-zinc-950 shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400'
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                <span>Compra de Ciclo (Programada)</span>
              </button>

              <button
                type="button"
                onClick={() => setPurchaseType('urgent')}
                className={`px-3 py-1 rounded text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  purchaseType === 'urgent'
                    ? 'bg-[#F5DC55] text-zinc-950 shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Reposição Pontual (Urgência)</span>
              </button>
            </div>
          </div>

          {/* Data da Compra */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-zinc-500 uppercase font-medium">Data Realizada:</span>
            <input
              type="text"
              inputMode="numeric"
              maxLength={10}
              placeholder="DD/MM/AAAA"
              value={purchaseDateBR}
              onChange={(e) => setPurchaseDateBR(formatDateMask(e.target.value))}
              className="w-28 px-2.5 py-1 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs text-zinc-900 dark:text-zinc-100 font-mono text-center focus:border-[#F5DC55] focus:outline-none font-bold"
            />
          </div>

        </div>

        {/* Aviso amigável caso tenha selecionado um dia futuro do calendário para comprar hoje */}
        {dayData.date > getLocalDateString() && (
          <div className="px-6 py-2.5 bg-[#F5DC55]/10 border-b border-[#F5DC55]/30 text-[11px] text-zinc-900 dark:text-zinc-100 flex items-center gap-2 shrink-0">
            <Info className="w-4 h-4 shrink-0 text-[#8A7100] dark:text-[#F5DC55]" />
            <span>
              Você selecionou os insumos previstos para <strong>{formatDateBR(dayData.date)}</strong>. Como a compra está sendo realizada <strong>hoje ({formatDateBR(getLocalDateString())})</strong>, ela será registrada na data atual e adicionará o saldo ao estoque imediatamente.
            </span>
          </div>
        )}

        {/* ─── Tabela / Planilha Interativa ────────────────────────────────── */}
        <form onSubmit={handleSaveBatch} className="flex-1 overflow-y-auto flex flex-col">
          
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left text-xs divide-y divide-zinc-200 dark:divide-zinc-800">
              <thead className="bg-zinc-50 dark:bg-zinc-900/80 text-[10px] uppercase text-zinc-500 sticky top-0 z-10 border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <th className="py-2.5 px-4">Insumo</th>
                  <th className="py-2.5 px-3">Marca & Fornecedor</th>
                  <th className="py-2.5 px-3 w-32 text-center">Quantidade</th>
                  <th className="py-2.5 px-3 w-32">Total Pago (R$)</th>
                  <th className="py-2.5 px-3 w-28">Custo Unitário</th>
                  {purchaseType === 'scheduled' && (
                    <th className="py-2.5 px-3 w-36 text-center">Próxima Compra</th>
                  )}
                  <th className="py-2.5 px-3 w-12 text-center"></th>
                </tr>
              </thead>

              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/80 bg-white dark:bg-[#121316]">
                {rows.map((row) => {
                  const numQty = parseFloat(String(row.quantity)) || 0
                  const unitCostCalculated = numQty > 0 ? Number(row.total_cost) / numQty : 0

                  return (
                    <tr key={row.id} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-900/40 transition-colors">
                      
                      {/* Coluna 1: Insumo & Estoque Atual */}
                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          <div className="font-bold text-zinc-950 dark:text-zinc-50 text-xs flex items-center gap-1.5">
                            <span>{row.name}</span>
                            <span className="px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-[10px] text-zinc-500 font-normal">
                              {row.base_unit}
                            </span>
                          </div>
                          <div className="text-[10px] text-zinc-400">
                            Estoque atual: <strong>{row.current_stock} {row.base_unit}</strong> • Ciclo: a cada {row.frequency_days} dias (~{(row.cycle_consumption_qty / row.frequency_days).toFixed(2)}/dia)
                          </div>
                        </div>
                      </td>

                      {/* Coluna 2: Marca & Fornecedor */}
                      <td className="py-3 px-3">
                        <div className="space-y-1.5">
                          <input
                            type="text"
                            placeholder="Marca comprada (ex: Tirolez)"
                            value={row.brand_name}
                            onChange={(e) => handleUpdateRow(row.id, { brand_name: e.target.value })}
                            className="w-full px-2 py-1 bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-[#F5DC55] focus:outline-none"
                          />

                          <select
                            value={row.supplier_id}
                            onChange={(e) => handleUpdateRow(row.id, { supplier_id: e.target.value })}
                            className="w-full px-2 py-1 bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded text-[11px] text-zinc-700 dark:text-zinc-300 focus:border-[#F5DC55] focus:outline-none"
                          >
                            <option value="">Sem fornecedor fixo</option>
                            {suppliers.map((s) => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                        </div>
                      </td>

                      {/* Coluna 3: Quantidade Comprada */}
                      <td className="py-3 px-3">
                        <div className="space-y-0.5">
                          <div className="relative">
                            <input
                              type="number"
                              step="0.001"
                              min="0.001"
                              required
                              value={row.quantity}
                              onChange={(e) => handleUpdateRow(row.id, { quantity: e.target.value })}
                              className="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg text-center font-bold text-zinc-950 dark:text-zinc-50 focus:border-[#F5DC55] focus:outline-none"
                            />
                            <span className="absolute right-2 top-1.5 text-[10px] text-zinc-400 pointer-events-none">
                              {row.base_unit}
                            </span>
                          </div>
                          <span className="text-[10px] text-zinc-400 block text-center">
                            Sugerido: {row.cycle_consumption_qty} {row.base_unit}
                          </span>
                        </div>
                      </td>

                      {/* Coluna 4: Total Pago (R$) */}
                      <td className="py-3 px-3">
                        <CurrencyInput
                          value={row.total_cost}
                          onChange={(val) => handleUpdateRow(row.id, { total_cost: val })}
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg font-bold font-mono text-right text-zinc-950 dark:text-zinc-50 focus:border-[#F5DC55] focus:outline-none"
                        />
                      </td>

                      {/* Coluna 5: Custo Unitário Calculado */}
                      <td className="py-3 px-3 font-mono">
                        <span className="font-bold text-zinc-900 dark:text-zinc-100 block">
                          R$ {formatCurrencyBRL(unitCostCalculated)} / {row.base_unit}
                        </span>
                        {(row.base_unit === 'kg' || row.base_unit === 'L') && unitCostCalculated > 0 && (
                          <span className="text-[10px] text-zinc-400">
                            (R$ {(unitCostCalculated / 1000).toFixed(4)} / {row.base_unit === 'kg' ? 'g' : 'ml'})
                          </span>
                        )}
                      </td>

                      {/* Coluna 6: Próxima Compra do Ciclo (Apenas em Compra Programada) */}
                      {purchaseType === 'scheduled' && (
                        <td className="py-3 px-3 text-center">
                          <div className="space-y-1">
                            <span className="px-2 py-0.5 bg-[#F5DC55]/15 text-zinc-900 dark:text-zinc-100 rounded text-[10px] font-bold block">
                              + {row.frequency_days} dias
                            </span>
                            <span className="text-[9px] text-zinc-400 block">
                              {(() => {
                                const iso = parseDateBRtoISO(purchaseDateBR) || dayData.date
                                const nextObj = new Date(new Date(iso + 'T12:00:00').getTime() + row.frequency_days * 86400000)
                                return `(Próx: ${nextObj.toLocaleDateString('pt-BR')})`
                              })()}
                            </span>
                          </div>
                        </td>
                      )}

                      {/* Coluna 7: Ações / Remover Linha */}
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(row.id)}
                          className="p-1.5 text-zinc-400 hover:text-red-500 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                          title="Remover da lista de compras"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>

                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* ─── Adicionar Insumo Extra na Compra ──────────────────────────── */}
          <div className="p-4 bg-zinc-50 dark:bg-zinc-900/40 border-t border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
            
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <select
                value={selectedExtraItemId}
                onChange={(e) => {
                  setSelectedExtraItemId(e.target.value)
                  handleAddExtraItem(e.target.value)
                }}
                className="w-full px-3 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none"
              >
                <option value="">+ Adicionar outro insumo na compra...</option>
                {availableItemsToAdd.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name} {it.brand_name ? `(${it.brand_name})` : ''} - Atual: {it.current_stock} {it.base_unit}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono">
              <span className="text-zinc-500">
                Itens selecionados: <strong>{rows.length}</strong>
              </span>
              <div className="text-base font-bold text-zinc-950 dark:text-zinc-50 flex items-center gap-1.5">
                <span>Total da Compra:</span>
                <span className="text-emerald-600 dark:text-emerald-400">R$ {formatCurrencyBRL(grandTotalCost)}</span>
              </div>
            </div>

          </div>

          {/* ─── Footer com Ações ────────────────────────────────────────── */}
          <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121316] flex items-center justify-between gap-3 shrink-0">
            <div className="text-[11px] text-zinc-500 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-[#D4B316] dark:text-[#F5DC55] shrink-0" />
              <span>
                {purchaseType === 'scheduled'
                  ? 'Todas as compras salvarão o novo estoque e avançarão os cronogramas de ciclo automaticamente.'
                  : 'A reposição de urgência atualizará o estoque sem alterar o dia da compra principal programada.'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs uppercase hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={isSaving || rows.length === 0}
                className="px-6 py-2 bg-[#F5DC55] hover:bg-[#E5CB3C] disabled:opacity-50 text-zinc-950 font-bold text-xs uppercase rounded-lg shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSaving ? 'Salvando...' : 'Concluir e Salvar Compras'}</span>
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  )
}
