'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Smartphone, RefreshCw, Wifi, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { QRCodeDisplay } from '@/components/ui/qrcode'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'

interface ConnectionModalProps {
  instanceId: string
  instanceName: string
  isOpen?: boolean
  onClose: () => void
  onConnected?: () => void
}

interface ConnectionState {
  status: 'loading' | 'qrcode' | 'connected' | 'error'
  qrCode?: string | null
  qrCodeRaw?: string | null
  pairingCode?: string | null
  deviceInfo?: {
    profileName?: string
    profilePictureUrl?: string
    phoneNumber?: string
  }
  error?: string
  countdown?: number
}

const QR_REFRESH_INTERVAL = 40000 // 40 segundos (Evolution atualiza a cada 45s)
const STATUS_CHECK_INTERVAL = 3000 // 3 segundos

export function ConnectionModal({ instanceId, instanceName, isOpen = true, onClose, onConnected }: ConnectionModalProps) {
  const { addToast } = useToast()
  const [state, setState] = useState<ConnectionState>({ status: 'loading' })
  const [countdown, setCountdown] = useState(40)

  const fetchQRCode = useCallback(async () => {
    try {
      const res = await fetch(`/api/instances/${instanceId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'connect' }),
      })
      
      const data = await res.json()
      
      if (data.qrCode || data.qrCodeRaw) {
        setState({
          status: 'qrcode',
          qrCode: data.qrCode,
          qrCodeRaw: data.qrCodeRaw,
          pairingCode: data.pairingCode,
        })
        setCountdown(40)
      }
    } catch (error) {
      console.error('Erro ao obter QR:', error)
      setState({ status: 'error', error: 'Erro ao obter QR Code' })
    }
  }, [instanceId])

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/instances/${instanceId}/status`)
      const data = await res.json()
      
      if (data.status === 'connected' || data.status === 'open') {
        setState({
          status: 'connected',
          deviceInfo: data.deviceInfo,
        })
        
        addToast({
          type: 'success',
          title: 'WhatsApp Conectado!',
          message: data.deviceInfo?.profileName 
            ? `Conectado como ${data.deviceInfo.profileName}`
            : 'Dispositivo conectado com sucesso',
        })
        
        onConnected?.()
        
        // Fechar modal após 2 segundos
        setTimeout(() => {
          onClose()
        }, 2000)
      }
    } catch (error) {
      console.error('Erro ao verificar status:', error)
    }
  }, [instanceId, addToast, onConnected, onClose])

  // Inicializar
  useEffect(() => {
    if (isOpen) {
      fetchQRCode()
    }
  }, [isOpen, fetchQRCode])

  // Atualizar QR Code periodicamente
  useEffect(() => {
    if (!isOpen || state.status !== 'qrcode') return

    const qrInterval = setInterval(() => {
      fetchQRCode()
    }, QR_REFRESH_INTERVAL)

    return () => clearInterval(qrInterval)
  }, [isOpen, state.status, fetchQRCode])

  // Verificar status periodicamente
  useEffect(() => {
    if (!isOpen || state.status === 'connected') return

    const statusInterval = setInterval(() => {
      checkStatus()
    }, STATUS_CHECK_INTERVAL)

    return () => clearInterval(statusInterval)
  }, [isOpen, state.status, checkStatus])

  // Countdown do QR Code
  useEffect(() => {
    if (!isOpen || state.status !== 'qrcode') return

    const countdownInterval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          return 40
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(countdownInterval)
  }, [isOpen, state.status])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div 
        className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <Smartphone className="w-5 h-5 text-zinc-400" />
            <div>
              <h3 className="font-semibold text-zinc-100">Conectar WhatsApp</h3>
              <p className="text-xs text-zinc-500">{instanceName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {state.status === 'loading' && (
            <div className="flex flex-col items-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mb-4"></div>
              <p className="text-zinc-400">Gerando QR Code...</p>
            </div>
          )}

          {state.status === 'qrcode' && (
            <div className="flex flex-col items-center">
              <QRCodeDisplay 
                code={state.qrCodeRaw} 
                base64={state.qrCode}
                size={240}
              />
              
              {/* Pairing Code */}
              {state.pairingCode && (
                <div className="mt-4 text-center">
                  <p className="text-xs text-zinc-500 mb-1">Código de pareamento</p>
                  <p className="font-mono text-lg font-bold text-emerald-400 tracking-widest">
                    {state.pairingCode}
                  </p>
                </div>
              )}

              {/* Countdown */}
              <div className="flex items-center gap-2 mt-4 text-zinc-500">
                <RefreshCw className={cn('w-4 h-4', countdown <= 5 && 'animate-spin text-yellow-500')} />
                <span className="text-sm">
                  Atualiza em {countdown}s
                </span>
              </div>

              {/* Instruções */}
              <div className="mt-6 space-y-2 text-sm text-zinc-400">
                <p className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center text-xs">1</span>
                  Abra o WhatsApp no celular
                </p>
                <p className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center text-xs">2</span>
                  Vá em Configurações → Aparelhos conectados
                </p>
                <p className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center text-xs">3</span>
                  Toque em Conectar e escaneie o código
                </p>
              </div>
            </div>
          )}

          {state.status === 'connected' && (
            <div className="flex flex-col items-center py-8">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4">
                <Wifi className="w-8 h-8 text-emerald-500" />
              </div>
              <h4 className="text-lg font-semibold text-zinc-100 mb-2">Conectado!</h4>
              
              {state.deviceInfo && (
                <div className="flex items-center gap-3 mt-4 p-4 bg-zinc-800 rounded-lg">
                  {state.deviceInfo.profilePictureUrl ? (
                    <img 
                      src={state.deviceInfo.profilePictureUrl} 
                      alt="Profile"
                      className="w-12 h-12 rounded-full"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-zinc-700 flex items-center justify-center">
                      <Smartphone className="w-6 h-6 text-zinc-400" />
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-zinc-100">
                      {state.deviceInfo.profileName || 'Dispositivo'}
                    </p>
                    {state.deviceInfo.phoneNumber && (
                      <p className="text-sm text-zinc-400">{state.deviceInfo.phoneNumber}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {state.status === 'error' && (
            <div className="flex flex-col items-center py-8">
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
                <WifiOff className="w-8 h-8 text-red-500" />
              </div>
              <h4 className="text-lg font-semibold text-zinc-100 mb-2">Erro na conexão</h4>
              <p className="text-sm text-zinc-400 mb-4">{state.error}</p>
              <Button onClick={fetchQRCode}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Tentar novamente
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
