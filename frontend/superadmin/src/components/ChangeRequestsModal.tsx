import { useState, useEffect } from 'react'
import api from '@/lib/api'
import {
  X,
  Loader2,
  Clock,
  CheckCircle2,
  XCircle,
  Edit3,
  AlertCircle,
  Check,
} from 'lucide-react'
import {
  formatPhone,
  formatDocument,
  formatCpf,
  formatCep,
  formatSlug
} from '@/lib/maskUtils'

interface ChangeRequestsModalProps {
  isOpen: boolean
  onClose: () => void
  onTenantUpdated: () => void
}

export function ChangeRequestsModal({
  isOpen,
  onClose,
  onTenantUpdated,
}: ChangeRequestsModalProps) {
  const [requests, setRequests] = useState<any[]>([])
  const [filterStatus, setFilterStatus] = useState<'pending' | 'approved' | 'all'>('pending')
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)

  // Rejection dialog
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false)
  const [rejectNotes, setRejectNotes] = useState('')

  // Edit & Approve modal
  const [isEditMode, setIsEditMode] = useState(false)
  const [editFormData, setEditFormData] = useState<any>(null)
  const [editNotes, setEditNotes] = useState('')

  const fetchRequests = async () => {
    setIsLoading(true)
    try {
      const res = await api.get('/admin/change-requests')
      setRequests(res.data.change_requests || [])
      if (selectedRequest) {
        const updated = res.data.change_requests.find((r: any) => r.id === selectedRequest.id)
        if (updated) setSelectedRequest(updated)
      } else if (res.data.change_requests && res.data.change_requests.length > 0) {
        // Auto select first pending or first available
        const firstPending = res.data.change_requests.find((r: any) => r.status === 'pending')
        setSelectedRequest(firstPending || res.data.change_requests[0])
      }
    } catch (err) {
      console.error('Erro ao buscar solicitações:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchRequests()
      setActionError(null)
      setActionSuccess(null)
    }
  }, [isOpen])

  if (!isOpen) return null

  const filteredRequests = requests.filter((r) => {
    if (filterStatus === 'all') return true
    if (filterStatus === 'pending') return r.status === 'pending'
    if (filterStatus === 'approved') return r.status === 'approved' || r.status === 'edited_and_approved' || r.status === 'rejected'
    return true
  })

  // Handle Approve
  const handleApprove = async () => {
    if (!selectedRequest) return
    setIsProcessing(true)
    setActionError(null)
    setActionSuccess(null)

    try {
      const res = await api.post(`/admin/change-requests/${selectedRequest.id}/approve`)
      setActionSuccess(res.data.message)
      await fetchRequests()
      onTenantUpdated()
    } catch (err: any) {
      setActionError(err.response?.data?.message || 'Erro ao aprovar solicitação.')
    } finally {
      setIsProcessing(false)
    }
  }

  // Handle Reject
  const handleReject = async () => {
    if (!selectedRequest) return
    if (!rejectNotes.trim()) {
      setActionError('O motivo da recusa é obrigatório.')
      return
    }

    setIsProcessing(true)
    setActionError(null)
    setActionSuccess(null)

    try {
      const res = await api.post(`/admin/change-requests/${selectedRequest.id}/reject`, {
        admin_notes: rejectNotes.trim(),
      })
      setActionSuccess(res.data.message)
      setIsRejectModalOpen(false)
      setRejectNotes('')
      await fetchRequests()
      onTenantUpdated()
    } catch (err: any) {
      setActionError(err.response?.data?.message || 'Erro ao recusar solicitação.')
    } finally {
      setIsProcessing(false)
    }
  }

  // Handle Edit & Approve
  const handleStartEdit = () => {
    if (!selectedRequest) return
    setEditFormData({ ...selectedRequest.requested_data })
    setEditNotes('')
    setIsEditMode(true)
  }

  const handleSubmitEditAndApprove = async () => {
    if (!selectedRequest || !editFormData) return
    if (!editNotes.trim()) {
      setActionError('A justificativa das alterações realizadas é obrigatória.')
      return
    }

    setIsProcessing(true)
    setActionError(null)
    setActionSuccess(null)

    try {
      const payload = {
        ...editFormData,
        admin_notes: editNotes.trim(),
      }
      const res = await api.post(`/admin/change-requests/${selectedRequest.id}/edit-and-approve`, payload)
      setActionSuccess(res.data.message)
      setIsEditMode(false)
      await fetchRequests()
      onTenantUpdated()
    } catch (err: any) {
      setActionError(err.response?.data?.message || 'Erro ao editar e aprovar.')
    } finally {
      setIsProcessing(false)
    }
  }

  const isPending = selectedRequest?.status === 'pending'

  const renderDiffRow = (
    label: string,
    currentVal: string | number | null | undefined,
    requestedVal: string | number | null | undefined,
    formatter?: (v: any) => string
  ) => {
    const formattedCur = formatter ? formatter(String(currentVal ?? '')) : ''
    const formattedReq = formatter ? formatter(String(requestedVal ?? '')) : ''

    const cur = formattedCur || (currentVal !== null && currentVal !== undefined && String(currentVal).trim() !== '' ? String(currentVal).trim() : '—')
    const req = formattedReq || (requestedVal !== null && requestedVal !== undefined && String(requestedVal).trim() !== '' ? String(requestedVal).trim() : '—')

    // Normalize for comparison (removing formatting punctuation for documents, phones, ceps)
    const normalize = (val: string | number | null | undefined) => {
      if (val === null || val === undefined) return ''
      const s = String(val).trim()
      if (formatter === formatPhone || formatter === formatDocument || formatter === formatCpf || formatter === formatCep) {
        return s.replace(/\D/g, '')
      }
      return s
    }

    const isChanged = normalize(currentVal) !== normalize(requestedVal)

    // Ordem das colunas:
    // PENDENTE: Campo | Valor Atual | Valor Solicitado
    // CONCLUÍDO: Campo | Valor Solicitado | Valor Efetivo / Atual
    const col2Value = isPending ? cur : req
    const col3Value = isPending ? req : cur

    return (
      <div className="px-4 py-3 grid grid-cols-12 items-center text-xs">
        <div className="col-span-4 font-mono text-zinc-500 flex items-center gap-2 pr-2">
          <span>{label}</span>
          {isChanged && (
            <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded">
              Alterado
            </span>
          )}
        </div>
        
        {/* Coluna 2 */}
        <div className={`col-span-4 font-mono pr-2 ${
          isPending 
            ? 'text-zinc-400 dark:text-zinc-500' 
            : (isChanged ? 'text-zinc-950 dark:text-zinc-50 font-medium' : 'text-zinc-400 dark:text-zinc-500')
        }`}>
          {col2Value}
        </div>

        {/* Coluna 3 */}
        <div className={`col-span-4 font-mono ${
          isPending
            ? (isChanged ? 'text-zinc-950 dark:text-zinc-50 font-medium' : 'text-zinc-400 dark:text-zinc-500')
            : 'text-zinc-500 dark:text-zinc-400'
        }`}>
          {col3Value}
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-5xl bg-[#F8F7F4] dark:bg-[#0F1012] h-full shadow-2xl flex flex-col border-l border-zinc-200 dark:border-zinc-800 animate-in slide-in-from-right duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-[#141416]">
          <div>
            <span className="text-[11px] font-mono uppercase text-[#D4B316] dark:text-[#F5DC55] tracking-wider block">
              Super Admin // Governança Cadastral
            </span>
            <h2 className="text-lg font-medium text-zinc-950 dark:text-zinc-50">
              Solicitações de Alteração
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Feedback Messages */}
        {actionError && (
          <div className="mx-6 mt-4 p-3 bg-red-500/10 border-l-2 border-red-500 text-xs font-mono text-red-600 dark:text-red-400 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{actionError}</span>
          </div>
        )}
        {actionSuccess && (
          <div className="mx-6 mt-4 p-3 bg-emerald-500/10 border-l-2 border-emerald-500 text-xs font-mono text-emerald-600 dark:text-emerald-400 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* Layout: Sidebar com lista + Painel de Diff */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Coluna Esquerda: Lista de Solicitações (Largura ampla para caber o nome) */}
          <div className="w-84 border-r border-zinc-200 dark:border-zinc-800 flex flex-col bg-zinc-50 dark:bg-zinc-900/30">
            
            {/* Filtros de Status (Cores Neutras Limpas) */}
            <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 grid grid-cols-3 gap-1.5 text-xs font-mono">
              <button
                type="button"
                onClick={() => setFilterStatus('pending')}
                className={`py-1.5 px-2 text-center rounded-md transition-colors cursor-pointer border ${
                  filterStatus === 'pending'
                    ? 'bg-white dark:bg-[#1C1D22] border-zinc-300 dark:border-zinc-700 text-zinc-950 dark:text-zinc-50 font-bold shadow-2xs'
                    : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                }`}
              >
                Pendentes
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('approved')}
                className={`py-1.5 px-2 text-center rounded-md transition-colors cursor-pointer border ${
                  filterStatus === 'approved'
                    ? 'bg-white dark:bg-[#1C1D22] border-zinc-300 dark:border-zinc-700 text-zinc-950 dark:text-zinc-50 font-bold shadow-2xs'
                    : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                }`}
              >
                Concluídas
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('all')}
                className={`py-1.5 px-2 text-center rounded-md transition-colors cursor-pointer border ${
                  filterStatus === 'all'
                    ? 'bg-white dark:bg-[#1C1D22] border-zinc-300 dark:border-zinc-700 text-zinc-950 dark:text-zinc-50 font-bold shadow-2xs'
                    : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                }`}
              >
                Todas
              </button>
            </div>

            {/* Lista com scroll */}
            <div className="flex-1 overflow-y-auto divide-y divide-zinc-200 dark:divide-zinc-800/80">
              {isLoading ? (
                <div className="p-8 text-center text-xs font-mono text-zinc-400 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-[#F5DC55]" />
                  <span>Carregando solicitações...</span>
                </div>
              ) : filteredRequests.length === 0 ? (
                <div className="p-8 text-center text-xs font-mono text-zinc-400">
                  Nenhuma solicitação encontrada.
                </div>
              ) : (
                filteredRequests.map((req) => (
                  <button
                    key={req.id}
                    type="button"
                    onClick={() => {
                      setSelectedRequest(req)
                      setIsEditMode(false)
                      setActionError(null)
                      setActionSuccess(null)
                    }}
                    className={`w-full p-3.5 text-left transition-all cursor-pointer flex flex-col gap-1 ${
                      selectedRequest?.id === req.id
                        ? 'bg-white dark:bg-[#1C1D22] border-l-4 border-[#F5DC55]'
                        : 'hover:bg-zinc-100/80 dark:hover:bg-zinc-800/40 border-l-4 border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-mono font-semibold text-zinc-950 dark:text-zinc-50 truncate flex-1">
                        {req.tenant?.name || req.requested_data?.name}
                      </span>
                      
                      {/* Tag de Status Sólida e Discreta */}
                      {req.status === 'pending' && (
                        <span className="px-1.5 py-0.5 bg-[#F5DC55] text-zinc-950 text-[10px] font-mono font-bold uppercase rounded shrink-0">
                          Pendente
                        </span>
                      )}
                      {req.status === 'approved' && (
                        <span className="px-1.5 py-0.5 bg-emerald-700 text-emerald-50 text-[10px] font-mono font-medium uppercase rounded shrink-0">
                          Aprovada
                        </span>
                      )}
                      {req.status === 'edited_and_approved' && (
                        <span className="px-1.5 py-0.5 bg-blue-700 text-blue-50 text-[10px] font-mono font-medium uppercase rounded shrink-0">
                          Editada
                        </span>
                      )}
                      {req.status === 'rejected' && (
                        <span className="px-1.5 py-0.5 bg-red-700 text-red-50 text-[10px] font-mono font-medium uppercase rounded shrink-0">
                          Recusada
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] font-mono text-zinc-500 flex items-center justify-between">
                      <span>Por {req.requester?.name || 'Gestor'}</span>
                      <span>
                        {new Date(req.created_at).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                        })}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>

          </div>

          {/* Coluna Direita: Diff Comparativo & Ações */}
          <div className="flex-1 flex flex-col overflow-hidden bg-[#F8F7F4] dark:bg-[#0F1012]">
            {!selectedRequest ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-zinc-400 text-xs font-mono">
                <Clock className="w-8 h-8 text-zinc-300 dark:text-zinc-700 mb-2" />
                <p>Selecione uma solicitação ao lado para analisar as alterações.</p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col overflow-hidden">
                
                {/* Cabeçalho do Detalhe (Limpo e sem e-mail duplicado) */}
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#141416] flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                      {selectedRequest.tenant?.name}
                    </h3>
                    <p className="text-xs font-mono text-zinc-500">
                      Solicitado por <span className="text-zinc-800 dark:text-zinc-200 font-medium">{selectedRequest.requester?.name}</span> em{' '}
                      {new Date(selectedRequest.created_at).toLocaleString('pt-BR')}
                    </p>
                    {selectedRequest.reviewed_at && (
                      <p className="text-[11px] font-mono text-zinc-400">
                        Decisão registrada em {new Date(selectedRequest.reviewed_at).toLocaleString('pt-BR')} por {selectedRequest.reviewer?.name || 'Super Admin'}
                      </p>
                    )}
                  </div>

                  <div>
                    {selectedRequest.status === 'pending' && (
                      <span className="px-2.5 py-1 bg-[#F5DC55] text-zinc-950 rounded text-xs font-mono font-bold uppercase tracking-wider">
                        Pendente
                      </span>
                    )}
                    {selectedRequest.status === 'approved' && (
                      <span className="px-2.5 py-1 bg-emerald-700 text-emerald-50 rounded text-xs font-mono font-medium uppercase">
                        Aprovada
                      </span>
                    )}
                    {selectedRequest.status === 'edited_and_approved' && (
                      <span className="px-2.5 py-1 bg-blue-700 text-blue-50 rounded text-xs font-mono font-medium uppercase">
                        Editada & Aprovada
                      </span>
                    )}
                    {selectedRequest.status === 'rejected' && (
                      <span className="px-2.5 py-1 bg-red-700 text-red-50 rounded text-xs font-mono font-medium uppercase">
                        Recusada
                      </span>
                    )}
                  </div>
                </div>

                {/* Justificativa de Recusa ou Notas Anteriores */}
                {selectedRequest.admin_notes && (
                  <div className="mx-6 mt-4 p-3 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded text-xs font-mono">
                    <span className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">Notas da Administração:</span>
                    <p className="text-zinc-600 dark:text-zinc-400">{selectedRequest.admin_notes}</p>
                  </div>
                )}

                {/* Visualizador de Diff (Scroll fluído único) */}
                <div className="flex-1 overflow-y-auto p-6">
                  
                  <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden bg-white dark:bg-[#16171B] divide-y divide-zinc-200 dark:divide-zinc-800">
                    
                    {/* Header da Tabela */}
                    <div className="px-4 py-2.5 grid grid-cols-12 text-[11px] font-mono uppercase tracking-wider text-zinc-400 bg-zinc-100/60 dark:bg-zinc-900/40">
                      <span className="col-span-4">Campo Cadastral</span>
                      <span className="col-span-4">{isPending ? 'Valor Atual' : 'Valor Solicitado'}</span>
                      <span className="col-span-4">{isPending ? 'Valor Solicitado' : 'Valor Efetivo'}</span>
                    </div>

                    {/* Dados do Estabelecimento */}
                    {renderDiffRow('Nome Fantasia', selectedRequest.current_data?.name, selectedRequest.requested_data?.name)}
                    {renderDiffRow('Razão Social', selectedRequest.current_data?.legal_name, selectedRequest.requested_data?.legal_name)}
                    {renderDiffRow('CNPJ / CPF', selectedRequest.current_data?.document, selectedRequest.requested_data?.document, formatDocument)}
                    {renderDiffRow('Tipo de Domínio', selectedRequest.current_data?.domain_type, selectedRequest.requested_data?.domain_type)}
                    {renderDiffRow('Subdomínio', selectedRequest.current_data?.slug, selectedRequest.requested_data?.slug)}
                    {renderDiffRow('Domínio Próprio', selectedRequest.current_data?.custom_domain, selectedRequest.requested_data?.custom_domain)}
                    {renderDiffRow('E-mail Comercial', selectedRequest.current_data?.email, selectedRequest.requested_data?.email)}
                    {renderDiffRow('Telefone Comercial', selectedRequest.current_data?.phone, selectedRequest.requested_data?.phone, formatPhone)}

                    {/* Endereço */}
                    {renderDiffRow('CEP', selectedRequest.current_data?.postal_code, selectedRequest.requested_data?.postal_code, formatCep)}
                    {renderDiffRow('Estado (UF)', selectedRequest.current_data?.state, selectedRequest.requested_data?.state)}
                    {renderDiffRow('Cidade', selectedRequest.current_data?.city, selectedRequest.requested_data?.city)}
                    {renderDiffRow('Logradouro', selectedRequest.current_data?.street, selectedRequest.requested_data?.street)}
                    {renderDiffRow('Número', selectedRequest.current_data?.number, selectedRequest.requested_data?.number)}
                    {renderDiffRow('Complemento', selectedRequest.current_data?.complement, selectedRequest.requested_data?.complement)}
                    {renderDiffRow('Bairro', selectedRequest.current_data?.neighborhood, selectedRequest.requested_data?.neighborhood)}
                    {renderDiffRow(
                      'Coordenadas GPS',
                      selectedRequest.current_data?.latitude ? `${Number(selectedRequest.current_data.latitude).toFixed(5)}, ${Number(selectedRequest.current_data.longitude).toFixed(5)}` : null,
                      selectedRequest.requested_data?.latitude ? `${Number(selectedRequest.requested_data.latitude).toFixed(5)}, ${Number(selectedRequest.requested_data.longitude).toFixed(5)}` : null
                    )}

                    {/* Gestor */}
                    {renderDiffRow('Nome do Gestor', selectedRequest.current_data?.owner_name, selectedRequest.requested_data?.owner_name)}
                    {renderDiffRow('E-mail do Gestor', selectedRequest.current_data?.owner_email, selectedRequest.requested_data?.owner_email)}
                    {renderDiffRow('Telefone do Gestor', selectedRequest.current_data?.owner_phone, selectedRequest.requested_data?.owner_phone, formatPhone)}
                    {renderDiffRow('CPF do Gestor', selectedRequest.current_data?.owner_document, selectedRequest.requested_data?.owner_document, formatCpf)}

                  </div>

                </div>

                {/* Barra de Ações Fixa (Apenas quando pendente) */}
                {selectedRequest.status === 'pending' && (
                  <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#141416] flex items-center justify-between gap-4">
                    
                    <button
                      type="button"
                      onClick={() => setIsRejectModalOpen(true)}
                      disabled={isProcessing}
                      className="px-4 py-2.5 border border-zinc-300 dark:border-zinc-700 hover:border-red-500 hover:text-red-500 text-zinc-600 dark:text-zinc-400 text-xs font-mono font-medium rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Recusar</span>
                    </button>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={handleStartEdit}
                        disabled={isProcessing}
                        className="px-4 py-2.5 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-mono font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Editar e Aprovar</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleApprove}
                        disabled={isProcessing}
                        className="px-5 py-2.5 bg-[#F5DC55] hover:bg-[#E5CB3C] active:scale-[0.99] text-zinc-950 text-xs font-mono font-bold uppercase rounded-lg transition-all cursor-pointer flex items-center gap-2"
                      >
                        {isProcessing ? (
                          <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
                        ) : (
                          <Check className="w-4 h-4 text-zinc-950" />
                        )}
                        <span>Aprovar Alterações</span>
                      </button>
                    </div>

                  </div>
                )}

              </div>
            )}
          </div>

        </div>

      </div>

      {/* ─── MODAL DE RECUSA COM MOTIVO OBRIGATÓRIO ─────────────────────────── */}
      {isRejectModalOpen && (
        <div className="fixed inset-0 z-60 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#16171B] border border-zinc-200 dark:border-zinc-800 rounded-lg max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
              Recusar Solicitação de Alteração
            </h3>
            <p className="text-xs text-zinc-500 font-mono">
              Informe obrigatoriamente o motivo da recusa para que o gestor possa corrigir os dados e solicitar novamente.
            </p>

            <div className="space-y-1">
              <label className="block text-xs font-mono uppercase text-zinc-500">
                Motivo da Recusa *
              </label>
              <textarea
                rows={3}
                required
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                placeholder="Ex: O CNPJ informado não confere com o comprovante da Receita Federal."
                className="w-full p-3 bg-transparent border border-zinc-300 dark:border-zinc-800 rounded text-sm text-zinc-900 dark:text-zinc-100 focus:border-red-500 focus:outline-none font-mono"
              />
              {!rejectNotes.trim() && (
                <p className="text-[11px] font-mono text-red-500">O motivo da recusa é obrigatório para rejeitar.</p>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsRejectModalOpen(false)
                  setRejectNotes('')
                }}
                className="px-3 py-2 text-xs font-mono text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={isProcessing || !rejectNotes.trim()}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:pointer-events-none text-white font-mono text-xs font-semibold rounded cursor-pointer flex items-center gap-1.5"
              >
                {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                <span>Confirmar Recusa</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL DE EDITAR E APROVAR ─────────────────────────────────────────── */}
      {isEditMode && editFormData && (
        <div className="fixed inset-0 z-60 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#16171B] border border-zinc-200 dark:border-zinc-800 rounded-lg max-w-2xl w-full p-6 space-y-4 shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <div>
                <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
                  Editar e Aprovar Alterações
                </h3>
                <p className="text-xs text-zinc-500 font-mono">
                  Ajuste os campos necessários antes de aplicar as mudanças no restaurante.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsEditMode(false)
                  setEditNotes('')
                }}
                className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-mono uppercase text-zinc-500">Nome da Loja</label>
                  <input
                    type="text"
                    value={editFormData.name || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    className="w-full px-3 py-1.5 bg-transparent border border-zinc-300 dark:border-zinc-800 rounded text-sm text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-mono uppercase text-zinc-500">Razão Social</label>
                  <input
                    type="text"
                    value={editFormData.legal_name || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, legal_name: e.target.value })}
                    className="w-full px-3 py-1.5 bg-transparent border border-zinc-300 dark:border-zinc-800 rounded text-sm text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-mono uppercase text-zinc-500">CNPJ / CPF</label>
                  <input
                    type="text"
                    value={editFormData.document || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, document: formatDocument(e.target.value) })}
                    className="w-full px-3 py-1.5 bg-transparent border border-zinc-300 dark:border-zinc-800 rounded text-sm font-mono text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-mono uppercase text-zinc-500">Subdomínio / Domínio</label>
                  <input
                    type="text"
                    value={editFormData.domain_type === 'subdomain' ? editFormData.slug : editFormData.custom_domain}
                    onChange={(e) => {
                      if (editFormData.domain_type === 'subdomain') {
                        setEditFormData({ ...editFormData, slug: formatSlug(e.target.value) })
                      } else {
                        setEditFormData({ ...editFormData, custom_domain: e.target.value })
                      }
                    }}
                    className="w-full px-3 py-1.5 bg-transparent border border-zinc-300 dark:border-zinc-800 rounded text-sm font-mono text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-mono uppercase text-zinc-500">Logradouro & Número</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editFormData.street || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, street: e.target.value })}
                      placeholder="Rua"
                      className="flex-1 px-3 py-1.5 bg-transparent border border-zinc-300 dark:border-zinc-800 rounded text-sm text-zinc-900 dark:text-zinc-100"
                    />
                    <input
                      type="text"
                      value={editFormData.number || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, number: e.target.value })}
                      placeholder="Nº"
                      className="w-20 px-3 py-1.5 bg-transparent border border-zinc-300 dark:border-zinc-800 rounded text-sm text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-mono uppercase text-zinc-500">Bairro, Cidade/UF</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editFormData.neighborhood || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, neighborhood: e.target.value })}
                      placeholder="Bairro"
                      className="flex-1 px-3 py-1.5 bg-transparent border border-zinc-300 dark:border-zinc-800 rounded text-sm text-zinc-900 dark:text-zinc-100"
                    />
                    <input
                      type="text"
                      value={editFormData.city || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, city: e.target.value })}
                      placeholder="Cidade"
                      className="w-28 px-3 py-1.5 bg-transparent border border-zinc-300 dark:border-zinc-800 rounded text-sm text-zinc-900 dark:text-zinc-100"
                    />
                    <input
                      type="text"
                      value={editFormData.state || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, state: e.target.value.toUpperCase() })}
                      placeholder="UF"
                      className="w-12 px-2 py-1.5 bg-transparent border border-zinc-300 dark:border-zinc-800 rounded text-sm text-zinc-900 dark:text-zinc-100 uppercase"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-mono uppercase text-zinc-500">
                  Notas da Administração / Justificativa dos Ajustes *
                </label>
                <textarea
                  rows={2}
                  required
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Ex: Ajustamos o subdomínio e corrigimos o número do estabelecimento."
                  className="w-full p-2.5 bg-transparent border border-zinc-300 dark:border-zinc-800 rounded text-xs font-mono text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none"
                />
                {!editNotes.trim() && (
                  <p className="text-[11px] font-mono text-red-500">A justificativa das alterações é obrigatória para aprovar com edição.</p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => {
                  setIsEditMode(false)
                  setEditNotes('')
                }}
                className="px-3 py-2 text-xs font-mono text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSubmitEditAndApprove}
                disabled={isProcessing || !editNotes.trim()}
                className="px-5 py-2.5 bg-[#F5DC55] hover:bg-[#E5CB3C] disabled:opacity-40 disabled:pointer-events-none text-zinc-950 font-mono text-xs font-bold uppercase rounded cursor-pointer flex items-center gap-1.5"
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin text-zinc-950" /> : <Check className="w-4 h-4 text-zinc-950" />}
                <span>Salvar e Aprovar</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
