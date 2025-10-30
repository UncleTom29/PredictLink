// backend/src/index.ts
import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import winston from 'winston';
import { proposeEvent } from './ai-proposer';
import { uploadEvidence } from './evidence-handler';
import { monitorProposals } from './dispute-bot';
import { Connection, PublicKey } from '@solana/web3.js';
import { AnchorProvider, Program, Idl } from '@coral-xyz/anchor';
import idl from '../../predictlink/target/idl/predictlink_oracle.json'; 

// Load env
dotenv.config();

// Logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({ format: winston.format.simple() }),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Solana Setup
const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com');
const walletKeypair = /* Load from private key */; // Implement secure loading
const provider = new AnchorProvider(connection, walletKeypair, {});
const program = new Program(idl as Idl, new PublicKey(process.env.ORACLE_PROGRAM_ID!), provider);

// Rate Limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false
});

// App Setup
const app: Application = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : '*' }));
app.use(morgan('combined', { stream: { write: msg => logger.info(msg.trim()) } }));
app.use(limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get('/health', (req: Res, res: Response) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// API Routes
app.post('/propose', async (req: Request, res: Response) => {
  try {
    const { eventDescription, eventId } = req.body;
    if (!eventDescription || !eventId) {
      return res.status(400).json({ error: 'Missing eventDescription or eventId' });
    }

    // AI Propose
    const aiResult = await proposeEvent(eventDescription);
    if (aiResult.confidence < 0.8) {
      return res.status(200).json({ ...aiResult, status: 'flagged_for_human' });
    }

    // Upload Evidence
    const evidenceTxId = await uploadEvidence(aiResult.evidenceSummary, aiResult.sources);

    // Compute hash
    const hash = Buffer.from(require('js-sha256').sha256(JSON.stringify({ ...aiResult, evidenceTxId })), 'hex').slice(0, 32);

    // Submit to Solana
    const eventPDA = PublicKey.findProgramAddressSync([Buffer.from('event'), program.programId.toBuffer(), Buffer.from(eventId)], program.programId)[0];
    const proposalPDA = PublicKey.findProgramAddressSync([Buffer.from('proposal'), eventPDA.toBuffer()], program.programId)[0];

    await program.methods
      .propose(aiResult.outcome, Array.from(hash))
      .accounts({
        oracle: /* Oracle PDA */,
        proposal: proposalPDA,
        event: eventPDA,
        proposer: walletKeypair.publicKey,
        systemProgram: provider.systemProgram.programId
      })
      .rpc();

    logger.info(`Proposal submitted for event ${eventId}`, { proposal: proposalPDA.toString(), confidence: aiResult.confidence });
    res.json({ ...aiResult, proposalPda: proposalPDA.toString(), evidenceTxId });
  } catch (error) {
    logger.error('Propose error', { error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/dispute', async (req: Request, res: Response) => {
  try {
    const { proposalPda, counterEvidence } = req.body;
    if (!proposalPda || !counterEvidence) {
      return res.status(400).json({ error: 'Missing proposalPda or counterEvidence' });
    }

    // Upload counter evidence
    const counterTxId = await uploadEvidence(counterEvidence, []);

    // Compute hash
    const hash = Buffer.from(require('js-sha256').sha256(JSON.stringify({ counterEvidence, counterTxId })), 'hex').slice(0, 32);

    // Dispute on Solana
    const proposal = /* Fetch proposal account */;
    await program.methods
      .dispute(Array.from(hash))
      .accounts({
        oracle: /* Oracle PDA */,
        proposal: new PublicKey(proposalPda),
        event: proposal.eventId,
        disputer: walletKeypair.publicKey,
        systemProgram: provider.systemProgram.programId
      })
      .rpc();

    logger.info(`Dispute filed for proposal ${proposalPda}`);
    res.json({ status: 'disputed', disputeTxId: /* tx signature */, counterTxId });
  } catch (error) {
    logger.error('Dispute error', { error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/resolve', async (req: Request, res: Response) => {
  try {
    const { proposalPda, finalOutcome } = req.body;
    if (!proposalPda || typeof finalOutcome !== 'boolean') {
      return res.status(400).json({ error: 'Missing proposalPda or finalOutcome' });
    }

    // Resolve on Solana
    const proposal = /* Fetch proposal account */;
    await program.methods
      .resolve(finalOutcome)
      .accounts({
        oracle: /* Oracle PDA */,
        proposal: new PublicKey(proposalPda),
        event: proposal.eventId,
        authority: walletKeypair.publicKey
      })
      .rpc();

    logger.info(`Proposal ${proposalPda} resolved to ${finalOutcome}`);
    res.json({ status: 'resolved' });
  } catch (error) {
    logger.error('Resolve error', { error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start Dispute Bot (runs in background)
monitorProposals(connection, program, logger);

// Error Handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Global error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

// 404 Handler
app.use('*', (req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start Server
app.listen(PORT, () => {
  logger.info(`PredictLink Backend running on port ${PORT}`);
});