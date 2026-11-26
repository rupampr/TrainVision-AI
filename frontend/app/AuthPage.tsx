'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface AuthConfig {
    googleClientId: string;
    hasGoogleSecret: boolean;
    resendConfigured: boolean;
}

declare global {
    interface Window {
        google?: {
            accounts?: {
                id?: {
                    initialize: (opts: {
                        client_id: string;
                        callback: (resp: { credential?: string }) => void;
                    }) => void;
                    renderButton: (
                        parent: HTMLElement,
                        options: Record<string, unknown>
                    ) => void;
                };
            };
        };
    }
}

const stations = [
    {
        code: 'HWH',
        name: 'Howrah Junction',
        time: '08:00',
        width: '100%',
    },
    {
        code: 'SRC',
        name: 'Santragachi Junction',
        time: '08:12',
        width: '76%',
    },
    {
        code: 'KGP',
        name: 'Kharagpur Junction',
        time: '08:35',
        width: '53%',
    },
];

const features = [
    {
        icon: '◈',
        title: 'Intelligent scheduling',
        description:
            'Optimize timetables with Greedy & ILP scheduling algorithms.',
    },
    {
        icon: '◎',
        title: 'Real-time monitoring',
        description:
            'Track stations, WebSocket radar telemetry, and operational conflicts.',
    },
    {
        icon: '↗',
        title: 'Simulation & AI insights',
        description:
            'Test What-If disruptions and query Gemini AI for conflict resolutions.',
    },
];

const ERROR_MESSAGES: Record<string, string> = {
    google_client_id_missing:
        'Google Client ID is not configured yet. Add GOOGLE_CLIENT_ID to frontend/.env.',
    google_client_secret_missing:
        'Google Client Secret is not configured for redirect flow.',
    invalid_oauth_state:
        'OAuth security state expired or mismatched. Please try signing in again.',
    google_token_exchange_failed:
        'Google rejected the authorization code. Verify your redirect URI in Google Cloud Console.',
    google_email_unverified:
        'Your Google account email must be verified before signing in.',
    google_auth_exception:
        'Unexpected error during Google sign-in. Please try again.',
};

export default function AuthPage() {
    const router = useRouter();
    const googleBtnRef = useRef<HTMLDivElement>(null);

    const [authConfig, setAuthConfig] = useState<AuthConfig | null>(null);
    const [otpStep, setOtpStep] = useState<'email' | 'verify'>('email');
    const [email, setEmail] = useState<string>('');
    const [otp, setOtp] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [infoMsg, setInfoMsg] = useState<string | null>(null);

    // Load auth configuration & surface any OAuth redirect error
    useEffect(() => {
        let cancelled = false;

        const params = new URLSearchParams(window.location.search);
        const err = params.get('error');
        if (err) {
            queueMicrotask(() => {
                if (!cancelled) {
                    setErrorMsg(ERROR_MESSAGES[err] || `Sign-in failed: ${err}`);
                }
            });
        }

        fetch('/api/auth/config')
            .then((res) => (res.ok ? res.json() : null))
            .then((cfg: AuthConfig | null) => {
                if (!cancelled && cfg) setAuthConfig(cfg);
            })
            .catch(() => {
                // ignore config load error
            });

        return () => {
            cancelled = true;
        };
    }, []);

    // When Client ID is provided WITHOUT Client Secret, render Google Identity Services (ID Token) button
    useEffect(() => {
        if (!authConfig?.googleClientId || authConfig.hasGoogleSecret) return;
        let cancelled = false;

        const initGsi = () => {
            if (cancelled || !window.google?.accounts?.id || !googleBtnRef.current) return;
            window.google.accounts.id.initialize({
                client_id: authConfig.googleClientId,
                callback: async (resp: { credential?: string }) => {
                    if (!resp.credential) return;
                    setLoading(true);
                    setErrorMsg(null);
                    try {
                        const res = await fetch('/api/auth/google/token', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ credential: resp.credential }),
                        });
                        const data = await res.json();
                        if (!res.ok) {
                            throw new Error(data?.error || 'Google verification failed');
                        }
                        router.push(data.redirectTo || '/home');
                        router.refresh();
                    } catch (err: unknown) {
                        setErrorMsg(err instanceof Error ? err.message : String(err));
                    } finally {
                        setLoading(false);
                    }
                },
            });
            googleBtnRef.current.innerHTML = '';
            window.google.accounts.id.renderButton(googleBtnRef.current, {
                theme: 'outline',
                size: 'large',
                width: 380,
                text: 'continue_with',
                shape: 'rectangular',
            });
        };

        if (window.google?.accounts?.id) {
            initGsi();
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = initGsi;
        document.head.appendChild(script);

        return () => {
            cancelled = true;
        };
    }, [authConfig, router]);

    const handleMissingGoogleConfig = () => {
        setErrorMsg(
            'Google Client ID is not configured. Add GOOGLE_CLIENT_ID (and GOOGLE_CLIENT_SECRET for redirect OAuth) in frontend/.env.'
        );
    };

    const handleSendOtp = async (e?: FormEvent) => {
        if (e) e.preventDefault();
        setErrorMsg(null);
        setInfoMsg(null);
        setLoading(true);
        try {
            const res = await fetch('/api/auth/otp/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data?.error || 'Failed to send verification code');
            }
            setOtpStep('verify');
            setInfoMsg(data.message || `6-digit verification code sent to ${email}`);
        } catch (err: unknown) {
            setErrorMsg(err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async (e: FormEvent) => {
        e.preventDefault();
        setErrorMsg(null);
        setLoading(true);
        try {
            const res = await fetch('/api/auth/otp/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, otp }),
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data?.error || 'Invalid verification code');
            }
            router.push(data.redirectTo || '/home');
            router.refresh();
        } catch (err: unknown) {
            setErrorMsg(err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="relative min-h-screen overflow-hidden bg-[#070D1A] text-white selection:bg-blue-500/30">
            {/* Background effects */}
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-blue-600/15 blur-[120px]" />
                <div className="absolute -bottom-40 -right-20 h-96 w-96 rounded-full bg-indigo-600/15 blur-[120px]" />
                <div
                    className="absolute inset-0 opacity-[0.06]"
                    style={{
                        backgroundImage:
                            'linear-gradient(rgba(148,163,184,.4) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,.4) 1px, transparent 1px)',
                        backgroundSize: '48px 48px',
                    }}
                />
            </div>

            {/* Header */}
            <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-6 sm:px-10 lg:px-14">
                <Link href="/" className="group flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-blue-400/30 bg-blue-500/10 text-2xl shadow-lg shadow-blue-950/30 transition group-hover:bg-blue-500/20">
                        🚆
                    </div>

                    <div>
                        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
                            TrainVision<span className="text-blue-400">-AI</span>
                        </h1>
                        <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
                            Intelligent Rail Systems
                        </p>
                    </div>
                </Link>

                <div className="hidden items-center gap-2 text-sm text-slate-400 sm:flex">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                    Smart scheduling platform
                </div>
            </header>

            {/* Main content */}
            <section className="relative z-10 mx-auto flex max-w-7xl items-center justify-center px-5 pb-10 pt-5 sm:px-10 lg:min-h-[calc(100vh-100px)] lg:px-14 lg:pb-16 lg:pt-4">
                <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-[#0C1425]/90 shadow-2xl shadow-black/40 backdrop-blur-xl lg:grid-cols-2">
                    {/* Left panel */}
                    <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-white/10 bg-linear-to-br from-blue-950/80 via-[#101C36] to-[#0B1220] p-10 lg:flex xl:p-12">
                        <div className="pointer-events-none absolute -right-20 top-20 h-72 w-72 rounded-full bg-blue-500/15 blur-[90px]" />

                        <div className="relative">
                            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-400/8 px-3 py-1.5 text-xs font-medium text-blue-300">
                                <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                                Next-generation railway intelligence
                            </div>

                            <h2 className="max-w-md text-4xl font-bold leading-tight tracking-tight xl:text-5xl">
                                Smarter schedules.
                                <br />
                                <span className="bg-linear-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                                    Safer journeys.
                                </span>
                            </h2>

                            <p className="mt-5 max-w-md text-sm leading-7 text-slate-400">
                                Optimize train timetables, identify conflicts,
                                and monitor railway operations through one
                                intelligent scheduling platform.
                            </p>
                        </div>

                        {/* Railway visualization */}
                        <div className="relative my-8 overflow-hidden rounded-2xl border border-blue-400/15 bg-[#081224]/80 p-5">
                            <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-blue-500/10 blur-3xl" />

                            <div className="relative flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-xs text-slate-500">SCHEDULING ENGINE</p>
                                    <p className="mt-1 text-lg font-semibold">Network overview</p>
                                </div>

                                <span className="whitespace-nowrap rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-xs text-emerald-300">
                                    <span className="mr-1">●</span>
                                    Operational
                                </span>
                            </div>

                            <div className="relative mt-7 space-y-5">
                                {stations.map((station, index) => (
                                    <div key={station.code} className="flex items-center gap-3">
                                        <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-blue-400/20 bg-blue-400/10 text-[10px] font-bold text-blue-300">
                                            {station.code}
                                            {index < stations.length - 1 && (
                                                <span className="absolute left-1/2 top-9 h-5 w-px bg-blue-400/30" />
                                            )}
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between gap-2 text-xs">
                                                <span className="truncate text-slate-300">
                                                    {station.name}
                                                </span>
                                                <span className="shrink-0 text-slate-500">
                                                    {station.time}
                                                </span>
                                            </div>

                                            <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/5">
                                                <div
                                                    className="h-full rounded-full bg-linear-to-r from-blue-500 to-indigo-400"
                                                    style={{ width: station.width }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <p className="mt-6 text-[11px] text-slate-500">
                                South Eastern Railway Corridor &middot; HWH &middot; SRC &middot; KGP
                            </p>
                        </div>

                        {/* Features */}
                        <div className="relative space-y-5">
                            {features.map((feature) => (
                                <div key={feature.title} className="flex gap-4">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-400/20 bg-blue-400/8 text-xl text-blue-300">
                                        {feature.icon}
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-semibold text-slate-200">
                                            {feature.title}
                                        </h3>
                                        <p className="mt-1 text-xs leading-5 text-slate-400">
                                            {feature.description}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="relative mt-10 border-t border-white/10 pt-5 text-xs text-slate-500">
                            Built for a smarter, more connected railway network.
                        </div>
                    </aside>

                    {/* Right panel: Google OAuth + Resend Email OTP */}
                    <section className="flex min-w-0 flex-col justify-center px-5 py-9 sm:px-10 sm:py-12 lg:px-10 xl:px-14">
                        {/* Mobile branding */}
                        <div className="mb-8 text-center lg:hidden">
                            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-400/20 bg-blue-500/10 text-3xl">
                                🚆
                            </div>
                            <h2 className="text-2xl font-bold">
                                TrainVision<span className="text-blue-400">-AI</span>
                            </h2>
                            <p className="mt-2 text-sm text-slate-400">
                                Intelligent railway scheduling
                            </p>
                        </div>

                        <div className="mb-7">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">
                                Controller Access
                            </p>
                            <h2 className="mt-3 text-3xl font-bold tracking-tight">
                                Sign in to TrainVision
                            </h2>
                            <p className="mt-3 text-sm leading-6 text-slate-400">
                                Authenticate with Google OAuth or verify your email.
                            </p>
                        </div>

                        {errorMsg && (
                            <div
                                role="alert"
                                className="mb-5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-300"
                            >
                                {errorMsg}
                            </div>
                        )}

                        {infoMsg && (
                            <div
                                role="status"
                                className="mb-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-300"
                            >
                                {infoMsg}
                            </div>
                        )}

                        {/* Google OAuth Sign-In */}
                        {authConfig?.googleClientId && !authConfig.hasGoogleSecret ? (
                            <div className="flex justify-center">
                                <div ref={googleBtnRef} className="w-full flex justify-center" />
                            </div>
                        ) : authConfig?.googleClientId ? (
                            <a
                                href="/api/auth/google"
                                className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-slate-300/20 bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-900 shadow-md transition hover:bg-white"
                            >
                                <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                                    <path
                                        fill="#4285F4"
                                        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                                    />
                                    <path
                                        fill="#34A853"
                                        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                                    />
                                    <path
                                        fill="#FBBC05"
                                        d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                                    />
                                    <path
                                        fill="#EA4335"
                                        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                                    />
                                </svg>
                                Continue with Google
                            </a>
                        ) : (
                            <button
                                type="button"
                                onClick={handleMissingGoogleConfig}
                                disabled={loading}
                                className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-slate-300/20 bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-900 shadow-md transition hover:bg-white cursor-pointer disabled:opacity-60"
                            >
                                <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                                    <path
                                        fill="#4285F4"
                                        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                                    />
                                    <path
                                        fill="#34A853"
                                        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                                    />
                                    <path
                                        fill="#FBBC05"
                                        d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                                    />
                                    <path
                                        fill="#EA4335"
                                        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                                    />
                                </svg>
                                Continue with Google
                            </button>
                        )}

                        {/* Divider */}
                        <div className="my-6 flex items-center gap-3">
                            <div className="h-px flex-1 bg-white/10" />
                            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
                                or email OTP
                            </span>
                            <div className="h-px flex-1 bg-white/10" />
                        </div>

                        {/* Resend Email OTP Form */}
                        {otpStep === 'email' ? (
                            <form onSubmit={handleSendOtp} className="space-y-4">
                                <div>
                                    <label
                                        htmlFor="otp-email"
                                        className="mb-1.5 block text-xs font-medium text-slate-300"
                                    >
                                        Work or Controller Email
                                    </label>
                                    <input
                                        id="otp-email"
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="controller@railops.in"
                                        disabled={loading}
                                        className="w-full rounded-xl border border-white/10 bg-[#111C30] px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading || !email.trim()}
                                    className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-950/40 transition hover:bg-blue-500 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {loading ? 'Sending code...' : 'Send 6-Digit Code'}
                                </button>
                            </form>
                        ) : (
                            <form onSubmit={handleVerifyOtp} className="space-y-4">
                                <div>
                                    <div className="mb-1.5 flex items-center justify-between">
                                        <label
                                            htmlFor="otp-code"
                                            className="text-xs font-medium text-slate-300"
                                        >
                                            6-Digit Verification Code
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setOtpStep('email');
                                                setOtp('');
                                                setInfoMsg(null);
                                                setErrorMsg(null);
                                            }}
                                            className="text-xs text-blue-400 hover:text-blue-300 cursor-pointer"
                                        >
                                            Change email
                                        </button>
                                    </div>

                                    <input
                                        id="otp-code"
                                        type="text"
                                        inputMode="numeric"
                                        pattern="\d{6}"
                                        maxLength={6}
                                        required
                                        value={otp}
                                        onChange={(e) =>
                                            setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))
                                        }
                                        placeholder="123456"
                                        disabled={loading}
                                        className="w-full rounded-xl border border-white/10 bg-[#111C30] px-4 py-3 text-center font-mono text-xl font-bold tracking-[0.5em] text-cyan-300 placeholder:text-slate-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading || otp.length !== 6}
                                    className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-950/40 transition hover:bg-blue-500 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {loading ? 'Verifying...' : 'Verify & Enter Control Center'}
                                </button>

                                <button
                                    type="button"
                                    disabled={loading}
                                    onClick={() => handleSendOtp()}
                                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-medium text-slate-300 transition hover:bg-white/10 cursor-pointer disabled:opacity-60"
                                >
                                    Resend verification code
                                </button>
                            </form>
                        )}

                        {/* Footer */}
                        <div className="mt-8 border-t border-white/8 pt-5 text-center">
                            <p className="text-xs leading-5 text-slate-500">
                                Secured with signed HTTP-only sessions &middot; Google OAuth
                            </p>
                            <p className="mt-3 text-xs text-slate-600">
                                TrainVision-AI · Intelligent Railway Scheduling
                            </p>
                        </div>
                    </section>
                </div>
            </section>
        </main>
    );
}
