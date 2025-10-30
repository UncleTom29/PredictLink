// frontend/src/app/dashboard/components/DisputeForm.tsx
'use client';

import { useState } from 'react';
import { Proposal } from '@/lib/types';
import toast from 'react-hot-toast';
import { uploadCounterEvidence } from '@/lib/solana'; 

interface DisputeFormProps {
  proposal: Proposal;
  onDispute: (data: { pda: string; counterEvidenceHash: Uint8Array }) => void;
  onClose: () => void;
}

export default function DisputeForm({ proposal, onDispute, onClose }: DisputeFormProps) {
  const [counterEvidence, setCounterEvidence] = useState('');
  const [uploading, setUploading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!counterEvidence.trim()) {
      toast.error('Counter evidence required');
      return;
    }
    setUploading(true);
    try {
      const { hash } = await uploadCounterEvidence(counterEvidence);
      onDispute({ pda: proposal.pda, counterEvidenceHash: hash });
      toast.success('Counter evidence uploaded and dispute prepared');
    } catch (error) {
      toast.error(`Upload failed: ${(error as Error).message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Dispute Proposal #{proposal.id}</h3>
      <button onClick={onClose} className="mb-4 text-gray-500 hover:text-gray-700">× Close</button>
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Counter Evidence</label>
          <textarea
            value={counterEvidence}
            onChange={(e) => setCounterEvidence(e.target.value)}
            placeholder="Provide sources, links, or description contradicting the proposal..."
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 min-h-[100px]"
            required
          />
        </div>
        <button 
          type="submit" 
          disabled={uploading}
          className="btn-primary px-6 py-3 disabled:opacity-50 w-full"
        >
          {uploading ? 'Uploading...' : 'File Dispute'}
        </button>
      </form>
    </div>
  );
}