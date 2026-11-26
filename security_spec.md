# Security Specification & Payload-First TDD (`security_spec.md`)

## 1. Data Invariants
1. **Identity & Ownership**: A `ClientAccount` document at `/clients/{clientId}` MUST have `id == clientId`, `uid == clientId`, and `uid == request.auth.uid` on creation. Both `id`, `uid`, and `createdAt` are immutable after creation.
2. **State Integrity & Exact ₹1 Lock**: On creation, a merchant's `status` MUST start as `'UNPAID'`. A merchant CANNOT self-activate (`status = 'ACTIVE'`) unless atomically consuming an unmatched `fampay_alerts/{utr}` record with `amount == 1` and `matched == false` while simultaneously creating `used_utrs/{utr}` and setting `fampay_alerts/{utr}.matched = true` in the same batch. Otherwise only `isAdmin()` may set `status = 'ACTIVE'`.
3. **Anti-Fraud UTR & Duplicate Blocker**: `activationUtr` on `clients/{clientId}` and document IDs in `used_utrs/{utr}` and `fampay_alerts/{utr}` MUST match `^[A-Za-z0-9_-]{8,32}$`. Once recorded in `used_utrs`, a UTR is immutable and blocks any subsequent account activation attempt.
4. **PII Isolation**: Merchant emails, PINs, and client lists live inside `/clients/{clientId}` and are strictly readable only by `isOwner(clientId)` or `isAdmin()`. Blanket `allow list: if isSignedIn();` is forbidden on `clients`, `orders`, `used_utrs`, `fampay_alerts`, and `settings`.
5. **Temporal Integrity**: `createdAt` and `updatedAt` MUST equal `request.time` via Firestore `serverTimestamp()`.
6. **Payload Hygiene**: Unknown/ghost keys (e.g., `isAdmin`, `role`, `isVerified`) MUST be rejected via strict `keys().hasOnly(...)` on create and `affectedKeys().hasOnly(...)` on update.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Identity Spoofing on Create**: User A (`uid: "userA"`) tries to create `/clients/userB` with `uid: "userB"` -> **MUST FAIL (`PERMISSION_DENIED`)**.
2. **Mismatched Body UID**: User A creates `/clients/userA` with `uid: "userB"` -> **MUST FAIL (`PERMISSION_DENIED`)**.
3. **Self-Activation Bypass Without FamPay Alert**: User A updates `/clients/userA` to `status: "ACTIVE"` with fabricated UTR `"412345678901"` when `/fampay_alerts/412345678901` does not exist -> **MUST FAIL (`PERMISSION_DENIED`)**.
4. **Wrong Amount Self-Activation Bypass**: User A attempts to claim `/fampay_alerts/412345678901` where `amount == 199` (`!= 1`) -> **MUST FAIL (`PERMISSION_DENIED`)**.
5. **Duplicate UTR Replay Attack**: User B submits UTR `"412345678901"` when `/used_utrs/412345678901` already exists -> **MUST FAIL (`PERMISSION_DENIED`)**.
6. **Non-Atomic Claim Attack**: User A sets `/clients/userA.status = 'ACTIVE'` without also writing `/used_utrs/{utr}` and updating `/fampay_alerts/{utr}.matched = true` in the same atomic batch -> **MUST FAIL (`PERMISSION_DENIED`)**.
7. **Forged FamPay Alert Creation**: Non-admin User A creates `/fampay_alerts/412345678901` -> **MUST FAIL (`PERMISSION_DENIED`)**.
8. **Invalid / Short UTR Format**: User A submits `activationUtr: "UPI-APP-PAID"` or `"12345"` -> **MUST FAIL (`PERMISSION_DENIED`)**.
9. **Shadow Ghost Field Injection**: User A creates or updates `/clients/userA`, `/used_utrs/{utr}`, or `/fampay_alerts/{utr}` including `isAdmin: true` -> **MUST FAIL (`PERMISSION_DENIED`)**.
10. **PII & Alert List Scraping**: Non-admin User A calls `list` on `/clients`, `/used_utrs`, `/fampay_alerts`, or `/settings` -> **MUST FAIL (`PERMISSION_DENIED`)**.
11. **Timestamp Forgery**: User A sends `createdAt: "2020-01-01T00:00:00Z"` instead of `request.time` -> **MUST FAIL (`PERMISSION_DENIED`)**.
12. **Unverified Email Spoof**: User with `email: "autoclipping1@gmail.com"` and `email_verified: false` attempts admin read/write on `/fampay_alerts` or `/settings` -> **MUST FAIL (`PERMISSION_DENIED`)**.
