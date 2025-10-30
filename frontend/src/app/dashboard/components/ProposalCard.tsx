// frontend/src/app/dashboard/components/ProposalCard.tsx
'use client';

import { Proposal } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { viewEvidence } from '@/lib/solana';

interface ProposalCardProps {
  proposal: Proposal;
  onSelect: () => void;
  onResolve: (data: { pda: string; outcome: boolean }) => void;
}

export default function ProposalCard({ proposal, onSelect, onResolve }: ProposalCardProps) {
  const [loading, setLoading] = useState(false);
  const isLivenessActive = Date.now() / 1000 < Number(proposal.livenessEnd);
  const timeLeft = formatDistanceToNow(new Date(Number(proposal.livenessEnd) * 1000), { addSuffix: true });

  const handleViewEvidence = async () => {
    setLoading(true);
    try {
      const data = await viewEvidence(proposal.evidenceHash);
      toast.success('Evidence loaded');
      // In prod, open modal with data
      console.log('Evidence:', data); // Replace with modal
    } catch (error) {
      toast.error('Failed to load evidence');
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = (outcome: boolean) => {
    onResolve({ pda: proposal.pda, outcome });
  };

  return (
    <div className="border rounded-lg p-4 mb-4 hover:shadow-md transition-all duration-200">
      <h3 className="font-semibold text-lg mb-1">Proposal #{proposal.id}</h3>
      <p className="text-sm text-gray-600 mb-1">Outcome: <span className={`font-medium ${proposal.outcome ? 'text-green-600' : 'text-red-600'}`}>{proposal.outcome ? 'Yes' : 'No'}</span></p>
      <p className="text-sm mb-1">Proposer: {proposal.proposer.toBase58().slice(0, 8)}...</p>
      <p className="text-sm text-gray-500 mb-2">
        Status: <span className={`capitalize ${proposal.resolved ? 'text-green-600' : proposal.disputed ? 'text-yellow-600' : 'text-blue-600'}`}>
          {proposal.resolved ? 'Resolved' : proposal.disputed ? 'Disputed' : 'Pending'}
        </span>
      </p>
      <p className="text-xs text-gray-400 mb-3">
        Liveness: {isLivenessActive ? `${timeLeft}` : 'Expired'} | Bond: {proposal.bondedAmount / 1e9} SOL
      </p>
      <div className="flex flex-wrap gap-2">
        <button 
          onClick={handleViewEvidence} 
          disabled={loading}
          className="text-blue-500 text-sm underline hover:no-underline disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'View Evidence'}
        </button>
        <button 
          onClick={onSelect} 
          className="text-purple-500 text-sm underline hover:no-underline"
        >
          Dispute
        </button>
        {!proposal.resolved && !proposal.disputed && !isLivenessActive && (
          <div className="flex gap-2">
            <button onClick={() => handleResolve(true)} className="text-green-500 text-sm underline hover:no-underline">
              Resolve Yes
            </button>
            <button onClick={() => handleResolve(false)} className="text-red-500 text-sm underline hover:no-underline">
              Resolve No
            </button>
          </div>
        )}
      </div>
    </div>
  );
}