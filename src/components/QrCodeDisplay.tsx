import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Download } from 'lucide-react';

interface QrCodeDisplayProps {
  value: string;
  staticImageUrl?: string;
  size?: number;
  accentColor?: string;
  label?: string;
  allowDownload?: boolean;
  downloadFileName?: string;
}

export function QrCodeDisplay({
  value,
  staticImageUrl,
  size = 220,
  accentColor = '#0F172A',
  label,
  allowDownload = false,
  downloadFileName = 'upi-payment-qr.png',
}: QrCodeDisplayProps) {
  const [dataUrl, setDataUrl] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (staticImageUrl) {
      setDataUrl(staticImageUrl);
      setError('');
      return;
    }

    let cancelled = false;
    const qrModule = QRCode as unknown as {
      toDataURL?: typeof QRCode.toDataURL;
      default?: { toDataURL?: typeof QRCode.toDataURL };
    };
    const toDataUrlFn = qrModule.toDataURL ?? qrModule.default?.toDataURL;

    if (!toDataUrlFn) {
      setError('QR generator unavailable.');
      return;
    }

    toDataUrlFn(value, {
      width: size * 2,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#0F172A',
        light: '#FFFFFF',
      },
    })
      .then((url) => {
        if (!cancelled) {
          setDataUrl(url);
          setError('');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('Unable to render QR code for this URI.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [value, staticImageUrl, size]);

  const handleDownload = () => {
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = downloadFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col items-center">
      <div
        className="relative bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-center"
        style={{
          width: size + 28,
          height: size + 28,
        }}
      >
        <div
          className="absolute inset-x-0 top-0 h-1 rounded-t-xl"
          style={{ backgroundColor: accentColor }}
        />
        {error ? (
          <p className="text-xs text-red-600 text-center px-3">{error}</p>
        ) : dataUrl ? (
          <img
            src={dataUrl}
            alt={label || 'UPI Payment QR Code'}
            referrerPolicy="no-referrer"
            style={{ width: size, height: size }}
            className="object-contain rounded-md select-none"
          />
        ) : (
          <div
            style={{ width: size, height: size }}
            className="bg-slate-100 animate-pulse rounded-md"
          />
        )}
      </div>

      {label && (
        <p className="mt-2.5 text-xs text-slate-500 text-center font-medium">
          {label}
        </p>
      )}

      {allowDownload && dataUrl && (
        <button
          type="button"
          onClick={handleDownload}
          className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 underline underline-offset-4 cursor-pointer whitespace-nowrap shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          Download QR PNG
        </button>
      )}
    </div>
  );
}
