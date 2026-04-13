import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

interface QrCodeModalProps {
  title: string
  value: string
  isOpen: boolean
  onClose: () => void
}

export function QrCodeModal({
  title,
  value,
  isOpen,
  onClose,
}: QrCodeModalProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    let active = true

    void QRCode.toDataURL(value, {
      width: 320,
      margin: 2,
      color: {
        dark: '#2f241d',
        light: '#fffaf6',
      },
    })
      .then((nextDataUrl: string) => {
        if (!active) {
          return
        }
        setError(null)
        setDataUrl(nextDataUrl)
      })
      .catch(() => {
        if (!active) {
          return
        }
        setError('QRコードの生成に失敗しました。')
      })

    return () => {
      active = false
    }
  }, [isOpen, value])

  if (!isOpen) {
    return null
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="modal-card stack"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="page-heading">
          <div>
            <div className="section-title">{title}</div>
            <p className="muted">参加者はこの QR コードから参加ページを開けます。</p>
          </div>
          <button className="button-secondary" type="button" onClick={onClose}>
            閉じる
          </button>
        </div>

        {error ? (
          <div className="notice">{error}</div>
        ) : dataUrl ? (
          <div className="qr-panel">
            <img className="qr-image" src={dataUrl} alt={title} />
            <div className="notice">
              <span className="mono">{value}</span>
            </div>
          </div>
        ) : (
          <div className="notice">QRコードを生成しています。</div>
        )}
      </section>
    </div>
  )
}
