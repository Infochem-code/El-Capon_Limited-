# Warehouse Inventory Security Specification

## 1. Data Invariants

1. **PII Isolation & Role-Based Profile Governance**:
   - Users can read their own profile (`/users/{uid}`). Only verified `admin` users can list all stakeholders or modify any user's `role` or `status`.
   - Non-admin users creating their initial `/users/{uid}` document MUST be restricted to `role == 'viewer'` and `status == 'active'`, preventing self-assigned privilege escalation.
2. **Verified Identity & Active Membership Gate**:
   - Every write operation requires `request.auth != null` and `request.auth.token.email_verified == true`, plus an active stakeholder profile (or bootstrapped admin identity).
   - Suspended users (`status == 'suspended'`) immediately lose all read and write access to inventory, transactions, locations, and backups.
3. **Referential & Atomic Inventory Integrity**:
   - Every `/materials/{materialId}` document MUST reference an existing `/locations/{locationId}` document on creation.
   - Every `/transactions/{transactionId}` document MUST reference an existing `/materials/{materialId}` document and MUST verify via `getAfter()` that the parent material's `quantity` was atomically updated to `incoming().newQuantity` in the same Firestore transaction.
   - `/transactions/{transactionId}` records are immutable (`allow update, delete: if false;`) to preserve an untampered audit trail.
4. **Stock Non-Negativity & Strict Schema Enforcement**:
   - Material `quantity`, `minStockLevel`, and `unitCost` cannot be negative (`>= 0`).
   - All document writes must pass strict `hasAll` + `hasOnly` key checks, string `.size()` bounds, regex ID validation (`^[a-zA-Z0-9_\-]+$`), and `request.time` server timestamp equality on `createdAt`/`updatedAt`.
5. **Role Tier Enforcement**:
   - `viewer`: Read-only access to materials, locations, and transactions. Cannot mutate inventory, logs, backups, or settings.
   - `operator`: Can record `IN` / `OUT` / `TRANSFER` / `ADJUST` transactions and update material quantities atomically during transactions. Cannot create/delete materials, locations, or backups.
   - `manager`: Can create/edit materials, record transactions, and create encrypted backups/settings. Cannot delete materials or alter user roles.
   - `admin`: Full administrative privileges including role management, location management, and material deletion.

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Self-Admin Escalation**: A newly authenticated user tries `setDoc('/users/' + uid, { ..., role: 'admin' })`. -> `PERMISSION_DENIED`.
2. **Role Mutation by Operator**: An `operator` updates their own `/users/{uid}` doc changing `role` to `'manager'`. -> `PERMISSION_DENIED`.
3. **Shadow Field Injection**: A `manager` creates a `/materials/{id}` doc with an extra ghost key `isVerified: true`. -> `PERMISSION_DENIED`.
4. **Unverified Email Spoofing**: A client token with `email: 'rma27660@gmail.com'` and `email_verified: false` attempts to write to `/materials`. -> `PERMISSION_DENIED`.
5. **PII Scraping**: A `viewer` or `operator` tries to `get` or `list` `/users` profiles belonging to other users. -> `PERMISSION_DENIED`.
6. **Orphaned Material Creation**: A `manager` creates a material with a non-existent `locationId: 'FAKE-LOC-999'`. -> `PERMISSION_DENIED`.
7. **Forged Transaction Without Stock Update**: An `operator` creates a `/transactions/{id}` document without atomically updating `/materials/{materialId}.quantity` to `newQuantity`. -> `PERMISSION_DENIED`.
8. **Audit Log Tampering**: A `manager` or `admin` attempts to `update` or `delete` an existing `/transactions/{id}` record. -> `PERMISSION_DENIED`.
9. **Negative Stock Manipulation**: An `operator` attempts to set `quantity: -50` on `/materials/{id}`. -> `PERMISSION_DENIED`.
10. **ID Poisoning / Resource Exhaustion**: A user attempts to create `/materials/{1500_char_id}` or inject a 1MB `notes` string. -> `PERMISSION_DENIED`.
11. **Timestamp Forgery**: A user submits a backdated `createdAt` or `updatedAt` timestamp instead of `serverTimestamp()`. -> `PERMISSION_DENIED`.
12. **Unauthorized Backup Deletion / Viewer Write**: A `viewer` attempts to create a transaction or delete a backup record. -> `PERMISSION_DENIED`.
