// frontend/src/lib/solana.ts
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { AnchorProvider, Program, BN, Idl } from '@coral-xyz/anchor';
import { useAnchorWallet } from '@solana/wallet-adapter-react';
import toast from 'react-hot-toast';
import idlJson from '../idl/predictlink.json'; // Generated via anchor idl fetch
import { Proposal, EventType } from './types';
import Arweave from 'arweave';

const PROGRAM_ID = new PublicKey(process.env.NEXT_PUBLIC_ORACLE_PROGRAM_ID!);
const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC!, 'confirmed');

const arweave = Arweave.init({ host: 'arweave.net', port: 443, protocol: 'https' });

export function getProvider(): AnchorProvider {
  const wallet = useAnchorWallet();
  if (!wallet) throw new Error('Wallet not connected');
  return new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
}

const program = (provider: AnchorProvider) => new Program(idlJson as Idl, PROGRAM_ID, provider);

export async function fetchProposals(): Promise<Proposal[]> {
  const provider = getProvider();
  const prog = program(provider);

  // Fetch oracle to get total
  const [oraclePda] = PublicKey.findProgramAddressSync([Buffer.from('oracle')], PROGRAM_ID);
  const oracle = await prog.account.oracle.fetch(oraclePda);

  const proposals: Proposal[] = [];
  // For MVP, fetch recent events and their proposals (limit to 50)
  const events = await fetchEvents();
  for (const event of events.slice(0, 50)) {
    try {
      const [proposalPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('proposal'), event.publicKey.toBuffer()],
        PROGRAM_ID
      );
      const proposalAccount = await prog.account.proposal.fetch(proposalPda);
      proposals.push({
        ...proposalAccount,
        pda: proposalPda.toBase58(),
        publicKey: proposalPda,
        livenessEnd: Number(proposalAccount.livenessEnd),
        submittedAt: Number(proposalAccount.submittedAt),
        bondedAmount: Number(proposalAccount.bondedAmount),
        id: Number(proposalAccount.id),
      });
    } catch (error) {
      // No proposal yet
    }
  }

  return proposals.filter(p => !p.resolved).sort((a, b) => b.submittedAt - a.submittedAt);
}

export async function fetchEvents(): Promise<EventType[]> {
  const provider = getProvider();
  const prog = program(provider);

  // Use getProgramAccounts with filters for 'event' seeds
  const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
    filters: [
      {
        dataSize: 8 + 8 + 4 + 256 + 1 + 32 + 8 + 32 + 1, // Approx space
      },
    ],
  });

  const events: EventType[] = [];
  for (const acc of accounts.slice(0, 100)) { // Limit
    try {
      const event = prog.coder.accounts.decode('Event', acc.account.data);
      if (event) {
        const [eventPda] = PublicKey.findProgramAddressSync(
          [Buffer.from('event'), /* oracle key */, Buffer.from(event.description || '')],
          PROGRAM_ID
        );
        events.push({
          ...event,
          publicKey: eventPda,
          id: Number(event.id),
          createdAt: Number(event.createdAt),
          resolutionType: Number(event.resolutionType),
        });
      }
    } catch {}
  }

  return events.sort((a, b) => b.createdAt - a.createdAt);
}

export async function createEvent(
  wallet: any,
  { description, resolutionType, marketAddress }: { description: string; resolutionType: number; marketAddress: string }
): Promise<void> {
  const provider = new AnchorProvider(connection, wallet, {});
  const prog = program(provider);

  const [oraclePda] = PublicKey.findProgramAddressSync([Buffer.from('oracle')], PROGRAM_ID);
  const market = marketAddress ? new PublicKey(marketAddress) : provider.systemProgram.programId; // Fallback

  const [eventPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('event'), oraclePda.toBuffer(), Buffer.from(description)],
    PROGRAM_ID
  );

  await prog.methods
    .createEvent(description, new BN(resolutionType))
    .accounts({
      oracle: oraclePda,
      event: eventPda,
      market,
      creator: wallet.publicKey,
      systemProgram: provider.systemProgram.programId,
    })
    .rpc();
}

export async function resolveProposal(
  wallet: any,
  proposalPda: string,
  finalOutcome: boolean
): Promise<void> {
  const provider = new AnchorProvider(connection, wallet, {});
  const prog = program(provider);

  const proposalPubkey = new PublicKey(proposalPda);
  const proposal = await prog.account.proposal.fetch(proposalPubkey);

  const [oraclePda] = PublicKey.findProgramAddressSync([Buffer.from('oracle')], PROGRAM_ID);

  await prog.methods
    .resolve(finalOutcome)
    .accounts({
      oracle: oraclePda,
      proposal: proposalPubkey,
      event: proposal.eventId,
      authority: wallet.publicKey,
    })
    .rpc({ commitment: 'confirmed' });
}

export async function disputeProposal(
  wallet: any,
  proposalPda: string,
  counterEvidenceHash: Uint8Array
): Promise<void> {
  const provider = new AnchorProvider(connection, wallet, {});
  const prog = program(provider);

  const proposalPubkey = new PublicKey(proposalPda);
  const proposal = await prog.account.proposal.fetch(proposalPubkey);

  const [oraclePda] = PublicKey.findProgramAddressSync([Buffer.from('oracle')], PROGRAM_ID);

  await prog.methods
    .dispute(Array.from(counterEvidenceHash))
    .accounts({
      oracle: oraclePda,
      proposal: proposalPubkey,
      event: proposal.eventId,
      disputer: wallet.publicKey,
      systemProgram: provider.systemProgram.programId,
    })
    .rpc({ commitment: 'confirmed' });
}

export async function viewEvidence(evidenceHash: Uint8Array): Promise<string> {
  try {
    const txId = bs58.encode(evidenceHash); // Assume direct
    const data = await arweave.transactions.getData(txId, { decode: true, string: true });
    return data as string;
  } catch (error) {
    throw new Error(`Evidence fetch failed: ${(error as Error).message}`);
  }
}

export async function uploadCounterEvidence(evidence: string): Promise<{ hash: Uint8Array }> {
  const tx = await arweave.createTransaction({ data: Buffer.from(evidence) }, await arweave.wallets.generateRandom());
  await arweave.transactions.sign(tx);
  await arweave.transactions.post(tx);
  const hash = new Uint8Array([...Array(32)].map(() => Math.floor(Math.random() * 256))); // Mock; real sha256(tx.id)
  return { hash };
}