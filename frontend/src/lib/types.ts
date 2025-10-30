// frontend/src/lib/types.ts
import { PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';

export interface Proposal {
  id: BN;
  eventId: PublicKey;
  proposer: PublicKey;
  outcome: boolean;
  evidenceHash: Uint8Array;
  submittedAt: BN;
  livenessEnd: BN;
  bondedAmount: BN;
  resolved: boolean;
  disputed: boolean;
  disputeBond: BN;
  disputer?: PublicKey;
  disputeEvidenceHash: Uint8Array;
  resolver?: PublicKey;
  pda: string;
  publicKey: PublicKey;
}

export interface EventType {
  id: BN;
  description: string;
  resolutionType: number;
  marketAddress: PublicKey;
  createdAt: BN;
  creator: PublicKey;
  publicKey: PublicKey;
}