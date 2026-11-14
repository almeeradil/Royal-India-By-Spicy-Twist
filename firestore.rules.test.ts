/**
 * Red-Team Security Rules Verification Suite (Dirty Dozen Payloads)
 * Intended for verification against Firebase Rules Unit Testing / Emulator.
 */

export const DIRTY_DOZEN_CASES = [
  {
    name: '1. Unauthenticated order creation must be denied',
    auth: null,
    op: 'create',
    path: 'orders/ord-1',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '2. Unverified admin email spoof must be denied',
    auth: { uid: 'spoof-uid', email: 'wajihaadil2@gmail.com', email_verified: false },
    op: 'get',
    path: 'staffUsers/u1',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '3. Ghost field injection (isVerified) on menuItems must be denied',
    auth: { uid: 'admin-uid', email: 'wajihaadil2@gmail.com', email_verified: true },
    op: 'create',
    path: 'menuItems/m1',
    payload: { id: 'm1', name: 'Biryani', category: 'Rice', price: 650, stock: 20, image: '', availability: ['b1'], isVerified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '4. Non-admin privilege escalation on /admins must be denied',
    auth: { uid: 'staff-uid', email: 'waiter@example.com', email_verified: true },
    op: 'create',
    path: 'admins/staff-uid',
    payload: { uid: 'staff-uid', email: 'waiter@example.com' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '5. Owner spoofing on order create must be denied',
    auth: { uid: 'staff-uid', email: 'waiter@example.com', email_verified: true },
    op: 'create',
    path: 'orders/ord-2',
    payload: { id: 'ord-2', ownerUid: 'different-uid' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '6. Client timestamp forgery on order create must be denied',
    auth: { uid: 'admin-uid', email: 'wajihaadil2@gmail.com', email_verified: true },
    op: 'create',
    path: 'orders/ord-2',
    payload: { id: 'ord-2', createdAt: '2020-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '7. Orphaned order creation referencing nonexistent branch must be denied',
    auth: { uid: 'admin-uid', email: 'wajihaadil2@gmail.com', email_verified: true },
    op: 'create',
    path: 'orders/ord-3',
    payload: { id: 'ord-3', branch_id: 'nonexistent-branch' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '8. Terminal state tampering on Completed order by non-admin staff must be denied',
    auth: { uid: 'staff-uid', email: 'waiter@example.com', email_verified: true },
    op: 'update',
    path: 'orders/ord-completed',
    payload: { status: 'New Orders' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '9. ID poisoning with invalid characters or length > 128 must be denied',
    auth: { uid: 'admin-uid', email: 'wajihaadil2@gmail.com', email_verified: true },
    op: 'create',
    path: `branches/${'a'.repeat(200)}`,
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '10. Value poisoning (negative price) on menuItems must be denied',
    auth: { uid: 'admin-uid', email: 'wajihaadil2@gmail.com', email_verified: true },
    op: 'update',
    path: 'menuItems/m1',
    payload: { price: -100 },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '11. Unbounded items array (> 50 or 0) on orders must be denied',
    auth: { uid: 'admin-uid', email: 'wajihaadil2@gmail.com', email_verified: true },
    op: 'create',
    path: 'orders/ord-4',
    payload: { id: 'ord-4', items: [] },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '12. Non-admin tampering on voidLogs must be denied',
    auth: { uid: 'staff-uid', email: 'waiter@example.com', email_verified: true },
    op: 'delete',
    path: 'voidLogs/v1',
    expected: 'PERMISSION_DENIED',
  },
];
