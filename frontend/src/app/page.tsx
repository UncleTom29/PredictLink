// frontend/src/app/page.tsx
'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import MetricsTable from '@/components/MetricsTable';
import Header from '@/components/Header';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function Home() {
  const { publicKey, connected } = useWallet();

  const handleConnect = () => {
    if (connected) {
      toast.success('Wallet connected!');
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <Header />
      <div className="container mx-auto py-12 px-4">
        <div className="text-center mb-12 animate-fade-in">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            PredictLink Oracle
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Fast, AI-Assisted Hybrid Oracle for Prediction Markets & RWA Data on Solana
          </p>
          <div className="flex flex-col sm:flex-row justify-center items-center space-y-4 sm:space-y-0 sm:space-x-4">
            <Link href="/dashboard" className="btn-primary px-8 py-4 text-lg inline-block">
              Launch Dashboard
            </Link>
            <WalletMultiButton 
              className="!bg-primary-600 hover:!bg-primary-700 !text-white !px-8 !py-4 !rounded-lg !font-semibold" 
              onClick={handleConnect}
            />
          </div>
        </div>
        <MetricsTable />
        {connected && (
          <div className="mt-8 text-center animate-pulse">
            <p className="text-sm text-green-600 font-medium">
              🔗 Connected: {publicKey?.toBase58().slice(0, 4)}...{publicKey?.toBase58().slice(-4)}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}