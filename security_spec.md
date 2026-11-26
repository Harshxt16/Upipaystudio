# Security Specification & Payload-First TDD (`security_spec.md`)

## 1. Data Invariants
1. **Identity & Ownership**: A `ClientAccount` document at `/clients/{clientId}` MUST have `id == clientId`, `uid == clientId`, and `uid == request.auth.uid` on creation. Both `id`, `uid`, and `createdAt` are immutable after creation.
2. **State Integrity**: On creation, a merchant's `status` MUST start as `'UNPAID'` (unless written by a verified admin). A merchant CANNOT self-activate (`status = 'ACTIVE'`) or self-reject (`status = 'REJECTED'`); only a verified platform owner admin (`isAdmin()`) may set `status` to `'ACTIVE'` or `'REJECTED'`.
3. **PII Isolation**: Merchant emails, PINs, and UTR references live inside `/clients/{clientId}` and are strictly readable only by `isOwner(clientId)` or `isAdmin()`. Blanket `allow read: if isSignedIn();` is forbidden.
4. **Temporal Integrity**: `createdAt` and `updatedAt` MUST equal `request.time` via Firestore `serverTimestamp()`.
5. **Payload Hygiene**: Unknown/ghost keys (e.g., `isAdmin`, `role`, `isVerified`) MUST be rejected via strict `keys().hasOnly(...)` on create and `affectedKeys().hasOnly(...)` on update.
6. **Order Relational Integrity**: Every `/orders/{orderId}` document MUST reference an existing `/clients/{clientId}` document (`exists(...)`). Updates to `/orders/{orderId}` are restricted to the parent merchant owner or platform owner admin.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Identity Spoofing on Create**: User A (`uid: "userA"`) tries to create `/clients/userB` with `uid: "userB"` -> **MUST FAIL (`PERMISSION_DENIED`)**.
2. **Mismatched Body UID**: User A creates `/clients/userA` with `uid: "userB"` -> **MUST FAIL (`PERMISSION_DENIED`)**.
3. **Self-Activation Bypass**: User A creates `/clients/userA` with `status: "ACTIVE"` -> **MUST FAIL (`PERMISSION_DENIED`)**.
4. **Update State Shortcutting**: User A updates `/clients/userA` from `UNPAID` to `status: "ACTIVE"` -> **MUST FAIL (`PERMISSION_DENIED`)**.
5. **Shadow Ghost Field Injection**: User A creates or updates `/clients/userA` including `isAdmin: true` or `role: "admin"` -> **MUST FAIL (`PERMISSION_DENIED`)**.
6. **Admin Escalation**: User A writes `/admins/userA` -> **MUST FAIL (`PERMISSION_DENIED`)**.
7. **PII Blanket List Scraping**: Non-admin User A calls `list` on `/clients` without matching `resource.data.uid == request.auth.uid` -> **MUST FAIL (`PERMISSION_DENIED`)**.
8. **Cross-Merchant PII Read**: User A calls `get` on `/clients/userB` -> **MUST FAIL (`PERMISSION_DENIED`)**.
9. **Path ID Poisoning**: User A tries to write `/clients/bad..id$$$` or a 500-char ID -> **MUST FAIL (`PERMISSION_DENIED`)**.
10. **String Resource Exhaustion**: User A sends a 10KB `entityName` or 1MB `fullName` -> **MUST FAIL (`PERMISSION_DENIED`)**.
11. **Timestamp Forgery**: User A sends `createdAt: "2020-01-01T00:00:00Z"` instead of `request.time` -> **MUST FAIL (`PERMISSION_DENIED`)**.
12. **Unverified Email Spoof**: User with `email: "autoclipping1@gmail.com"` and `email_verified: false` attempts admin read/write -> **MUST FAIL (`PERMISSION_DENIED`)**.
