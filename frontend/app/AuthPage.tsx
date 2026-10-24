
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { SignIn, SignUp } from '@clerk/nextjs';

type AuthMode = 'sign-in' | 'sign-up';

const clerkAppearance = {
    variables: {
        colorPrimary: '#3B82F6',
        colorBackground: '#0C1425',
        colorForeground: '#F1F5F9',
        colorMutedForeground: '#94A3B8',
        colorInputBackground: '#111C30',
        colorInputForeground: '#F1F5F9',
        borderRadius: '0.75rem',
        fontFamily: 'inherit',
    },
    elements: {
        rootBox: 'w-full',
        card: '!w-full !max-w-none !bg-transparent !shadow-none !p-0 !gap-4',
        header: 'hidden',
        socialButtonsBlockButton:
            '!flex !min-h-12 !w-full !items-center !justify-center !gap-3 !rounded-xl !border !border-slate-300/20 !bg-slate-100 !text-slate-900 !opacity-100 shadow-md transition hover:!bg-white',

        socialButtonsBlockButtonText:
            '!text-sm !font-semibold !text-slate-900',

        socialButtonsIconButton:
            '!border-slate-300/20 !bg-slate-100 !text-slate-900',

        dividerLine: '!bg-white/10',
        dividerText: '!text-slate-400',
        formFieldLabel: '!text-slate-300 !text-sm !font-medium',
        formFieldInput:
            '!rounded-xl !border-white/10 !bg-[#111C30] focus:!border-blue-500 focus:!ring-2 focus:!ring-blue-500/20',
        formButtonPrimary:
            '!rounded-xl !bg-blue-600 hover:!bg-blue-500 !shadow-lg !shadow-blue-950/40',
        footerAction: '!text-slate-400',
        footerActionLink:
            '!text-blue-400 hover:!text-blue-300',
        dividerLine: '!bg-white/10',
        dividerText: '!text-slate-500',
        identityPreview: '!border-white/10 !bg-white/5',
        formFieldAction:
            '!text-blue-400 hover:!text-blue-300',
        alert: '!rounded-xl',
    },
};

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
            'Optimize timetables with scheduling algorithms.',
    },
    {
        icon: '◎',
        title: 'Real-time monitoring',
        description:
            'Track stations, schedules, and operational conflicts.',
    },
    {
        icon: '↗',
        title: 'Actionable insights',
        description:
            'Make better decisions with clear operational views.',
    },
];

export default function AuthPage() {
    const [mode, setMode] = useState<AuthMode>('sign-in');

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
                <Link
                    href="/"
                    className="group flex items-center gap-3"
                >
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-blue-400/30 bg-blue-500/10 text-2xl shadow-lg shadow-blue-950/30 transition group-hover:bg-blue-500/20">
                        🚆
                    </div>

                    <div>
                        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
                            TrainVision
                            <span className="text-blue-400">-AI</span>
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
                                Optimize train timetables, identify
                                conflicts, and monitor railway
                                operations through one intelligent
                                scheduling platform.
                            </p>
                        </div>

                        {/* Railway visualization */}
                        <div className="relative my-8 overflow-hidden rounded-2xl border border-blue-400/15 bg-[#081224]/80 p-5">
                            <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-blue-500/10 blur-3xl" />

                            <div className="relative flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-xs text-slate-500">
                                        SCHEDULING ENGINE
                                    </p>
                                    <p className="mt-1 text-lg font-semibold">
                                        Network overview
                                    </p>
                                </div>

                                <span className="whitespace-nowrap rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-xs text-emerald-300">
                                    <span className="mr-1">●</span>
                                    Operational
                                </span>
                            </div>

                            <div className="relative mt-7 space-y-5">
                                {stations.map((station, index) => (
                                    <div
                                        key={station.code}
                                        className="flex items-center gap-3"
                                    >
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
                                                    style={{
                                                        width: station.width,
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <p className="mt-6 text-[11px] text-slate-500">
                                Illustrative network visualization
                            </p>
                        </div>

                        {/* Features */}
                        <div className="relative space-y-5">
                            {features.map((feature) => (
                                <div
                                    key={feature.title}
                                    className="flex gap-4"
                                >
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
                            Built for a smarter, more connected
                            railway network.
                        </div>
                    </aside>

                    {/* Right panel: Authentication */}
                    <section className="flex min-w-0 flex-col justify-center px-5 py-9 sm:px-10 sm:py-12 lg:px-10 xl:px-14">
                        {/* Mobile branding */}
                        <div className="mb-8 text-center lg:hidden">
                            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-400/20 bg-blue-500/10 text-3xl">
                                🚆
                            </div>

                            <h2 className="text-2xl font-bold">
                                TrainVision
                                <span className="text-blue-400">-AI</span>
                            </h2>

                            <p className="mt-2 text-sm text-slate-400">
                                Intelligent railway scheduling
                            </p>
                        </div>

                        <div className="mb-7">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">
                                Your workspace
                            </p>

                            <h2 className="mt-3 text-3xl font-bold tracking-tight">
                                {mode === 'sign-in'
                                    ? 'Welcome back'
                                    : 'Create your account'}
                            </h2>

                            <p className="mt-3 text-sm leading-6 text-slate-400">
                                {mode === 'sign-in'
                                    ? 'Sign in to access your railway scheduling dashboard.'
                                    : 'Get started with intelligent railway operations.'}
                            </p>
                        </div>

                        {/* Sign-in / sign-up selector */}
                        <div className="mb-7 grid grid-cols-2 rounded-xl border border-white/8 bg-white/3 p-1">
                            <button
                                type="button"
                                onClick={() => setMode('sign-in')}
                                aria-pressed={mode === 'sign-in'}
                                className={`rounded-lg px-4 py-3 text-sm font-semibold transition-all duration-200 ${mode === 'sign-in'
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-950/40'
                                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                                    }`}
                            >
                                Sign in
                            </button>

                            <button
                                type="button"
                                onClick={() => setMode('sign-up')}
                                aria-pressed={mode === 'sign-up'}
                                className={`rounded-lg px-4 py-3 text-sm font-semibold transition-all duration-200 ${mode === 'sign-up'
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-950/40'
                                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                                    }`}
                            >
                                Create account
                            </button>
                        </div>

                        {/* Clerk authentication */}
                        <div className="auth-clerk w-full">
                            {mode === 'sign-in' ? (
                                <SignIn
                                    key="sign-in"
                                    routing="hash"
                                    forceRedirectUrl="/home"
                                    signUpUrl="/?mode=sign-up"
                                    appearance={clerkAppearance}
                                />
                            ) : (
                                <SignUp
                                    key="sign-up"
                                    routing="hash"
                                    forceRedirectUrl="/home"
                                    signInUrl="/"
                                    appearance={clerkAppearance}
                                />
                            )}
                        </div>

                        {/* Footer */}
                        <div className="mt-8 border-t border-white/8 pt-5 text-center">
                            <p className="text-xs leading-5 text-slate-500">
                                By continuing, you agree to use
                                TrainVision-AI responsibly and securely.
                            </p>

                            <p className="mt-4 text-xs text-slate-600">
                                TrainVision-AI · Intelligent Railway Scheduling
                            </p>
                        </div>
                    </section>
                </div>
            </section>
        </main>
    );
}
