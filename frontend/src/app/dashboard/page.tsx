// frontend/src/app/dashboard/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from 'react-query';
import { useAnchorWallet } from '@solana/wallet-adapter-react';
import axios from 'axios';
import { createEvent, fetchProposals, fetchEvents, resolveProposal, disputeProposal } from '@/lib/solana';
import { Proposal, EventType } from '@/lib/types';
import Header from '@/components/Header';
import ProposalCard from './components/ProposalCard';
import DisputeForm from './components/DisputeForm';
import MetricsTable from '@/components/MetricsTable';
import toast from 'react-hot-toast';
import CreateEventForm from './components/CreateEventForm';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export default function Dashboard() {
  const wallet = useAnchorWallet();
  const queryClient = useQueryClient();
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [showCreateEvent, setShowCreateEvent] = useState(false);

  const { data: proposals = [], isLoading: proposalsLoading, error: proposalsError, refetch: refetchProposals } = useQuery(
    ['proposals'],
    () => fetchProposals(),
    { refetchInterval: 30000, enabled: !!wallet }
  );

  const { data: events = [], isLoading: eventsLoading, error: eventsError, refetch: refetchEvents } = useQuery(
    ['events'],
    () => fetchEvents(),
    { enabled: !!wallet }
  );

  const resolveMutation = useMutation({
    mutationFn: ({ proposalPda, finalOutcome }: { proposalPda: string; finalOutcome: boolean }) =>
      resolveProposal(wallet!, proposalPda, finalOutcome),
    onSuccess: () => {
      toast.success('Proposal resolved!');
      refetchProposals();
    },
    onError: (error) => toast.error(`Resolve failed: ${error.message}`),
  });

  const disputeMutation = useMutation({
    mutationFn: ({ proposalPda, counterEvidenceHash }: { proposalPda: string; counterEvidenceHash: Uint8Array }) =>
      disputeProposal(wallet!, proposalPda, counterEvidenceHash),
    onSuccess: () => {
      toast.success('Dispute filed!');
      refetchProposals();
    },
    onError: (error) => toast.error(`Dispute failed: ${error.message}`),
  });

  useEffect(() => {
    if (wallet) {
      refetchProposals();
      refetchEvents();
    }
  }, [wallet, refetchProposals, refetchEvents]);

  const handleProposeViaBackend = async (eventId: string, description: string) => {
    if (!wallet) {
      toast.error('Connect wallet');
      return;
    }
    try {
      const res = await axios.post(`${BACKEND_URL}/propose`, { eventId, eventDescription: description });
      toast.success(`Proposal submitted: ${res.data.proposalPda}`);
      refetchProposals();
    } catch (error: any) {
      toast.error(`Propose failed: ${error.response?.data?.error || error.message}`);
    }
  };

  if (proposalsError || eventsError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Header />
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error Loading Data</h2>
          <p>{proposalsError?.message || eventsError?.message}</p>
          <button onClick={() => window.location.reload()} className="btn-primary mt-4 px-6 py-2">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="container mx-auto py-8 px-4">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <button onClick={() => setShowCreateEvent(!showCreateEvent)} className="btn-secondary px-6 py-2">
            {showCreateEvent ? 'Hide' : 'Create Event'}
          </button>
        </div>
        <MetricsTable />
        {showCreateEvent && (
          <div className="card mb-8">
            <CreateEventForm onSuccess={() => refetchEvents()} />
          </div>
        )}
        <div className="grid lg:grid-cols-2 gap-8">
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">Active Proposals ({proposals.length})</h2>
            {proposalsLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="skeleton h-20 w-full"></div>
                ))}
              </div>
            ) : (
              proposals.map((proposal) => (
                <ProposalCard
                  key={proposal.pda}
                  proposal={proposal}
                  onSelect={() => setSelectedProposal(proposal)}
                  onResolve={({ pda, outcome }) => resolveMutation.mutate({ proposalPda: pda, finalOutcome: outcome })}
                />
              ))
            )}
          </div>
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">Events ({events.length})</h2>
            {eventsLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="skeleton h-16 w-full"></div>
                ))}
              </div>
            ) : (
              events.map((event) => (
                <div key={event.id.toString()} className="mb-4 p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                  <p className="font-medium">{event.description}</p>
                  <p className="text-sm text-gray-500">Type: {event.resolutionType === 0 ? 'Binary' : 'Other'}</p>
                  <button
                    onClick={() => handleProposeViaBackend(event.id.toString(), event.description)}
                    disabled={!wallet || proposalsLoading}
                    className="btn-primary mt-2 px-4 py-1 text-sm disabled:opacity-50"
                  >
                    Propose Outcome
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
        {selectedProposal && (
          <div className="card mt-8 fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setSelectedProposal(null)}>
            <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <DisputeForm
                proposal={selectedProposal}
                onDispute={({ pda, counterEvidenceHash }) => disputeMutation.mutate({ proposalPda: pda, counterEvidenceHash })}
                onClose={() => setSelectedProposal(null)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}