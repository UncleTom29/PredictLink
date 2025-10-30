// frontend/src/components/WalletConnect.tsx
'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import toast from 'react-hot-toast';

export function ConnectWallet() {
  const { publicKey, connected } = useWallet();

  const handleClick = () => {
    if (connected) {
      toast('Wallet connected!');
    }
  };

  return (
    <div className="flex justify-center items-center space-x-4">
      <WalletMultiButton 
        className="!bg-primary-600 hover:!bg-primary-700 !text-white !rounded-lg !px-8 !py-3" 
        onClick={handleClick}
      />
      {connected && publicKey && (
        <span className="text-sm text-gray-600 hidden sm:inline">
          {publicKey.toBase58().slice(0, 4)}...{publicKey.toBase58().slice(-4)}
        </span>
      )}
    </div>
  );
}