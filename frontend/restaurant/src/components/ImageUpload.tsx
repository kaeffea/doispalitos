import { useState, useRef, ChangeEvent, DragEvent } from 'react'
import api from '@/lib/api'
import { UploadCloud, Loader2, Trash2, Camera, AlertCircle, Check, X } from 'lucide-react'

export function resolveImageUrl(url?: string | null): string {
  if (!url) return ''
  if (url.startsWith('blob:') || url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://')) {
    return url
  }
  if (url.startsWith('/')) {
    return url
  }
  return `/${url}`
}

interface ImageUploadProps {
  value?: string | null
  onChange: (imageUrl: string) => void
  onRemove: () => void
  className?: string
}

export function ImageUpload({
  value,
  onChange,
  onRemove,
  className = '',
}: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [localPreview, setLocalPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    setErrorMessage(null)

    // Valida tipo de arquivo permitido
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/jpg']
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      setErrorMessage('Formato inválido. Selecione apenas imagens JPG, PNG ou WEBP.')
      return
    }

    // Valida tamanho máximo (5MB)
    const maxSizeBytes = 5 * 1024 * 1024
    if (file.size > maxSizeBytes) {
      setErrorMessage('Tamanho excedido. A foto deve ter no máximo 5MB.')
      return
    }

    // Preview instantâneo
    const previewUrl = URL.createObjectURL(file)
    setLocalPreview(previewUrl)

    const formData = new FormData()
    formData.append('image', file)

    setIsUploading(true)
    try {
      const res = await api.post('/restaurant/products/upload-image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      if (res.data.image_url) {
        onChange(res.data.image_url)
      }
    } catch (err: any) {
      console.error('Erro no upload da foto:', err)
      setErrorMessage(err.response?.data?.message || 'Falha ao enviar a foto do prato. Tente novamente.')
      setLocalPreview(null)
    } finally {
      setIsUploading(false)
    }
  }

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFile(files[0])
    }
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      handleFile(files[0])
    }
  }

  const currentImage = localPreview || value

  return (
    <div className={`space-y-2 ${className}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="hidden"
        onChange={onInputChange}
      />

      {currentImage ? (
        <div className="relative rounded-xl overflow-hidden border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-900 group">
          <div className="h-48 w-full relative">
            <img
              src={resolveImageUrl(currentImage)}
              alt="Foto do Prato"
              className="w-full h-full object-cover"
            />
            {isUploading && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center gap-2 text-white text-xs font-mono">
                <Loader2 className="w-5 h-5 animate-spin text-[#F5DC55]" />
                <span>Enviando foto com segurança...</span>
              </div>
            )}
          </div>

          <div className="p-3 bg-white/95 dark:bg-[#121316]/95 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-mono text-emerald-700 dark:text-emerald-400">
              <Check className="w-3.5 h-3.5" />
              <span>Foto anexada com sucesso</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded text-xs font-mono transition-colors cursor-pointer flex items-center gap-1.5 border border-zinc-200 dark:border-zinc-700"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Trocar Foto</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setLocalPreview(null)
                  onRemove()
                }}
                disabled={isUploading}
                className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 rounded text-xs font-mono transition-colors cursor-pointer flex items-center gap-1.5"
                title="Remover Foto"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remover</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-[#F5DC55] bg-[#F5DC55]/5'
              : 'border-zinc-300 dark:border-zinc-700 hover:border-[#F5DC55] bg-zinc-50/50 dark:bg-zinc-900/30'
          }`}
        >
          {isUploading ? (
            <div className="py-4 flex flex-col items-center justify-center gap-2 text-xs font-mono text-zinc-600 dark:text-zinc-300">
              <Loader2 className="w-6 h-6 animate-spin text-[#D4B316] dark:text-[#F5DC55]" />
              <span>Enviando foto com segurança...</span>
            </div>
          ) : (
            <div className="space-y-2 py-2">
              <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center mx-auto text-zinc-600 dark:text-zinc-300">
                <UploadCloud className="w-5 h-5 text-[#D4B316] dark:text-[#F5DC55]" />
              </div>
              <div>
                <p className="text-xs font-medium text-zinc-950 dark:text-zinc-50">
                  Clique ou arraste a foto do prato aqui
                </p>
                <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 mt-0.5">
                  JPG, PNG ou WEBP (máx. 5MB)
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {errorMessage && (
        <div className="p-2.5 bg-red-500/10 border-l-2 border-red-500 rounded-r text-xs font-mono text-red-600 dark:text-red-400 flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  )
}

interface MiniImageUploadProps {
  value?: string | null
  onChange: (imageUrl: string) => void
  onRemove: () => void
}

export function MiniImageUpload({
  value,
  onChange,
  onRemove,
}: MiniImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [localPreview, setLocalPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/jpg']
    if (!allowedTypes.includes(file.type.toLowerCase())) return
    if (file.size > 5 * 1024 * 1024) return

    const previewUrl = URL.createObjectURL(file)
    setLocalPreview(previewUrl)

    const formData = new FormData()
    formData.append('image', file)

    setIsUploading(true)
    try {
      const res = await api.post('/restaurant/products/upload-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      if (res.data.image_url) {
        onChange(res.data.image_url)
      }
    } catch (err) {
      console.error(err)
      setLocalPreview(null)
    } finally {
      setIsUploading(false)
    }
  }

  const currentImage = localPreview || value

  return (
    <div className="relative shrink-0">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0])
          }
        }}
      />
      {currentImage ? (
        <div className="relative group w-8 h-8 rounded-lg overflow-hidden border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800">
          <img src={resolveImageUrl(currentImage)} alt="Opção" className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={() => {
              setLocalPreview(null)
              onRemove()
            }}
            className="absolute inset-0 bg-black/75 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
            title="Remover foto da opção"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="w-8 h-8 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 hover:border-[#F5DC55] text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 flex items-center justify-center transition-colors cursor-pointer"
          title="Adicionar foto a esta opção"
        >
          {isUploading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#D4B316] dark:text-[#F5DC55]" />
          ) : (
            <Camera className="w-3.5 h-3.5" />
          )}
        </button>
      )}
    </div>
  )
}
