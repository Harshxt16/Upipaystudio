import { ClientAccount } from '../types';

export function generateStandaloneHtmlCode(client: ClientAccount): string {
  const cfg = client.gatewayConfig;
  const entityName = client.entityName.replace(/"/g, '\\"');
  const payeeName = (cfg?.payeeName || client.entityName).replace(/"/g, '\\"');
  const upiId = (cfg?.upiId || 'yourname@fam').replace(/"/g, '\\"');
  const accentColor = cfg?.accentColor || '#0F766E';
  const redirectUrl = (cfg?.redirectUrl || '').replace(/"/g, '\\"');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${entityName} — Direct UPI Checkout</title>
  <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.4/build/qrcode.min.js"></script>
  <style>
    :root { --accent: ${accentColor}; }
    * { box-sizing: border-box; font-family: system-ui, -apple-system, sans-serif; }
    body { margin: 0; background: #f8fafc; color: #0f172a; display: flex; min-height: 100vh; align-items: center; justify-content: center; padding: 20px; }
    .card { width: 100%; max-width: 460px; background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; }
    .bar { height: 6px; background: var(--accent); }
    .body { padding: 28px; }
    h1 { margin: 0 0 4px; font-size: 20px; }
    .sub { margin: 0 0 20px; font-size: 13px; color: #64748b; }
    .qr-box { display: flex; flex-direction: column; align-items: center; padding: 18px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; margin-bottom: 18px; }
    label { display: block; font-size: 12px; font-weight: 600; color: #334155; margin: 12px 0 6px; }
    input { width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; }
    .btn { display: block; width: 100%; text-align: center; padding: 12px 16px; border-radius: 8px; border: none; font-size: 14px; font-weight: 600; color: #fff; background: var(--accent); text-decoration: none; cursor: pointer; margin-top: 14px; }
    .btn-outline { background: #fff; color: #0f172a; border: 1px solid #cbd5e1; }
    .status { margin-top: 14px; padding: 12px; border-radius: 8px; background: #ecfdf5; color: #065f46; font-size: 13px; display: none; }
  </style>
</head>
<body>
  <div class="card">
    <div class="bar"></div>
    <div class="body">
      <h1 id="merchant-title"></h1>
      <p class="sub" id="merchant-upi"></p>

      <div class="qr-box">
        <canvas id="upi-qr"></canvas>
        <a id="upi-app-link" href="#" class="btn">Pay via UPI App</a>
      </div>

      <label for="amount">Amount (INR)</label>
      <input id="amount" type="number" min="1" placeholder="Enter amount (e.g. 499)" />

      <label for="order-id">Order Reference</label>
      <input id="order-id" type="text" placeholder="ORD123" />

      <label for="utr">12-Digit UPI UTR / Reference Number</label>
      <input id="utr" type="text" maxlength="12" placeholder="412345678901" />

      <button type="button" id="submit-utr" class="btn btn-outline">Submit Payment UTR</button>
      <div id="status-box" class="status"></div>
    </div>
  </div>

  <script>
    // ==========================================
    // MERCHANT CONFIGURATION — EDIT FREELY
    // ==========================================
    const CONFIG = {
      entityName: "${entityName}",
      payeeName: "${payeeName}",
      upiId: "${upiId}",
      redirectUrl: "${redirectUrl}"
    };

    const params = new URLSearchParams(window.location.search);
    const amountEl = document.getElementById('amount');
    const orderEl = document.getElementById('order-id');
    const utrEl = document.getElementById('utr');
    const linkEl = document.getElementById('upi-app-link');
    const qrCanvas = document.getElementById('upi-qr');
    const statusBox = document.getElementById('status-box');

    document.getElementById('merchant-title').textContent = CONFIG.entityName;
    document.getElementById('merchant-upi').textContent = CONFIG.payeeName + ' · ' + CONFIG.upiId;

    amountEl.value = params.get('amount') || '499';
    orderEl.value = params.get('order_id') || 'ORD' + Math.floor(100000 + Math.random() * 900000);

    function updateUpi() {
      const am = parseFloat(amountEl.value);
      const q = new URLSearchParams({ pa: CONFIG.upiId, pn: CONFIG.payeeName, cu: 'INR', tn: orderEl.value || 'ORDER' });
      if (am > 0) q.set('am', am.toFixed(2));
      const uri = 'upi://pay?' + q.toString();
      linkEl.href = uri;
      linkEl.textContent = am > 0 ? 'Pay ₹' + am + ' via UPI App' : 'Pay via UPI App';
      if (window.QRCode) {
        window.QRCode.toCanvas(qrCanvas, uri, { width: 190, margin: 1 });
      }
    }

    amountEl.addEventListener('input', updateUpi);
    orderEl.addEventListener('input', updateUpi);
    updateUpi();

    document.getElementById('submit-utr').addEventListener('click', function () {
      const utr = utrEl.value.replace(/\\D/g, '');
      if (!/^\\d{12}$/.test(utr)) {
        alert('Please enter a valid 12-digit UTR number.');
        return;
      }
      statusBox.style.display = 'block';
      statusBox.textContent = 'UTR ' + utr + ' submitted for Order ' + orderEl.value + '.';
      if (CONFIG.redirectUrl) {
        setTimeout(() => { window.location.href = CONFIG.redirectUrl; }, 1500);
      }
    });
  </script>
</body>
</html>
`;
}

export function generateReactComponentCode(client: ClientAccount): string {
  const cfg = client.gatewayConfig;
  const entityName = client.entityName.replace(/'/g, "\\'");
  const payeeName = (cfg?.payeeName || client.entityName).replace(/'/g, "\\'");
  const upiId = (cfg?.upiId || 'yourname@fam').replace(/'/g, "\\'");
  const accentColor = cfg?.accentColor || '#0F766E';
  const redirectUrl = (cfg?.redirectUrl || '').replace(/'/g, "\\'");

  return `import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

// ==========================================
// MERCHANT CONFIGURATION — EDIT FREELY
// ==========================================
const GATEWAY_CONFIG = {
  entityName: '${entityName}',
  payeeName: '${payeeName}',
  upiId: '${upiId}',
  accentColor: '${accentColor}',
  redirectUrl: '${redirectUrl}',
};

export function UpiCheckout({
  defaultAmount = 499,
  orderId = 'ORD123',
  onUtrSubmitted,
}: {
  defaultAmount?: number;
  orderId?: string;
  onUtrSubmitted?: (payload: { orderId: string; amount: number; utr: string }) => void;
}) {
  const [amount, setAmount] = useState(String(defaultAmount));
  const [utr, setUtr] = useState('');
  const [qrUrl, setQrUrl] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const numericAmount = Number(amount);
  const params = new URLSearchParams({
    pa: GATEWAY_CONFIG.upiId,
    pn: GATEWAY_CONFIG.payeeName,
    cu: 'INR',
    tn: orderId,
  });
  if (numericAmount > 0) params.set('am', numericAmount.toFixed(2));
  const upiUri = \`upi://pay?\${params.toString()}\`;

  useEffect(() => {
    QRCode.toDataURL(upiUri, { width: 220, margin: 2 }).then(setQrUrl);
  }, [upiUri]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\\d{12}$/.test(utr)) return;
    onUtrSubmitted?.({ orderId, amount: numericAmount, utr });
    setSubmitted(true);
    if (GATEWAY_CONFIG.redirectUrl) {
      window.location.href = GATEWAY_CONFIG.redirectUrl;
    }
  };

  return (
    <div style={{ maxWidth: 420, margin: '0 auto', padding: 24, border: '1px solid #e2e8f0', borderRadius: 12 }}>
      <h2 style={{ margin: 0 }}>{GATEWAY_CONFIG.entityName}</h2>
      <p style={{ color: '#64748b', fontSize: 13 }}>{GATEWAY_CONFIG.upiId}</p>
      {qrUrl && <img src={qrUrl} alt="UPI QR" style={{ width: 200, height: 200, display: 'block', margin: '16px auto' }} />}
      <a
        href={upiUri}
        style={{ display: 'block', textAlign: 'center', padding: 12, borderRadius: 8, background: GATEWAY_CONFIG.accentColor, color: '#fff', fontWeight: 600, textDecoration: 'none' }}
      >
        Pay ₹{numericAmount > 0 ? numericAmount : ''} via UPI App
      </a>
      <form onSubmit={handleSubmit} style={{ marginTop: 16 }}>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount (INR)"
          style={{ width: '100%', padding: 10, marginBottom: 10, borderRadius: 8, border: '1px solid #cbd5e1' }}
        />
        <input
          type="text"
          maxLength={12}
          value={utr}
          onChange={(e) => setUtr(e.target.value.replace(/\\D/g, ''))}
          placeholder="12-Digit UTR Number"
          style={{ width: '100%', padding: 10, marginBottom: 10, borderRadius: 8, border: '1px solid #cbd5e1' }}
        />
        <button type="submit" style={{ width: '100%', padding: 10, borderRadius: 8, background: '#0f172a', color: '#fff', fontWeight: 600, border: 'none' }}>
          {submitted ? 'UTR Submitted' : 'Confirm Payment UTR'}
        </button>
      </form>
    </div>
  );
}
`;
}
