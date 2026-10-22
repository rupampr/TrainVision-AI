
'use client';

import { useState } from 'react';
import { SignIn, SignUp } from '@clerk/nextjs';

export default function AuthPage() {
    const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');

    return (
        <main className="min-h-screen flex flex-col items-center justify-center gap-6 bg-gray-950 text-white p-6">
            <div className="text-center">
                <h1 className="text-3xl font-bold">TrainVision-AI</h1>
                <p className="mt-2 text-gray-400">
                    Intelligent Railway scheduling
                </p>
            </div>

            <div className="flex gap-3">
                <button
                    onClick={() => setMode('sign-in')}
                    className={`rounded-lg px-5 py-2 ${mode === 'sign-in'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-800 text-gray-300'
                        }`}
                >
                    Sign In
                </button>

                <button
                    onClick={() => setMode('sign-up')}
                    className={`rounded-lg px-5 py-2 ${mode === 'sign-up'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-800 text-gray-300'
                        }`}
                >
                    Sign Up
                </button>
            </div>

            {mode === 'sign-in' ? (
                <SignIn
                    routing="hash"
                    forceRedirectUrl="/home"
                    signUpUrl="/?mode=sign-up"
                />
            ) : (
                <SignUp
                    routing="hash"
                    forceRedirectUrl="/home"
                    signInUrl="/"
                />
            )}
        </main>
    );
}
