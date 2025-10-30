// frontend/src/app/events/page.tsx
'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from 'react-query';
import { useAnchorWallet } from '@solana/wallet-adapter-react';
import { createEvent } from '@/lib/solana';
import { EventType } from '@/lib/types';
import Header from '@/components/Header';
import toast from 'react-hot-toast';

export default function Events() {
  const wallet = useAnchorWallet();
  const queryClient = useQueryClient();
  const [description, setDescription] = useState('');
  const [resolutionType, setResolutionType] = useState(0); // 0: binary
  const [marketAddress, setMarketAddress] = useState('');

  const createMutation = useMutation({
    mutationFn: (data: { description: string; resolutionType: number; marketAddress: string }) =>
      createEvent(wallet!, data),
    onSuccess: () => {
      toast.success('Event created successfully!');
      setDescription('');
      setMarketAddress('');
      queryClient.invalidateQueries('events');
    },
    onError: (error) => {
      toast.error(`Failed to create event: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet) {
      toast.error('Connect wallet first');
      return;
    }
    if (!description.trim()) {
      toast.error('Description required');
      return;
    }
    createMutation.mutate({ description, resolutionType, marketAddress });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="container mx-auto py-12 px-4">
        <h1 className="text-3xl font-bold mb-8">Create New Event</h1>
        <form onSubmit={handleSubmit} className="card max-w-md mx-auto">
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Event Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Will SOL > $200 by EOY?"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Resolution Type</label>
            <select
              value={resolutionType}
              onChange={(e) => setResolutionType(Number(e.target.value))}
              className="w-full p-3 border border-gray-300 rounded-lg"
            >
              <option value={0}>Binary (Yes/No)</option>
              {/* Expand for multi/numeric in future */}
            </select>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Market Address (Optional)</label>
            <input
              type="text"
              value={marketAddress}
              onChange={(e) => setMarketAddress(e.target.value)}
              placeholder="Base58 market PDA"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <button
            type="submit"
            disabled={createMutation.isLoading}
            className="w-full btn-primary py-3"
          >
            {createMutation.isLoading ? 'Creating...' : 'Create Event'}
          </button>
        </form>
      </div>
    </div>
  );
}