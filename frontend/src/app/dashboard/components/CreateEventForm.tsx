// frontend/src/app/dashboard/components/CreateEventForm.tsx
'use client';

import { useState } from 'react';
import { useMutation } from 'react-query';
import { useAnchorWallet } from '@solana/wallet-adapter-react';
import { createEvent } from '@/lib/solana';
import toast from 'react-hot-toast';

interface CreateEventFormProps {
  onSuccess: () => void;
}

export default function CreateEventForm({ onSuccess }: CreateEventFormProps) {
  const wallet = useAnchorWallet();
  const [description, setDescription] = useState('');
  const [resolutionType, setResolutionType] = useState(0);
  const [marketAddress, setMarketAddress] = useState('');

  const mutation = useMutation({
    mutationFn: () => createEvent(wallet!, { description, resolutionType, marketAddress }),
    onSuccess: onSuccess,
    onError: (error) => toast.error(`Creation failed: ${error.message}`),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return toast.error('Description required');
    mutation.mutate();
  };

  if (!wallet) return <p className="text-center text-gray-500">Connect wallet to create events</p>;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Event description (e.g., Will SOL > $200?)"
        className="w-full p-3 border rounded-lg"
        required
      />
      <select
        value={resolutionType}
        onChange={(e) => setResolutionType(Number(e.target.value))}
        className="w-full p-3 border rounded-lg"
      >
        <option value={0}>Binary</option>
      </select>
      <input
        type="text"
        value={marketAddress}
        onChange={(e) => setMarketAddress(e.target.value)}
        placeholder="Market address (optional)"
        className="w-full p-3 border rounded-lg"
      />
      <button type="submit" disabled={mutation.isLoading} className="btn-primary w-full py-3">
        {mutation.isLoading ? 'Creating...' : 'Create Event'}
      </button>
    </form>
  );
}