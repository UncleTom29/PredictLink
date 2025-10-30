// backend/src/dispute-bot.ts
import { Connection, PublicKey } from '@solana/web3.js';
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import { proposeEvent } from './ai-proposer'; // Reuse AI for verification
import { uploadEvidence } from './evidence-handler';
import winston from 'winston';
import idl from '../../predictlink/target/idl/predictlink_oracle.json';

let isRunning = false;

export function monitorProposals(connection: Connection, program: Program, logger: winston.Logger): void {
  if (isRunning) return;
  isRunning = true;

  const interval = setInterval(async () => {
    try {
      // Fetch active proposals (query Solana accounts)
      const oraclePda = PublicKey.findProgramAddressSync([Buffer.from('oracle')], program.programId)[0];
      const oracle = await program.account.oracle.fetch(oraclePda);
      if (oracle.activeProposals === 0) return;

      const proposals = await fetchActiveProposals(program); // Implement RPC query

      for (const proposal of proposals) {
        const clock = await connection.getSlot(); // Approx timestamp
        if (Date.now() / 1000 > proposal.livenessEnd.toNumber()) continue; // Expired

        // AI Verify
        const eventDesc = 'Verify outcome for proposal'; // Fetch from event
        const aiResult = await proposeEvent(eventDesc);

        if (aiResult.outcome !== proposal.outcome && aiResult.confidence > 0.8) {
          // Dispute
          const counterEvidence = aiResult.evidenceSummary;
          const counterTxId = await uploadEvidence(counterEvidence, aiResult.sources);
          const hash = Buffer.from(sha256(JSON.stringify({ counterEvidence, counterTxId })), 'hex').slice(0, 32);

          await program.methods
            .dispute(Array.from(hash))
            .accounts({
              oracle: oraclePda,
              proposal: new PublicKey(proposal.pubkey),
              event: proposal.eventId,
              disputer: /* Bot wallet */,
              systemProgram: program.provider.systemProgram.programId
            })
            .rpc();

          logger.warn(`Dispute triggered for proposal ${proposal.pubkey.toString()}`, { confidence: aiResult.confidence });
        }
      }
    } catch (error) {
      logger.error('Dispute bot error', { error: (error as Error).message });
    }
  }, 300000); // Every 5 minutes

  logger.info('Dispute bot started');
}


async function fetchActiveProposals(program: Program): Promise<any[]> {
  return [];
}