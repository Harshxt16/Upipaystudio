export interface CheckoutScriptParams {
  slug: string;
  upiId: string;
  entityName: string;
  brandColor: string;
  adminPin: string;
  redirectUrl?: string;
  staticQrDataUrl?: string;
}

function safeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
}

export function generateWebsiteCheckoutScript(params: CheckoutScriptParams): string {
  const config = {
    slug: params.slug,
    upiId: params.upiId,
    entityName: params.entityName,
    brandColor: params.brandColor || '#0F766E',
    adminPin: params.adminPin,
    redirectUrl: params.redirectUrl || '',
    staticQrDataUrl: params.staticQrDataUrl || '',
  };

  return `<!-- UPIPay Studio Direct Checkout & Hidden Order Verification Script -->
<script>
(function () {
  if (window.__UPIPAY_STUDIO_LOADED__) return;
  window.__UPIPAY_STUDIO_LOADED__ = true;

  var CONFIG = ${safeJson(config)};
  var STORAGE_KEY = 'upipay_orders_' + CONFIG.slug;
  var activeReturnCleanup = null;

  function loadOrders() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveOrders(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (e) {}
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function buildUpiUri(amount, orderId) {
    var q = [
      'pa=' + encodeURIComponent(CONFIG.upiId),
      'pn=' + encodeURIComponent(CONFIG.entityName),
      'am=' + encodeURIComponent(Number(amount.toFixed(2)).toString()),
      'cu=INR',
      'tn=' + encodeURIComponent(orderId)
    ];
    return 'upi://pay?' + q.join('&');
  }

  function generateOrderId() {
    return 'ORD-' + Date.now().toString(36).toUpperCase().slice(-4) + Math.floor(100 + Math.random() * 900);
  }

  function readCheckoutAmount(triggerEl) {
    var attrVal = triggerEl && triggerEl.getAttribute('data-upipay-amount');
    var priceEl = document.querySelector('#checkout-total, [data-cart-total]');
    var raw = attrVal || (priceEl ? (priceEl.value !== undefined && priceEl.value !== '' ? priceEl.value : priceEl.textContent) : '');
    var cleaned = String(raw || '').replace(/[^0-9.]/g, '');
    var num = parseFloat(cleaned);
    return !isNaN(num) && num > 0 ? num : 0;
  }

  function ensureStyles() {
    if (document.getElementById('upipay-studio-styles')) return;
    var style = document.createElement('style');
    style.id = 'upipay-studio-styles';
    style.textContent = [
      '.upipay-backdrop{position:fixed;inset:0;z-index:999999;background:rgba(15,23,42,0.62);display:flex;align-items:center;justify-content:center;padding:16px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;}',
      '.upipay-modal{background:#fff;color:#0f172a;width:100%;max-width:440px;border-radius:14px;border:1px solid #e2e8f0;box-shadow:0 20px 40px rgba(15,23,42,0.2);overflow:hidden;max-height:92vh;overflow-y:auto;}',
      '.upipay-modal-wide{max-width:720px;}',
      '.upipay-bar{height:5px;width:100%;background:' + CONFIG.brandColor + ';}',
      '.upipay-body{padding:24px;}',
      '.upipay-header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:16px;}',
      '.upipay-title{margin:0;font-size:18px;font-weight:700;color:#0f172a;}',
      '.upipay-sub{margin:4px 0 0;font-size:12px;color:#64748b;}',
      '.upipay-close{background:#f1f5f9;border:none;color:#334155;width:30px;height:30px;border-radius:8px;cursor:pointer;font-size:16px;font-weight:600;}',
      '.upipay-amount-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;}',
      '.upipay-choice{display:flex;flex-direction:column;gap:10px;}',
      '.upipay-choice-btn{width:100%;text-align:left;padding:14px 16px;background:#fff;border:1px solid #cbd5e1;border-radius:10px;cursor:pointer;transition:border-color .15s,background .15s;}',
      '.upipay-choice-btn:hover{border-color:' + CONFIG.brandColor + ';background:#f8fafc;}',
      '.upipay-choice-title{display:block;font-size:14px;font-weight:700;color:#0f172a;}',
      '.upipay-choice-desc{display:block;font-size:12px;color:#64748b;margin-top:3px;}',
      '.upipay-qr-wrap{display:flex;flex-direction:column;align-items:center;margin:12px 0 16px;}',
      '.upipay-qr-box{padding:12px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;}',
      '.upipay-btn{display:inline-flex;align-items:center;justify-content:center;width:100%;box-sizing:border-box;padding:11px 16px;border-radius:8px;font-size:14px;font-weight:600;border:none;cursor:pointer;text-decoration:none;background:' + CONFIG.brandColor + ';color:#fff;}',
      '.upipay-btn-secondary{background:#0f172a;color:#fff;margin-top:8px;}',
      '.upipay-btn-outline{background:#fff;color:#334155;border:1px solid #cbd5e1;margin-top:8px;}',
      '.upipay-btn-danger{background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;margin-top:8px;}',
      '.upipay-input{width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;margin-top:6px;margin-bottom:10px;}',
      '.upipay-note{background:#fffbeb;border:1px solid #fde68a;color:#92400e;font-size:12px;padding:10px 12px;border-radius:8px;margin-bottom:12px;line-height:1.45;}',
      '.upipay-err{background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;font-size:12px;padding:10px 12px;border-radius:8px;margin-bottom:10px;line-height:1.45;}',
      '.upipay-ok{background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46;font-size:13px;padding:12px;border-radius:8px;line-height:1.45;}',
      '.upipay-back-link{background:none;border:none;padding:0;color:#475569;font-size:12px;font-weight:600;cursor:pointer;margin-bottom:12px;text-decoration:underline;}',
      '.upipay-table{width:100%;border-collapse:collapse;font-size:12px;margin-top:12px;}',
      '.upipay-table th,.upipay-table td{text-align:left;padding:8px 10px;border-bottom:1px solid #e2e8f0;}',
      '.upipay-approve-btn{background:#15803d;color:#fff;border:none;padding:6px 10px;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;}'
    ].join('');
    document.head.appendChild(style);
  }

  function renderQrInto(imgEl, upiUri) {
    if (CONFIG.staticQrDataUrl) {
      imgEl.src = CONFIG.staticQrDataUrl;
      return;
    }
    var fallbackUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(upiUri);
    function drawWithLib() {
      if (window.QRCode && window.QRCode.toDataURL) {
        window.QRCode.toDataURL(upiUri, { width: 360, margin: 2 }, function (err, url) {
          imgEl.src = (!err && url) ? url : fallbackUrl;
        });
      } else {
        imgEl.src = fallbackUrl;
      }
    }
    if (window.QRCode) {
      drawWithLib();
      return;
    }
    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/qrcode@1.5.4/build/qrcode.min.js';
    s.onload = drawWithLib;
    s.onerror = function () { imgEl.src = fallbackUrl; };
    document.head.appendChild(s);
  }

  function closeExistingModal() {
    if (activeReturnCleanup) {
      activeReturnCleanup();
      activeReturnCleanup = null;
    }
    var existing = document.getElementById('upipay-studio-backdrop');
    if (existing) existing.remove();
  }

  function openCheckoutModal(amount, orderId) {
    ensureStyles();
    closeExistingModal();

    var backdrop = document.createElement('div');
    backdrop.id = 'upipay-studio-backdrop';
    backdrop.className = 'upipay-backdrop';

    var upiUri = buildUpiUri(amount, orderId);
    var formattedAmt = '&#8377;' + Number(amount.toFixed(2));

    function renderMethodChoice() {
      if (activeReturnCleanup) {
        activeReturnCleanup();
        activeReturnCleanup = null;
      }
      backdrop.innerHTML =
        '<div class="upipay-modal" role="dialog" aria-modal="true">' +
          '<div class="upipay-bar"></div>' +
          '<div class="upipay-body">' +
            '<div class="upipay-header">' +
              '<div>' +
                '<h2 class="upipay-title">' + escapeHtml(CONFIG.entityName) + '</h2>' +
                '<p class="upipay-sub">Direct UPI Checkout · Order ' + escapeHtml(orderId) + '</p>' +
              '</div>' +
              '<button type="button" class="upipay-close" aria-label="Close">&times;</button>' +
            '</div>' +
            '<div class="upipay-amount-box">' +
              '<span style="font-size:12px;color:#64748b;font-weight:600;">Payable Amount</span>' +
              '<span style="font-size:20px;font-weight:700;font-family:monospace;">' + formattedAmt + '</span>' +
            '</div>' +
            '<p style="font-size:13px;font-weight:600;color:#334155;margin:0 0 10px;">Choose how you would like to pay:</p>' +
            '<div class="upipay-choice">' +
              '<button type="button" class="upipay-choice-btn" id="upipay-choose-qr">' +
                '<span class="upipay-choice-title">Pay through QR Code</span>' +
                '<span class="upipay-choice-desc">Scan QR from any device &amp; submit UPI UTR / Ref ID (verification up to 24 hrs)</span>' +
              '</button>' +
              '<button type="button" class="upipay-choice-btn" id="upipay-choose-upi">' +
                '<span class="upipay-choice-title">Pay through UPI App</span>' +
                '<span class="upipay-choice-desc">Open GPay, PhonePe, Paytm, or FamPay directly on your phone</span>' +
              '</button>' +
            '</div>' +
          '</div>' +
        '</div>';

      backdrop.querySelector('.upipay-close').addEventListener('click', closeExistingModal);
      backdrop.querySelector('#upipay-choose-qr').addEventListener('click', renderQrView);
      backdrop.querySelector('#upipay-choose-upi').addEventListener('click', launchUpiAppFlow);
    }

    function renderQrView() {
      backdrop.innerHTML =
        '<div class="upipay-modal" role="dialog" aria-modal="true">' +
          '<div class="upipay-bar"></div>' +
          '<div class="upipay-body">' +
            '<div class="upipay-header">' +
              '<div>' +
                '<h2 class="upipay-title">' + escapeHtml(CONFIG.entityName) + '</h2>' +
                '<p class="upipay-sub">Pay via QR · Order ' + escapeHtml(orderId) + '</p>' +
              '</div>' +
              '<button type="button" class="upipay-close" aria-label="Close">&times;</button>' +
            '</div>' +
            '<button type="button" class="upipay-back-link" id="upipay-back-choice">&larr; Change Payment Method</button>' +
            '<div class="upipay-amount-box">' +
              '<span style="font-size:12px;color:#64748b;font-weight:600;">Payable Amount</span>' +
              '<span style="font-size:20px;font-weight:700;font-family:monospace;">' + formattedAmt + '</span>' +
            '</div>' +
            '<div class="upipay-qr-wrap">' +
              '<div class="upipay-qr-box"><img id="upipay-qr-img" alt="UPI QR" style="width:190px;height:190px;display:block;object-fit:contain;" /></div>' +
              '<p style="font-size:11px;color:#64748b;margin:8px 0 0;">UPI ID: <strong style="color:#0f172a;font-family:monospace;">' + escapeHtml(CONFIG.upiId) + '</strong></p>' +
            '</div>' +
            '<div class="upipay-note"><strong>Note:</strong> After paying via QR, enter your UPI UTR / Reference Number below. Verification may take up to <strong>24 hours</strong>.</div>' +
            '<form id="upipay-utr-form">' +
              '<label style="font-size:12px;font-weight:600;color:#334155;">UPI UTR / Reference Number (Varchar)</label>' +
              '<input id="upipay-utr-input" class="upipay-input" type="text" maxlength="32" placeholder="e.g. 412345678901 or FP2611268901" style="text-transform:uppercase;" required />' +
              '<div id="upipay-utr-msg"></div>' +
              '<button type="submit" class="upipay-btn">Submit UTR &amp; Place Order</button>' +
            '</form>' +
          '</div>' +
        '</div>';

      renderQrInto(backdrop.querySelector('#upipay-qr-img'), upiUri);
      backdrop.querySelector('.upipay-close').addEventListener('click', closeExistingModal);
      backdrop.querySelector('#upipay-back-choice').addEventListener('click', renderMethodChoice);

      var utrInput = backdrop.querySelector('#upipay-utr-input');
      utrInput.addEventListener('input', function () {
        utrInput.value = utrInput.value.replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase().slice(0, 32);
      });

      backdrop.querySelector('#upipay-utr-form').addEventListener('submit', function (ev) {
        ev.preventDefault();
        var utr = utrInput.value.trim().toUpperCase();
        var msgBox = backdrop.querySelector('#upipay-utr-msg');
        if (!/^[A-Z0-9_-]{8,32}$/.test(utr) || !/\\d/.test(utr)) {
          msgBox.innerHTML = '<div class="upipay-err">Please enter a valid UPI UTR / Reference ID (8–32 alphanumeric characters).</div>';
          return;
        }
        var orders = loadOrders();
        orders.unshift({
          orderId: orderId,
          amount: amount,
          utr: utr,
          method: 'QR',
          status: 'PENDING_VERIFICATION',
          createdAt: new Date().toISOString()
        });
        saveOrders(orders);
        renderConfirmedView(utr, 'Your UTR reference has been recorded. Verification may take up to 24 hours.');
      });
    }

    function launchUpiAppFlow() {
      var returnedFromApp = false;

      function renderUpiReturnView(hasReturned) {
        backdrop.innerHTML =
          '<div class="upipay-modal" role="dialog" aria-modal="true">' +
            '<div class="upipay-bar"></div>' +
            '<div class="upipay-body">' +
              '<div class="upipay-header">' +
                '<div>' +
                  '<h2 class="upipay-title">' + escapeHtml(CONFIG.entityName) + '</h2>' +
                  '<p class="upipay-sub">Pay via UPI App · Order ' + escapeHtml(orderId) + '</p>' +
                '</div>' +
                '<button type="button" class="upipay-close" aria-label="Close">&times;</button>' +
              '</div>' +
              '<div class="upipay-amount-box">' +
                '<span style="font-size:12px;color:#64748b;font-weight:600;">Payable Amount</span>' +
                '<span style="font-size:20px;font-weight:700;font-family:monospace;">' + formattedAmt + '</span>' +
              '</div>' +
              (hasReturned
                ? '<p style="font-size:14px;font-weight:700;color:#0f172a;margin:0 0 6px;">Did you complete the payment in your UPI app?</p>' +
                  '<p style="font-size:12px;color:#64748b;margin:0 0 14px;">Confirm your payment status to return to the page.</p>' +
                  '<form id="upipay-app-confirm-form">' +
                    '<label style="font-size:12px;font-weight:600;color:#334155;">UPI UTR / Ref ID (Optional if paid via UPI app)</label>' +
                    '<input id="upipay-app-utr" class="upipay-input" type="text" maxlength="32" placeholder="Optional UTR / Ref ID" style="text-transform:uppercase;" />' +
                    '<button type="submit" class="upipay-btn">Yes, Payment Completed</button>' +
                  '</form>' +
                  '<button type="button" id="upipay-not-paid-btn" class="upipay-btn upipay-btn-danger">No, Payment Not Done</button>'
                : '<div style="padding:14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:14px;">' +
                    '<p style="font-size:13px;font-weight:700;color:#0f172a;margin:0;">Opening your UPI app...</p>' +
                    '<p style="font-size:12px;color:#64748b;margin:6px 0 0;line-height:1.45;">Complete the ' + formattedAmt + ' payment in your UPI app and return to this browser tab. If your app did not open, tap below.</p>' +
                  '</div>' +
                  '<a href="' + escapeHtml(upiUri) + '" class="upipay-btn" id="upipay-reopen-link">Open UPI App Again</a>' +
                  '<button type="button" id="upipay-manual-return-btn" class="upipay-btn upipay-btn-outline">I Returned From UPI App</button>' +
                  '<button type="button" id="upipay-not-paid-btn" class="upipay-btn upipay-btn-danger">Cancel / Payment Not Done</button>'
              ) +
            '</div>' +
          '</div>';

        backdrop.querySelector('.upipay-close').addEventListener('click', closeExistingModal);

        var confirmForm = backdrop.querySelector('#upipay-app-confirm-form');
        if (confirmForm) {
          var appUtrInput = backdrop.querySelector('#upipay-app-utr');
          appUtrInput.addEventListener('input', function () {
            appUtrInput.value = appUtrInput.value.replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase().slice(0, 32);
          });
          confirmForm.addEventListener('submit', function (ev) {
            ev.preventDefault();
            var utr = appUtrInput.value.trim().toUpperCase();
            var validAppUtr = /^[A-Z0-9_-]{8,32}$/.test(utr) && /\\d/.test(utr);
            var orders = loadOrders();
            orders.unshift({
              orderId: orderId,
              amount: amount,
              utr: validAppUtr ? utr : 'UPI-APP-PAID',
              method: 'UPI_APP',
              status: 'PENDING_VERIFICATION',
              createdAt: new Date().toISOString()
            });
            saveOrders(orders);
            renderConfirmedView(
              validAppUtr ? utr : 'Confirmed via UPI App',
              'Payment confirmed. Returning you to the merchant page.'
            );
          });
        }

        var manualReturnBtn = backdrop.querySelector('#upipay-manual-return-btn');
        if (manualReturnBtn) {
          manualReturnBtn.addEventListener('click', function () {
            returnedFromApp = true;
            renderUpiReturnView(true);
          });
        }

        var notPaidBtn = backdrop.querySelector('#upipay-not-paid-btn');
        if (notPaidBtn) {
          notPaidBtn.addEventListener('click', renderNotConfirmedView);
        }
      }

      function onReturnToPage() {
        if (document.visibilityState === 'hidden') return;
        if (!returnedFromApp) {
          returnedFromApp = true;
          renderUpiReturnView(true);
        }
      }

      if (activeReturnCleanup) activeReturnCleanup();
      document.addEventListener('visibilitychange', onReturnToPage);
      window.addEventListener('focus', onReturnToPage);
      activeReturnCleanup = function () {
        document.removeEventListener('visibilitychange', onReturnToPage);
        window.removeEventListener('focus', onReturnToPage);
      };

      renderUpiReturnView(false);

      try {
        window.location.href = upiUri;
      } catch (e) {}
    }

    function renderNotConfirmedView() {
      if (activeReturnCleanup) {
        activeReturnCleanup();
        activeReturnCleanup = null;
      }
      backdrop.innerHTML =
        '<div class="upipay-modal" role="dialog" aria-modal="true">' +
          '<div class="upipay-bar" style="background:#dc2626;"></div>' +
          '<div class="upipay-body">' +
            '<div class="upipay-header">' +
              '<div>' +
                '<h2 class="upipay-title" style="color:#b91c1c;">Order Not Confirmed</h2>' +
                '<p class="upipay-sub">Order ' + escapeHtml(orderId) + ' · ' + formattedAmt + '</p>' +
              '</div>' +
              '<button type="button" class="upipay-close" aria-label="Close">&times;</button>' +
            '</div>' +
            '<div class="upipay-err">Payment was not completed in your UPI app, so this order has <strong>not been confirmed</strong>. No order was placed.</div>' +
            '<button type="button" id="upipay-retry-upi" class="upipay-btn">Retry via UPI App</button>' +
            '<button type="button" id="upipay-switch-qr" class="upipay-btn upipay-btn-outline">Pay through QR Code Instead</button>' +
          '</div>' +
        '</div>';

      backdrop.querySelector('.upipay-close').addEventListener('click', closeExistingModal);
      backdrop.querySelector('#upipay-retry-upi').addEventListener('click', launchUpiAppFlow);
      backdrop.querySelector('#upipay-switch-qr').addEventListener('click', renderQrView);
    }

    function renderConfirmedView(utrText, message) {
      if (activeReturnCleanup) {
        activeReturnCleanup();
        activeReturnCleanup = null;
      }
      var redirectBtn = CONFIG.redirectUrl
        ? '<a href="' + escapeHtml(CONFIG.redirectUrl) + '" class="upipay-btn" style="margin-top:12px;">Continue to Store</a>'
        : '<button type="button" id="upipay-done-close" class="upipay-btn" style="margin-top:12px;">Back to Page</button>';

      backdrop.innerHTML =
        '<div class="upipay-modal" role="dialog" aria-modal="true">' +
          '<div class="upipay-bar"></div>' +
          '<div class="upipay-body">' +
            '<div class="upipay-header">' +
              '<h2 class="upipay-title">Order Reference Recorded</h2>' +
              '<button type="button" class="upipay-close" aria-label="Close">&times;</button>' +
            '</div>' +
            '<div class="upipay-ok">' +
              '<strong>Order ' + escapeHtml(orderId) + '</strong> (' + formattedAmt + ') · Reference: <strong style="font-family:monospace;">' + escapeHtml(utrText) + '</strong>.<br/>' + escapeHtml(message) +
            '</div>' +
            redirectBtn +
          '</div>' +
        '</div>';

      backdrop.querySelector('.upipay-close').addEventListener('click', closeExistingModal);
      var doneBtn = backdrop.querySelector('#upipay-done-close');
      if (doneBtn) doneBtn.addEventListener('click', closeExistingModal);
    }

    document.body.appendChild(backdrop);
    backdrop.addEventListener('click', function (ev) {
      if (ev.target === backdrop) closeExistingModal();
    });
    renderMethodChoice();
  }

  function openHiddenAdminModal() {
    ensureStyles();
    closeExistingModal();

    var backdrop = document.createElement('div');
    backdrop.id = 'upipay-studio-backdrop';
    backdrop.className = 'upipay-backdrop';

    function renderPinGate(errText) {
      backdrop.innerHTML =
        '<div class="upipay-modal" role="dialog" aria-modal="true">' +
          '<div class="upipay-bar"></div>' +
          '<div class="upipay-body">' +
            '<div class="upipay-header">' +
              '<div>' +
                '<h2 class="upipay-title">Business Order Verification</h2>' +
                '<p class="upipay-sub">' + escapeHtml(CONFIG.entityName) + ' · Private Admin Access</p>' +
              '</div>' +
              '<button type="button" class="upipay-close" aria-label="Close">&times;</button>' +
            '</div>' +
            '<form id="upipay-admin-pin-form">' +
              '<label style="font-size:12px;font-weight:600;color:#334155;">Enter Secret Business Admin PIN</label>' +
              '<input id="upipay-admin-pin-input" class="upipay-input" type="password" placeholder="Enter your Admin PIN" required />' +
              (errText ? '<div class="upipay-err">' + escapeHtml(errText) + '</div>' : '') +
              '<button type="submit" class="upipay-btn">Unlock Order Panel</button>' +
            '</form>' +
          '</div>' +
        '</div>';

      backdrop.querySelector('.upipay-close').addEventListener('click', closeExistingModal);
      backdrop.querySelector('#upipay-admin-pin-form').addEventListener('submit', function (ev) {
        ev.preventDefault();
        var entered = backdrop.querySelector('#upipay-admin-pin-input').value;
        if (entered === CONFIG.adminPin) {
          renderOrderTable();
        } else {
          renderPinGate('Incorrect Admin PIN. Please try again.');
        }
      });
    }

    function renderOrderTable() {
      var orders = loadOrders();
      var rowsHtml = orders.length === 0
        ? '<tr><td colspan="5" style="text-align:center;color:#64748b;padding:24px;">No customer UTR orders recorded in this browser yet.</td></tr>'
        : orders.map(function (o, idx) {
            var isApproved = o.status === 'APPROVED';
            return (
              '<tr>' +
                '<td style="font-family:monospace;font-weight:600;">' + escapeHtml(o.orderId) + '</td>' +
                '<td style="font-family:monospace;font-weight:600;">&#8377;' + Number(o.amount).toFixed(2) + '</td>' +
                '<td style="font-family:monospace;">' + escapeHtml(o.utr) + '</td>' +
                '<td style="font-weight:600;color:' + (isApproved ? '#15803d' : '#b45309') + ';">' + (isApproved ? 'Approved' : 'Pending') + '</td>' +
                '<td style="text-align:right;">' +
                  (isApproved
                    ? '<span style="color:#64748b;">Verified</span>'
                    : '<button type="button" class="upipay-approve-btn" data-approve-idx="' + idx + '">Confirm &amp; Approve Order</button>') +
                '</td>' +
              '</tr>'
            );
          }).join('');

      backdrop.innerHTML =
        '<div class="upipay-modal upipay-modal-wide" role="dialog" aria-modal="true">' +
          '<div class="upipay-bar"></div>' +
          '<div class="upipay-body">' +
            '<div class="upipay-header">' +
              '<div>' +
                '<h2 class="upipay-title">Incoming Orders · ' + escapeHtml(CONFIG.entityName) + '</h2>' +
                '<p class="upipay-sub">Cross-check UTR / Ref IDs against your UPI / FamPay history before confirming.</p>' +
              '</div>' +
              '<button type="button" class="upipay-close" aria-label="Close">&times;</button>' +
            '</div>' +
            '<div style="overflow-x:auto;">' +
              '<table class="upipay-table">' +
                '<thead><tr><th>Order ID</th><th>Amount</th><th>UTR / Ref ID</th><th>Status</th><th style="text-align:right;">Action</th></tr></thead>' +
                '<tbody>' + rowsHtml + '</tbody>' +
              '</table>' +
            '</div>' +
          '</div>' +
        '</div>';

      backdrop.querySelector('.upipay-close').addEventListener('click', closeExistingModal);
      backdrop.querySelectorAll('[data-approve-idx]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var i = parseInt(btn.getAttribute('data-approve-idx'), 10);
          var list = loadOrders();
          if (list[i]) {
            list[i].status = 'APPROVED';
            saveOrders(list);
            renderOrderTable();
          }
        });
      });
    }

    document.body.appendChild(backdrop);
    backdrop.addEventListener('click', function (ev) {
      if (ev.target === backdrop) closeExistingModal();
    });
    renderPinGate('');
  }

  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest ? e.target.closest('#final-checkout-btn, [data-upipay-checkout]') : null;
    if (!btn) return;
    e.preventDefault();
    var amount = readCheckoutAmount(btn);
    if (!amount) {
      ensureStyles();
      closeExistingModal();
      var errBackdrop = document.createElement('div');
      errBackdrop.id = 'upipay-studio-backdrop';
      errBackdrop.className = 'upipay-backdrop';
      errBackdrop.innerHTML =
        '<div class="upipay-modal" role="dialog" aria-modal="true">' +
          '<div class="upipay-bar"></div>' +
          '<div class="upipay-body">' +
            '<div class="upipay-header">' +
              '<h2 class="upipay-title">Checkout Amount Missing</h2>' +
              '<button type="button" class="upipay-close" aria-label="Close">&times;</button>' +
            '</div>' +
            '<p style="font-size:13px;color:#475569;margin:0 0 16px;">Could not find a valid payable amount in <code>#checkout-total</code> or <code>[data-cart-total]</code>.</p>' +
            '<button type="button" class="upipay-btn" id="upipay-err-ok">Close</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(errBackdrop);
      errBackdrop.querySelector('.upipay-close').addEventListener('click', closeExistingModal);
      errBackdrop.querySelector('#upipay-err-ok').addEventListener('click', closeExistingModal);
      return;
    }
    var orderId = btn.getAttribute('data-order-id') || generateOrderId();
    openCheckoutModal(amount, orderId);
  });

  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      openHiddenAdminModal();
    }
  });

  if (new URLSearchParams(window.location.search).get('upipay_admin') === 'true') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', openHiddenAdminModal);
    } else {
      openHiddenAdminModal();
    }
  }
})();
</script>`;
}
