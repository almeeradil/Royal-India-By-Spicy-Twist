import { signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { useRef, useState } from 'react';
import { auth, googleProvider } from '../firebase';
import { LOGO_ASSET_URL } from '../lib/seed';
import type { BackupPayload } from '../lib/seed';
import { Icon } from './Icon';

interface LoginScreenProps {
  onCredentialUnlock: () => void;
  onQueueBackupRestore: (backup: BackupPayload) => void;
  pendingBackupMessage: string;
}

const ADMIN_EMAIL = 'admin@gmail.com';
const ADMIN_PASS = 'aefaefzefzef';
const BACKUP_ARRAY_KEYS = [
  'branches',
  'users',
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
] as const;

export function LoginScreen({
  onCredentialUnlock,
  onQueueBackupRestore,
  pendingBackupMessage,
}: LoginScreenProps) {
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [restoreMessage, setRestoreMessage] = useState(pendingBackupMessage);
  const [needsGoogleCloudLink, setNeedsGoogleCloudLink] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showConsoleGuide, setShowConsoleGuide] = useState(false);
  const backupFileInputRef = useRef<HTMLInputElement>(null);

  const handleGoogleSignIn = async () => {
    setLoginError('');
    setIsLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      onCredentialUnlock();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Google sign-in failed.';
      setLoginError(
        msg.includes('popup-closed-by-user')
          ? 'Sign-in window was closed. Please try again.'
          : msg
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoginError('');

    const normalizedEmail = loginEmail.trim().toLowerCase();
    const isAdminCred = normalizedEmail === ADMIN_EMAIL && loginPassword === ADMIN_PASS;

    if (!isAdminCred) {
      // Allow Firebase Email/Password sign-in if configured in Firebase Console for other users
      setIsLoading(true);
      try {
        const cred = await signInWithEmailAndPassword(auth, normalizedEmail, loginPassword);
        if (!cred.user.emailVerified) {
          setNeedsGoogleCloudLink(true);
          setLoginError(
            'Your Firebase email is not verified yet. Click "Connect Cloud Sync with Google" below for instant verified access.'
          );
          return;
        }
        onCredentialUnlock();
        return;
      } catch {
        setLoginError('Email or password is incorrect. Please try again.');
        setLoginPassword('');
        return;
      } finally {
        setIsLoading(false);
      }
    }

    // Admin portal credentials matched (admin@gmail.com / aefaefzefzef)
    setIsLoading(true);
    try {
      if (auth.currentUser && auth.currentUser.emailVerified) {
        onCredentialUnlock();
        return;
      }
      const cred = await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASS);
      if (cred.user.emailVerified) {
        onCredentialUnlock();
        return;
      }
      setNeedsGoogleCloudLink(true);
    } catch {
      // Email/Password provider isn't enabled or admin@gmail.com isn't verified in Firebase Console yet
      setNeedsGoogleCloudLink(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestoreFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const data = parsed?.version === 1 ? parsed.data : null;
      if (
        !data ||
        !BACKUP_ARRAY_KEYS.every((key) => Array.isArray(data[key])) ||
        !data.registerState ||
        !Array.isArray(data.registerState.cashDrops)
      ) {
        throw new Error('Invalid backup structure');
      }
      onQueueBackupRestore(data as BackupPayload);
      setRestoreMessage('Backup queued. Sign in to upload and sync it to the cloud database.');
      setLoginError('');
    } catch {
      setRestoreMessage('');
      setLoginError('Could not restore this file. Please choose a valid Royal India JSON backup.');
    }
    event.target.value = '';
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl lg:grid lg:grid-cols-2 lg:items-stretch">
        <section className="relative hidden min-h-[600px] flex-col justify-between overflow-hidden bg-gradient-to-br from-orange-500 via-orange-600 to-rose-700 p-10 text-white lg:flex">
          <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full border-[40px] border-white/10" />
          <div className="absolute -bottom-28 -left-20 h-80 w-80 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-white/15 ring-1 ring-white/25">
              <img
                src={LOGO_ASSET_URL}
                alt="Royal India By Spicy Twist logo"
                className="h-full w-full object-cover"
              />
            </div>
            <div>
              <p className="font-extrabold tracking-wide">ROYAL INDIA BY SPICY TWIST</p>
              <p className="text-xs text-orange-100">Cloud-Synced Restaurant Management</p>
            </div>
          </div>
          <div className="relative max-w-md">
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.25em] text-orange-100">
              Live Multi-Laptop Sync
            </p>
            <h1 className="text-4xl font-extrabold leading-tight">
              Waiter POS to Kitchen Chef, synced in real time.
            </h1>
            <p className="mt-5 text-sm leading-6 text-orange-50">
              Update menus, manage branches, take table orders, and dispatch tickets directly to
              the kitchen display screen across every connected laptop.
            </p>
          </div>
          <p className="relative text-xs text-orange-100">
            AI Studio Cloud Database · Multi-branch operations · PKR reporting
          </p>
        </section>

        <section className="flex min-h-[600px] flex-col justify-center px-6 py-12 sm:px-12 lg:px-14">
          <div className="mb-8 lg:hidden flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-slate-900 shadow-lg">
              <img
                src={LOGO_ASSET_URL}
                alt="Royal India By Spicy Twist logo"
                className="h-full w-full object-cover"
              />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-600">
                Royal India By Spicy Twist
              </p>
              <p className="text-xs text-slate-500">Cloud POS & Kitchen Sync</p>
            </div>
          </div>

          <div className="mb-6">
            <p className="text-sm font-semibold text-orange-600">ADMIN PORTAL</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">
              Sign in to your account
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Enter your administrator credentials or connect with Google for live cloud sync.
            </p>
          </div>

          {needsGoogleCloudLink ? (
            <div className="space-y-4 rounded-2xl border border-orange-200 bg-orange-50/70 p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-orange-500 p-2 text-white shrink-0">
                  <Icon name="cloud" className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Portal credentials verified
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    Connect your verified Google account so this laptop syncs menus, orders, and
                    kitchen tickets live with the AI Studio Cloud database.
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={isLoading}
                onClick={handleGoogleSignIn}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-orange-500/25 transition hover:bg-orange-600 disabled:opacity-60"
              >
                <Icon name="shield-check" className="w-4 h-4" />
                {isLoading ? 'Connecting Cloud Sync...' : 'Connect Cloud Sync with Google'}
              </button>

              <button
                type="button"
                onClick={() => setShowConsoleGuide(!showConsoleGuide)}
                className="w-full text-center text-xs font-semibold text-slate-600 hover:text-slate-900 underline"
              >
                {showConsoleGuide
                  ? 'Hide Firebase Email/Password setup steps'
                  : 'Using Email/Password without Google? View setup steps'}
              </button>

              {showConsoleGuide && (
                <div className="rounded-xl border border-slate-200 bg-white p-3.5 text-xs text-slate-600 space-y-1.5">
                  <p className="font-bold text-slate-800">
                    Enable Email/Password in Firebase Console:
                  </p>
                  <p>1. Open Firebase Console → Authentication → Sign-in method.</p>
                  <p>2. Enable Email/Password provider and add your verified staff user.</p>
                  <p>3. Sign in on every laptop using Google or verified Email/Password.</p>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setNeedsGoogleCloudLink(false);
                  setLoginPassword('');
                }}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Back to Email Login
              </button>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="login-email" className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Email address
                </label>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="username"
                  required
                  value={loginEmail}
                  onChange={(event) => setLoginEmail(event.target.value)}
                  placeholder="admin@gmail.com"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-100"
                />
              </div>
              <div>
                <label htmlFor="login-password" className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Password
                </label>
                <input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={loginPassword}
                  onChange={(event) => setLoginPassword(event.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-100"
                />
              </div>
              {loginError && (
                <p
                  role="alert"
                  className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700"
                >
                  {loginError}
                </p>
              )}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-xl bg-orange-500 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-orange-500/25 transition hover:bg-orange-600 focus:outline-none focus:ring-4 focus:ring-orange-200 disabled:opacity-60"
              >
                {isLoading ? 'Signing in...' : 'Sign in securely'}
              </button>

              <div className="relative flex items-center py-1">
                <div className="flex-grow border-t border-slate-200" />
                <span className="mx-3 shrink-0 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  or direct cloud sync
                </span>
                <div className="flex-grow border-t border-slate-200" />
              </div>

              <button
                type="button"
                disabled={isLoading}
                onClick={handleGoogleSignIn}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:border-orange-400 hover:bg-orange-50 disabled:opacity-60"
              >
                <Icon name="cloud" className="w-4 h-4 text-orange-500" />
                Sign in with Google (Multi-Laptop Sync)
              </button>
            </form>
          )}

          <input
            ref={backupFileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleRestoreFile}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => backupFileInputRef.current?.click()}
            className="mt-4 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:border-orange-400 hover:bg-orange-50"
          >
            Restore data from JSON backup to Cloud
          </button>
          {restoreMessage && (
            <p
              role="status"
              className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700"
            >
              {restoreMessage}
            </p>
          )}
          <p className="mt-6 text-center text-xs text-slate-400">
            Authorized administrator & verified staff access only
          </p>
        </section>
      </div>
    </div>
  );
}
