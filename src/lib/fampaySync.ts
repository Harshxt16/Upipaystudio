import { PLATFORM_OWNER_CONFIG } from '../config/platform';

export interface StrictUtrValidationResult {
  valid: boolean;
  cleaned: string;
  error?: string;
}

export interface FamPayEmailParseResult {
  utr: string | null;
  utrValidation: StrictUtrValidationResult | null;
  amount: number | null;
  exactAmountMatch: boolean;
  isFamPayLike: boolean;
  canAutoApprove: boolean;
  diagnosticMessage: string;
}

const KNOWN_DUMMY_UTRS = new Set([
  '00000000',
  '11111111',
  '12345678',
  '000000000000',
  '111111111111',
  '222222222222',
  '333333333333',
  '444444444444',
  '555555555555',
  '666666666666',
  '777777777777',
  '888888888888',
  '999999999999',
  '123456789012',
  '012345678901',
  '987654321098',
  '987654321012',
  '112233445566',
  '001122334455',
  '665544332211',
  '123456123456',
  '123412341234',
  '123123123123',
  '121212121212',
  'TEST12345678',
  'DUMMY1234567',
  'SAMPLE123456',
  'FAKE12345678',
]);

export function normalizeVarcharUtr(rawUtr: string): string {
  return rawUtr.replace(/\s+/g, '').trim().toUpperCase();
}

export function validateStrictActivationUtr(rawUtr: string): StrictUtrValidationResult {
  const cleaned = normalizeVarcharUtr(rawUtr);

  if (!/^[A-Z0-9_-]{8,32}$/.test(cleaned)) {
    return {
      valid: false,
      cleaned,
      error: 'UTR must be an 8 to 32 character alphanumeric reference (letters, digits, - or _).',
    };
  }

  // Must contain at least one digit to prevent plain English word entries
  if (!/\d/.test(cleaned)) {
    return {
      valid: false,
      cleaned,
      error: 'Invalid UTR: transaction reference must include digits.',
    };
  }

  if (KNOWN_DUMMY_UTRS.has(cleaned)) {
    return {
      valid: false,
      cleaned,
      error: 'Invalid UTR: dummy or sequential test numbers are rejected.',
    };
  }

  const core = cleaned.replace(/[_-]/g, '');
  if (core.length < 8) {
    return {
      valid: false,
      cleaned,
      error: 'UTR must contain at least 8 alphanumeric characters.',
    };
  }

  // Reject repeating character patterns (e.g. AAAAAAAA1111, 111111111111, ABABABABABAB, 123123123123)
  if (
    /^([A-Z0-9])\1+$/.test(core) ||
    /^([A-Z0-9]{2,4})\1{2,}$/.test(core) ||
    /([A-Z0-9])\1{6,}/.test(core)
  ) {
    return {
      valid: false,
      cleaned,
      error: 'Invalid UTR: repeated character sequences are not allowed.',
    };
  }

  // Reject sequential digit runs inside standard numeric cycles
  if (
    /^\d+$/.test(core) &&
    ('01234567890123456789'.includes(core) || '98765432109876543210'.includes(core))
  ) {
    return {
      valid: false,
      cleaned,
      error: 'Invalid UTR: sequential number patterns are rejected.',
    };
  }

  // Reject ultra-low entropy strings (<= 2 unique characters)
  if (new Set(core.split('')).size <= 2) {
    return {
      valid: false,
      cleaned,
      error: 'Invalid UTR: please enter the genuine UPI UTR / transaction ID from your receipt.',
    };
  }

  return { valid: true, cleaned };
}

export function parseFamPayEmailText(input: {
  subject: string;
  body: string;
  senderEmail?: string;
}): FamPayEmailParseResult {
  const combined = `${input.subject || ''}\n${input.body || ''}`;
  const lower = combined.toLowerCase();
  const senderLower = (input.senderEmail || '').toLowerCase();

  const isFamPayLike =
    senderLower.includes('fampay') ||
    (lower.includes('fampay') &&
      (lower.includes('received') || lower.includes('credited') || lower.includes('upi')));

  // Extract INR amount (₹1, Rs. 1, Rs 1.00, INR 1)
  const expectedAmount = PLATFORM_OWNER_CONFIG.lifetimeFeeInr;
  let amount: number | null = null;
  const amountRegex = /(?:₹|rs\.?|inr)\s*([0-9,]+(?:\.[0-9]{1,2})?)/gi;
  const amountMatches = [...combined.matchAll(amountRegex)];
  if (amountMatches.length > 0) {
    const parsedAmounts = amountMatches
      .map((m) => Number(m[1].replace(/,/g, '')))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (parsedAmounts.length > 0) {
      amount = parsedAmounts.find((n) => n === expectedAmount) ?? parsedAmounts[0];
    }
  }

  // Extract alphanumeric varchar UTR / UPI Reference (8-32 chars)
  let utr: string | null = null;
  const labeledUtrMatch = combined.match(
    /(?:utr|upi\s*(?:ref(?:erence)?|txn|transaction)?\s*(?:id|no\.?|number)?|ref(?:erence)?\s*(?:no\.?|id|number)|txn\s*(?:id|no\.?|number)|transaction\s*(?:id|ref(?:erence)?))[:\s#-]*([A-Za-z0-9_-]{8,32})\b/i
  );
  if (labeledUtrMatch?.[1]) {
    utr = normalizeVarcharUtr(labeledUtrMatch[1]);
  } else {
    const bareMatches = [
      ...combined.matchAll(/\b(?=[A-Za-z0-9_-]*\d)([A-Za-z0-9_-]{10,32})\b/g),
    ].map((m) => normalizeVarcharUtr(m[1]));
    if (bareMatches.length > 0) {
      utr = bareMatches.find((candidate) => validateStrictActivationUtr(candidate).valid) ?? bareMatches[0];
    }
  }

  const utrValidation = utr ? validateStrictActivationUtr(utr) : null;
  const exactAmountMatch = amount === expectedAmount;
  const canAutoApprove = Boolean(utr && utrValidation?.valid && exactAmountMatch);

  let diagnosticMessage = '';
  if (!utr) {
    diagnosticMessage = 'Could not detect a valid alphanumeric UTR / Reference ID in the email text.';
  } else if (!utrValidation?.valid) {
    diagnosticMessage = utrValidation?.error || 'Extracted UTR failed anti-fraud format validation.';
  } else if (amount === null) {
    diagnosticMessage = 'UTR detected, but no INR/₹ payment amount was found.';
  } else if (!exactAmountMatch) {
    diagnosticMessage = `Amount lock rejected auto-approval: extracted ₹${amount}, but exact ₹${expectedAmount} is required.`;
  } else {
    diagnosticMessage = `Verified match criteria: valid varchar UTR (${utr}) and exact ₹${expectedAmount} credit amount.`;
  }

  return {
    utr,
    utrValidation,
    amount,
    exactAmountMatch,
    isFamPayLike,
    canAutoApprove,
    diagnosticMessage,
  };
}

export function generateFamPayAppsScript(params: {
  vercelAppUrl: string;
  syncSecret: string;
  notificationEmail: string;
}): string {
  const baseUrl = (params.vercelAppUrl || 'https://upipaystudio.vercel.app').trim().replace(/\/+$/, '');
  const endpointUrl = `${baseUrl}/api/fampay-sync`;
  const secretValue = params.syncSecret.trim() || 'REPLACE_WITH_YOUR_SYNC_SECRET';
  const emailLabel = params.notificationEmail.trim() || 'dhirajxstream@gmail.com';

  return `/**
 * UPIPay Studio — Automated FamPay Gmail Alert Sync (Varchar UTR Support)
 * Notification Gmail: ${emailLabel}
 * Runs every 1 minute via Google Apps Script Time-Driven Trigger.
 */
var FAMPAY_WEBHOOK_URL = '${endpointUrl.replace(/'/g, "\\'")}';
var SYNC_SECRET = '${secretValue.replace(/'/g, "\\'")}';

function syncFamPayAlertsToWebhook() {
  var searchQuery = 'is:unread (from:fampay OR ("FamPay" AND (received OR credited OR UPI)))';
  var threads = GmailApp.search(searchQuery, 0, 20);

  for (var i = 0; i < threads.length; i++) {
    var messages = threads[i].getMessages();
    for (var j = 0; j < messages.length; j++) {
      var msg = messages[j];
      if (!msg.isUnread()) continue;

      var subject = msg.getSubject() || '';
      var body = msg.getPlainBody() || '';
      var sender = msg.getFrom() || '';
      var combined = subject + '\\n' + body;

      // Extract INR amount (supports ₹1, Rs. 1, INR 1.00)
      var amountMatch = combined.match(/(?:₹|rs\\.?|inr)\\s*([0-9,]+(?:\\.[0-9]{1,2})?)/i);
      var amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : null;

      // Extract alphanumeric varchar UPI Reference / UTR Number (8-32 chars)
      var labeledUtr = combined.match(/(?:utr|upi\\s*(?:ref(?:erence)?|txn|transaction)?\\s*(?:id|no\\.?|number)?|ref(?:erence)?\\s*(?:no\\.?|id|number)|txn\\s*(?:id|no\\.?|number)|transaction\\s*(?:id|ref(?:erence)?))[:\\s#-]*([A-Za-z0-9_-]{8,32})\\b/i);
      var bareUtr = combined.match(/\\b(?=[A-Za-z0-9_-]*\\d)([A-Za-z0-9_-]{10,32})\\b/);
      var rawUtr = labeledUtr ? labeledUtr[1] : (bareUtr ? bareUtr[1] : null);
      var utr = rawUtr ? rawUtr.toUpperCase() : null;

      if (!utr || !amount) {
        continue;
      }

      var payload = {
        utr: utr,
        amount: amount,
        sender_email: sender,
        raw_subject: subject.slice(0, 300)
      };

      var response = UrlFetchApp.fetch(FAMPAY_WEBHOOK_URL, {
        method: 'post',
        contentType: 'application/json',
        headers: {
          'x-sync-secret': SYNC_SECRET
        },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });

      var code = response.getResponseCode();
      if (code >= 200 && code < 300) {
        msg.markRead();
      } else {
        Logger.log('Sync failed (' + code + '): ' + response.getContentText());
      }
    }
  }
}`;
}

export const SAMPLE_FAMPAY_EMAILS = {
  valid499: {
    label: `Valid ₹${PLATFORM_OWNER_CONFIG.lifetimeFeeInr} Credit`,
    senderEmail: 'alerts@fampay.in',
    subject: `FamPay Alert: You received ₹${PLATFORM_OWNER_CONFIG.lifetimeFeeInr} via UPI`,
    body: `Hi Harshit Singh,\nYou have received Rs. ${PLATFORM_OWNER_CONFIG.lifetimeFeeInr}.00 in your FamPay account (8130799171@fam) via UPI.\nUPI Reference / UTR Number: FP2611268901AB\nStatus: Credited successfully.`,
  },
  wrongAmount: {
    label: 'Wrong Amount (₹199)',
    senderEmail: 'alerts@fampay.in',
    subject: 'FamPay Alert: INR 199 credited via UPI',
    body: 'You received INR 199 in your FamPay wallet.\nUTR: 431298765999',
  },
  dummyUtr: {
    label: 'Dummy UTR Test',
    senderEmail: 'alerts@fampay.in',
    subject: `FamPay Alert: ₹${PLATFORM_OWNER_CONFIG.lifetimeFeeInr} received`,
    body: `Amount: ₹${PLATFORM_OWNER_CONFIG.lifetimeFeeInr}\nUPI Ref No: 123456789012`,
  },
};
