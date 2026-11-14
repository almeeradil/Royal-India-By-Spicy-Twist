# Security Specification & Red-Team TDD for Royal India By Spicy Twist

## 1. Data Invariants
1. **Default-Deny Catch-All**: All unmatched paths under `/databases/{database}/documents` are denied (`allow read, write: if false`).
2. **Verified Identity**: All read and write operations require `request.auth != null` and `request.auth.token.email_verified == true`.
3. **Role & Ownership Enforcement**:
   - Bootstrapped Super Admin (`wajihaadil2@gmail.com` with `email_verified == true`) and UIDs in `/admins/{uid}` have full administrative access.
   - Multi-device staff accounts listed in `/authorizedStaff/{email}` (verified email) can read/write operational documents (`orders`, `menuItems`, `inventory`, `reservations`, etc.) on `get`/`create`/`update`, while `list` queries enforce either `isBootstrappedAdmin()` or `resource.data.ownerUid == request.auth.uid` without `get()`/`exists()` inside `allow list`.
4. **Immutable Ownership & Server Timestamps**:
   - Every created document must set `ownerUid == request.auth.uid` and `createdAt == request.time` (and `updatedAt == request.time` where applicable).
   - Updates must preserve `ownerUid == existing().ownerUid` and `createdAt == existing().createdAt`, and set `updatedAt == request.time`.
5. **Strict Key Allowlists & Bounded Lists**:
   - Every `create` verifies `keys().hasAll(...)` and `keys().hasOnly(...)`.
   - Every `update` uses action-based `affectedKeys().hasOnly(...)` wrapped inside `isValid[Entity](incoming())`.
   - Bounded lists: `menuItems.availability` (`<= 50`), `orders.items` (`1..50`), `recipes.ingredients` (`<= 30`), `registers.cashDrops` (`<= 100`).
6. **Terminal State Locking**:
   - Orders with `status` in `['Completed', 'Cancelled']` cannot be modified by non-admin users.
7. **Relational Consistency**:
   - Orders reference an existing branch via `exists(/databases/$(database)/documents/branches/$(incoming().branch_id))` on create.
   - Inventory and reservations reference an existing branch on create.
8. **PII Protection**:
   - `staffUsers`, `customers`, `reservations`, and `orders` have zero blanket `isSignedIn()` reads; access requires `isBootstrappedAdmin()`, `isAuthorizedStaff()`, or `ownerUid == request.auth.uid`.

## 2. The "Dirty Dozen" Attack Payloads (All Must Fail with PERMISSION_DENIED)
1. **Unauthenticated Order Creation**: `request.auth == null` writing `/orders/ord-1`.
2. **Unverified Email Spoof**: `request.auth.token.email == 'wajihaadil2@gmail.com'` with `email_verified: false` reading `/staffUsers/u1`.
3. **Ghost Field Injection (Shadow Update)**: Creating `/menuItems/m1` with extra key `isVerified: true`.
4. **Privilege Escalation on Staff**: Non-admin writing `/admins/attackerUid` or `/authorizedStaff/attacker@gmail.com`.
5. **Owner Spoofing**: Creating `/orders/ord-2` with `ownerUid: 'other-uid'` != `request.auth.uid`.
6. **Client Timestamp Forgery**: Creating `/orders/ord-2` with `createdAt: new Date('2020-01-01')` instead of `request.time`.
7. **Orphaned Order Creation**: Creating `/orders/ord-3` with `branch_id: 'nonexistent-branch'`.
8. **Terminal State Tampering**: Non-admin updating an order whose `existing().status == 'Completed'`.
9. **ID Poisoning**: Creating `/branches/<1500-char-invalid-id>` or special characters `../admin`.
10. **Value Poisoning**: Updating `menuItems/m1` with `price: -50` or `name: <500-char string>`.
11. **Unbounded Array Bomb**: Creating `/orders/ord-4` with `items` length 51 or `items` length 0.
12. **Immutable Log Tampering**: Updating or deleting an audit entry in `/voidLogs/v1` as a non-admin.
