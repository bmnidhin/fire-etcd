'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { Transition } from '@headlessui/react';
import { Fragment } from 'react';

export default function SetupPage() {
  const router = useRouter();
  const [setupConfig, setSetupConfig] = useState<{
    caExists?: boolean;
    clientCertExists?: boolean;
    clientKeyExists?: boolean;
    host?: string;
  } | null>(null);
  const [setupRunning, setSetupRunning] = useState(false);
  const [setupLogs, setSetupLogs] = useState('');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    checkSetupConfig();
  }, []);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const checkSetupConfig = async () => {
    try {
      const res = await fetch('/api/setup');
      const data = await res.json();
      setSetupConfig(data);
      if (data.caExists && data.clientCertExists && data.clientKeyExists) {
        router.push('/');
      }
    } catch {
      // ignore
    }
  };

  const runSetup = async () => {
    setSetupRunning(true);
    setSetupLogs('Starting setup script...\n');
    try {
      const res = await fetch('/api/setup', { method: 'POST' });
      const data = await res.json();
      setSetupLogs((prev) => prev + (data.stdout || '') + '\n' + (data.stderr || ''));
      if (data.success) {
        showToast('Setup completed successfully!', 'success');
        setTimeout(() => router.push('/'), 2000);
      } else {
        showToast('Setup failed.', 'error');
      }
    } catch (e: unknown) {
      setSetupLogs((prev) => prev + `\nError: ${e instanceof Error ? e.message : String(e)}`);
      showToast('Setup failed to execute.', 'error');
    }
    setSetupRunning(false);
    checkSetupConfig();
  };

  return (
    <div className="flex items-center justify-center min-h-dvh w-screen bg-[#1e1e1e] text-gray-200">
      <div className="bg-[#252526] border border-white/10 rounded-2xl p-10 max-w-[650px] w-full shadow-2xl">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold bg-violet-600 text-white bg-clip-text text-transparent mb-3">
            Welcome to fireETCD setup
          </h2>
          <p className="text-gray-400 text-lg">Your current workspace needs to be configured to connect to the kind cluster.</p>
        </div>

        <div className="bg-black/30 rounded-lg p-6 mb-6 border border-white/10">
          <h3 className="text-lg mb-4 text-gray-200">Current Configuration Status:</h3>
          {setupConfig ? (
            <ul className="list-none p-0 space-y-3">
              <li className="flex items-center gap-2 text-[0.95rem] text-gray-400">
                {setupConfig.caExists ? (
                  <CheckCircleIcon className="w-5 h-5 text-green-500 shrink-0" strokeWidth={1.5} />
                ) : (
                  <XCircleIcon className="w-5 h-5 text-red-500 shrink-0" strokeWidth={1.5} />
                )}
                CA Certificate: {setupConfig.caExists ? 'Found' : 'Missing'}
              </li>
              <li className="flex items-center gap-2 text-[0.95rem] text-gray-400">
                {setupConfig.clientCertExists ? (
                  <CheckCircleIcon className="w-5 h-5 text-green-500 shrink-0" strokeWidth={1.5} />
                ) : (
                  <XCircleIcon className="w-5 h-5 text-red-500 shrink-0" strokeWidth={1.5} />
                )}
                Client Certificate: {setupConfig.clientCertExists ? 'Found' : 'Missing'}
              </li>
              <li className="flex items-center gap-2 text-[0.95rem] text-gray-400">
                {setupConfig.clientKeyExists ? (
                  <CheckCircleIcon className="w-5 h-5 text-green-500 shrink-0" strokeWidth={1.5} />
                ) : (
                  <XCircleIcon className="w-5 h-5 text-red-500 shrink-0" strokeWidth={1.5} />
                )}
                Client Key: {setupConfig.clientKeyExists ? 'Found' : 'Missing'}
              </li>
              <li className="flex items-center gap-2 text-[0.95rem] text-gray-400">
                <span className="w-5 shrink-0" />
                Target Host: <code className="font-mono">{setupConfig.host}</code>
              </li>
            </ul>
          ) : (
            <p className="text-gray-400 flex items-center gap-2">
              <ArrowPathIcon className="w-5 h-5 animate-spin shrink-0" strokeWidth={1.5} />
              Loading config...
            </p>
          )}
        </div>

        <div className="flex justify-center">
          <button
            type="button"
            className="w-full py-4 px-4 text-lg font-semibold rounded-md bg-violet-600 text-white text-gray-900 inline-flex items-center justify-center gap-2 disabled:opacity-50"
            onClick={runSetup}
            disabled={setupRunning}
          >
            {setupRunning ? (
              <>
                <ArrowPathIcon className="w-5 h-5 animate-spin shrink-0" strokeWidth={1.5} />
                Running Setup...
              </>
            ) : (
              'Auto-Configure & Run Setup Script'
            )}
          </button>
        </div>

        {setupLogs && (
          <div className="mt-6 bg-black rounded-lg p-4 max-h-[200px] overflow-y-auto border border-white/10">
            <pre className="font-mono text-sm text-green-400 whitespace-pre-wrap">{setupLogs}</pre>
          </div>
        )}
      </div>

      {/* Toast - Headless UI Transition */}
      <Transition show={!!toast} as={Fragment}>
        <div className="fixed bottom-6 right-6 z-[1000]">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="translate-y-6 opacity-0"
            enterTo="translate-y-0 opacity-100"
            leave="ease-in duration-200"
            leaveFrom="translate-y-0 opacity-100"
            leaveTo="translate-y-6 opacity-0"
          >
            <div
              className={`flex items-center gap-3 px-6 py-4 rounded-lg border bg-[#252526] shadow-xl ${
                toast?.type === 'success' ? 'border-green-500' : 'border-red-500'
              }`}
            >
              {toast?.type === 'success' ? (
                <CheckCircleIcon className="w-5 h-5 text-green-500 shrink-0" strokeWidth={1.5} />
              ) : (
                <ExclamationTriangleIcon className="w-5 h-5 text-red-500 shrink-0" strokeWidth={1.5} />
              )}
              <span className="text-gray-200">{toast?.msg}</span>
            </div>
          </Transition.Child>
        </div>
      </Transition>
    </div>
  );
}
