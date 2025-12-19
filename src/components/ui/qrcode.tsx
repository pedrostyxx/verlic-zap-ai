'use client'

import { useEffect, useRef } from 'react'
import QRCodeLib from 'qrcode'

interface QRCodeDisplayProps {
  code?: string | null
  base64?: string | null
  size?: number
  className?: string
}

export function QRCodeDisplay({ code, base64, size = 256, className }: QRCodeDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (code && canvasRef.current) {
      QRCodeLib.toCanvas(canvasRef.current, code, {
        width: size,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'M',
      })
    }
  }, [code, size])

  // Se temos o código puro, gerar QR bonito
  if (code) {
    return (
      <div className={className}>
        <div className="bg-white p-4 rounded-xl shadow-lg inline-block">
          <canvas ref={canvasRef} />
        </div>
      </div>
    )
  }

  // Fallback para base64 da Evolution
  if (base64) {
    const imageSrc = base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`
    return (
      <div className={className}>
        <div className="bg-white p-4 rounded-xl shadow-lg inline-block">
          <img 
            src={imageSrc} 
            alt="QR Code" 
            width={size} 
            height={size}
            className="block"
          />
        </div>
      </div>
    )
  }

  return null
}
