import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { clampNum, clampStr, LIMITS, normalizeAllowedEmails, sanitizeId } from './validation';

function requireUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error('Authentication required to write to cloud database.');
  }
  return uid;
}

export async function createCloudDoc(
  colName: string,
  id: string,
  payload: Record<string, unknown>,
  allowedEmails: string[],
  options: { hasUpdatedAt?: boolean } = { hasUpdatedAt: true }
): Promise<void> {
  const cleanId = sanitizeId(id, colName.slice(0, 4));
  const ownerUid = requireUid();
  const emails = normalizeAllowedEmails(allowedEmails);
  const data: Record<string, unknown> = {
    ...payload,
    id: cleanId,
    ownerUid,
    allowedEmails: emails,
    createdAt: serverTimestamp(),
  };
  if (options.hasUpdatedAt !== false) {
    data.updatedAt = serverTimestamp();
  }
  try {
    await setDoc(doc(db, colName, cleanId), data);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `${colName}/${cleanId}`);
  }
}

export async function updateCloudDoc(
  colName: string,
  id: string,
  updates: Record<string, unknown>
): Promise<void> {
  const cleanId = sanitizeId(id, colName.slice(0, 4));
  try {
    await updateDoc(doc(db, colName, cleanId), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${colName}/${cleanId}`);
  }
}

export async function deleteCloudDoc(colName: string, id: string): Promise<void> {
  const cleanId = sanitizeId(id, colName.slice(0, 4));
  try {
    await deleteDoc(doc(db, colName, cleanId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${colName}/${cleanId}`);
  }
}

export async function upsertCashRegister(
  registerId: string,
  payload: {
    isOpen: boolean;
    openingBalance: number;
    currentCash: number;
    cashDrops: Array<{ id: number; amount: number; time: string; note?: string }>;
  },
  allowedEmails: string[],
  existsInCloud: boolean
): Promise<void> {
  const cleanId = sanitizeId(registerId, 'reg');
  const cleanPayload = {
    isOpen: Boolean(payload.isOpen),
    openingBalance: clampNum(payload.openingBalance, 0),
    currentCash: clampNum(payload.currentCash, 0),
    cashDrops: payload.cashDrops.slice(0, LIMITS.maxCashDrops).map((d) => ({
      id: Number(d.id) || Date.now(),
      amount: clampNum(d.amount, 0),
      time: clampStr(d.time, LIMITS.phoneMax),
      note: clampStr(d.note || '', LIMITS.shortNameMax),
    })),
    updatedAt: serverTimestamp(),
  };

  try {
    if (existsInCloud) {
      await updateDoc(doc(db, 'registers', cleanId), cleanPayload);
    } else {
      await setDoc(doc(db, 'registers', cleanId), {
        id: cleanId,
        ...cleanPayload,
        ownerUid: requireUid(),
        allowedEmails: normalizeAllowedEmails(allowedEmails),
      });
    }
  } catch (error) {
    handleFirestoreError(
      error,
      existsInCloud ? OperationType.UPDATE : OperationType.CREATE,
      `registers/${cleanId}`
    );
  }
}

export async function authorizeStaffEmail(
  email: string,
  name: string,
  role: 'Branch Manager' | 'Cashier' | 'Waiter' | 'Chef' | 'Kitchen'
): Promise<void> {
  const cleanEmail = clampStr(email.toLowerCase(), LIMITS.emailMax);
  const uid = requireUid();
  try {
    await setDoc(doc(db, 'authorizedStaff', cleanEmail), {
      email: cleanEmail,
      name: clampStr(name, LIMITS.shortNameMax),
      role,
      addedByUid: uid,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `authorizedStaff/${cleanEmail}`);
  }
}

export async function revokeStaffEmail(email: string): Promise<void> {
  const cleanEmail = clampStr(email.toLowerCase(), LIMITS.emailMax);
  try {
    await deleteDoc(doc(db, 'authorizedStaff', cleanEmail));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `authorizedStaff/${cleanEmail}`);
  }
}

const SHARED_COLLECTIONS = [
  'branches',
  'staffUsers',
  'menuItems',
  'orders',
  'inventory',
  'customers',
  'giftCards',
  'promos',
  'reservations',
  'shifts',
  'attendance',
  'recipes',
  'voidLogs',
  'wasteLogs',
  'registers',
];

export async function syncAllowedEmailsAcrossCollections(emails: string[]): Promise<void> {
  const normalized = normalizeAllowedEmails(emails);
  const refs: Array<ReturnType<typeof doc>> = [];

  for (const colName of SHARED_COLLECTIONS) {
    try {
      const snap = await getDocs(collection(db, colName));
      for (const docSnap of snap.docs) {
        refs.push(docSnap.ref);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, colName);
    }
  }

  for (let i = 0; i < refs.length; i += 400) {
    const chunk = refs.slice(i, i + 400);
    const batch = writeBatch(db);
    for (const ref of chunk) {
      batch.update(ref, { allowedEmails: normalized });
    }
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'allowedEmailsSync');
    }
  }
}
