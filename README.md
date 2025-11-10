# PredictLink
PredictLink is a domain-specific hybrid oracle designed for prediction markets, real-world asset (RWA) data feeds, and event-driven DeFi protocols on Solana. 

Devnet Deployment: https://explorer.solana.com/address/2JaiFHTyNdkRmGrGEAagDUDYBVyA1LkL3v12eG2pF5Yn?cluster=devnet

# PredictLink Oracle API Documentation

This document outlines the RESTful API endpoints for the PredictLink Oracle backend. The API is built with Express.js and integrates with Solana (via Anchor), OpenAI (for AI proposing), and Arweave (for evidence storage). All endpoints are secured with rate limiting, CORS, and input validation (via Joi).

## Base URL
- **Development**: `http://localhost:3001`
- **Production**: `https://api.solana.predictlink.online` 

## Authentication
- **Wallet-Based**: Solana wallet signatures for on-chain actions (propose/dispute/resolve). Use `@solana/web3.js` for signing.
- **API Keys**: Premium endpoints (e.g., RWA feeds) require `X-API-Key` header.
- **CORS**: Allowed origins: `http://localhost:3000`, `https://solana.predictlink.oracle`.

## Error Handling
- All errors return JSON: `{ "error": "message", "code": "ERR_CODE" }`.
- HTTP Status: 400 (Bad Request), 401 (Unauthorized), 429 (Rate Limit), 500 (Server Error).
- Logging: All requests/responses logged via Winston (JSON format).

## Endpoints

### Health Check
- **GET** `/health`
- **Description**: Returns server status and basic metrics.
- **Query Params**: None.
- **Response**:
  ```json
  {
    "status": "OK",
    "timestamp": "2025-10-30T12:00:00Z",
    "uptime": "99.9%",
    "activeProposals": 42,
    "version": "0.1.0"
  }
  ```
- **Rate Limit**: 60/min.

### Propose Outcome
- **POST** `/propose`
- **Description**: Triggers AI-assisted proposal submission. Aggregates evidence via LLM, uploads to Arweave, computes hash, and submits to Solana program.
- **Headers**: `Content-Type: application/json`
- **Body** (Validated with Joi):
  ```json
  {
    "eventId": "base58_event_pda",
    "eventDescription": "Will SOL > $200 by EOY 2025?",
    "outcome": true  
  }
  ```
- **Response** (200 OK):
  ```json
  {
    "confidence": 0.95,
    "outcome": true,
    "summary": "Strong evidence from CoinGecko and Reuters",
    "sources": ["CoinGecko", "Reuters"],
    "evidenceTxId": "arweave_tx_id",
    "proposalPda": "base58_proposal_pda",
    "txSignature": "base58_solana_tx"
  }
  ```
- **Errors**:
  - 400: Invalid input.
  - 401: Wallet not connected (for on-chain submit).
  - 500: AI or Solana RPC failure.
- **Rate Limit**: 10/min per IP.

### Dispute Proposal
- **POST** `/dispute`
- **Description**: Uploads counter-evidence to Arweave and submits dispute to Solana. Triggers autonomous bot verification.
- **Headers**: `Content-Type: application/json`
- **Body**:
  ```json
  {
    "proposalPda": "base58_proposal_pda",
    "counterEvidence": "Detailed contradiction with sources: e.g., SOL at $150 per CoinMarketCap",
    "sources": ["CoinMarketCap"]  
  }
  ```
- **Response** (200 OK):
  ```json
  {
    "status": "disputed",
    "counterTxId": "arweave_tx_id",
    "disputeTxSignature": "base58_solana_tx",
    "livenessRemaining": 3600  
  }
  ```
- **Errors**:
  - 400: Liveness expired or invalid PDA.
  - 409: Already disputed.
- **Rate Limit**: 5/min per IP.

### Resolve Proposal
- **POST** `/resolve`
- **Description**: Submits resolution to Solana (authority only for disputed; auto for uncontested post-liveness).
- **Headers**: `Content-Type: application/json`
- **Body**:
  ```json
  {
    "proposalPda": "base58_proposal_pda",
    "finalOutcome": true
  }
  ```
- **Response** (200 OK):
  ```json
  {
    "status": "resolved",
    "txSignature": "base58_solana_tx",
    "payouts": { "winners": "amount", "losers": "slashed" }  
  }
  ```
- **Errors**:
  - 403: Unauthorized (not authority).
  - 409: Already resolved.
- **Rate Limit**: 20/min per wallet.

### Get Proposal Details
- **GET** `/proposal/:pda`
- **Description**: Fetches proposal state from Solana + off-chain evidence.
- **Path Params**: `pda` (base58).
- **Query Params**: `includeEvidence=true` (default: false).
- **Response**:
  ```json
  {
    "proposal": { },
    "evidence": "Arweave JSON bundle"  
  }
  ```
- **Rate Limit**: 100/min.

### Get Events
- **GET** `/events`
- **Description**: Lists active events from Solana.
- **Query Params**:
  - `limit=50` (default: 20).
  - `type=0` (binary only).
- **Response**:
  ```json
  {
    "events": [ ],
    "total": 150
  }
  ```
- **Rate Limit**: 50/min.

### RWA Feeds 
- **GET** `/rwa/:asset`
- **Description**: Fetches time-series data (e.g., Treasury yields).
- **Path Params**: `asset` (e.g., "treasury-10y").
- **Query Params**: `from=2025-01-01&to=2025-10-30`.
- **Response**: JSON array of { timestamp, value }.
- **Auth**: API Key required.
- **Rate Limit**: 1000/day.

## WebSocket (Real-Time)
- **wss://api.solana.predictlink.oracle/ws** .
- **Events**:
  - `proposal_updated`: { pda, status }.
  - `dispute_detected`: { proposalPda, botId }.

## Validation Schema (Internal)
All bodies validated with Joi schemas:
- Propose: `Joi.object({ eventId: Joi.string().base58(), eventDescription: Joi.string().max(256) })`.

## Security
- **Input Sanitization**: Joi + DOMPurify for evidence.
- **Rate Limiting**: express-rate-limit (100/min default).
- **HTTPS**: Enforced in prod.
- **Secrets**: Env vars only (no hardcoding).

## OpenAPI Spec
See `/openapi.json` endpoint (generated via swagger-jsdoc).

For SDKs, see [Solana SDK](integrations/solana-sdk.md).


# PredictLink Oracle Architecture

PredictLink is a hybrid oracle system combining optimistic mechanisms, AI assistance, and decentralized incentives on Solana. Below is an overview of the five-pillar architecture, followed by a Mermaid diagram.

## Core Components

### 1. Event-Resolution Engine
- **Purpose**: Handles optimistic submissions for event outcomes.
- **Tech**: Anchor/Rust on Solana (PDA seeds: `proposal`, `event`).
- **Flow**: Submit → Liveness (2h) → Auto-resolve or dispute → Authority/DAO finality.
- **Metrics**: Sub-2h finality for 95% uncontested.

### 2. AI-Assisted Proposing
- **Purpose**: Automates evidence aggregation and confidence scoring.
- **Tech**: LangChain + OpenAI GPT-4o-mini; Sources: NewsAPI, CoinGecko, official APIs.
- **Flow**: Event trigger → LLM prompt → JSON output (confidence >0.8 → auto-submit).
- **Output**: `{ confidence: 0.95, outcome: true, sources: [...], summary: "..." }`.

### 3. Autonomous Dispute Network
- **Purpose**: 24/7 monitoring for inconsistencies.
- **Tech**: Node.js bots (5-10 initial); Incentive: 30% fee share.
- **Flow**: Poll proposals → AI re-verify → Dispute if delta >0.2 confidence.
- **Scalability**: Shared infra across 50k+ markets.

### 4. Hybrid Oracle Controller
- **Purpose**: Routes subjective/objective data.
- **Tech**: Dynamic routing (if event-type binary → optimistic; price → Pyth CPI).
- **Integrations**: Pyth, Chainlink, RedStone (fallback via Wormhole).
- **Fallback**: Anomaly detection → Switch feeds.

### 5. RWA & Time-Series Feeds
- **Purpose**: Bridges TradFi data (yields, indices).
- **Tech**: Custodian APIs (e.g., BlackRock) → Wormhole attestations → Solana storage.
- **Flow**: Poll → Attest → On-chain feed (time-series PDA).
- **Composability**: SDK for DeFi protocols.


## Data Flow Diagram

```

┌──────────────────────────────────────────────┐
│         Event Trigger (Prediction Market)    │
└──────────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────┐
│     Event-Resolution Engine (Solana PDA)     │
└──────────────────────────────────────────────┘
                     │
                     ▼
            ┌────────────────────────────┐
            │  AI-Assisted Proposing?    │
            └────────────────────────────┘
              │                     │
    ┌─────────┘                     └───────────┐
    ▼                                           ▼
┌────────────────────────────┐        ┌────────────────────────┐
│ Auto-Submit Proposal       │        │ Human Review Queue     │
│ (+ Arweave Evidence)       │        └────────────────────────┘
└────────────────────────────┘
              │
              ▼
┌──────────────────────────────────────────────┐
│   Hybrid Controller (Route: Subj / Obj)      │
└──────────────────────────────────────────────┘
        │                          │
   Subjective                 Objective
        │                          │
        ▼                          ▼
┌────────────────────────┐   ┌─────────────────────────────┐
│ Liveness Window (2h)   │   │ Pyth / RedStone Feed (CPI)  │
└────────────────────────┘   └─────────────────────────────┘
        │                          │
        ▼                          │
┌───────────────────────────────┐  │
│ Autonomous Dispute Bots       │  │
│ (Monitor + Verify)            │  │
└───────────────────────────────┘  │
     │             │               │
     │ Dispute     │ No Dispute    │
     ▼             ▼               │
┌──────────────────────┐   ┌────────────────────────┐
│ DAO Arbitration      │   │ Auto-Resolve (Payouts) │
│ (3-5 days)           │   └────────────────────────┘
└──────────────────────┘              │
          └───────────────────────────┘
                     ▼
┌────────────────────────────────────────┐
│ RWA Feeds (Wormhole Attestations)      │
└────────────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────┐
│ DeFi Composability (Markets, Insurance)│
└────────────────────────────────────────┘

────────────────────────────────────────────
Additional Flows:
────────────────────────────────────────────
• Auto-Submit Proposal ──▶ Immutable Storage (Arweave/IPFS)
• Immutable Storage ──▶ Proof ──▶ Event-Resolution Engine (loop)
• Pyth/RedStone Feed ──▶ Fallback ──▶ Liveness Window

```

## Tech Stack
- **Blockchain**: Solana (Rust/Anchor) – High TPS.
- **Off-Chain**: Node.js (Express) – Microservices.
- **AI**: OpenAI + LangChain – Evidence parsing.
- **Storage**: Arweave – Immutable, ~$0.01/GB.
- **Monitoring**: Prometheus + Grafana (Phase 3).
- **Security**: Bonds/slashing; Cryptographic hashes.

## Scalability & Reliability
- **Throughput**: 1k+ req/day (Solana limits).
- **Uptime**: 99.9% via redundant bots/RPCs.
- **Cost**: ~$0.01/proposal (AI + Arweave).

For code-level details, see [GitHub](https://github.com/uncletom29/predictlink).



# PredictLink Oracle: Hackathon Pitch

**Fast, AI-Assisted Hybrid Oracle for Prediction Markets & RWA Data on Solana**

## 🎯 Problem
It's Sunday evening. The Super Bowl just ended. Millions of dollars sit locked in prediction markets across Solana, waiting to be settled. Traders refresh their screens anxiously. But there's a problem: the oracle won't resolve for another 24–48 hours.

Sarah, a DeFi trader, watches her winning position accrue opportunity cost. She could deploy that capital into yield strategies, but instead it's frozen in bureaucratic oracle limbo. The outcome is clear — the whole world saw it — yet the settlement mechanism treats certainty like controversy.

Meanwhile, across the protocol, a small illiquid market about a local election sits vulnerable. With only $3,000 in volume, there's no economic incentive for validators to monitor it. A bad actor submits a false outcome. Nobody's watching. By the time someone notices 40 hours later, the damage is done.

This is the oracle problem in 2025: too slow for liquid markets, too unguarded for illiquid ones.

PredictLink exists to fix both. We're building an oracle that moves at the speed of information, not bureaucracy — and one that never sleeps, even when humans aren't paying attention.

## 💡 The Vision
Imagine a prediction market ecosystem where:

* Winners get paid in minutes, not days — when the event is unambiguous, why wait?

* AI agents work 24/7 gathering evidence, so human validators can focus on genuinely controversial cases

* Autonomous watchdogs protect every market, regardless of size or attention

* Real-world assets flow seamlessly onto Solana with the same trust layer as price feeds

* One oracle handles everything from "Who won the election?" to "What's the 10-year Treasury yield?"

This isn't just faster infrastructure. It's a fundamental rethinking of how truth enters blockchain systems.

## 🚀 The Problem We're Solving
### The Speed Tax
Current optimistic oracles impose artificial waiting periods. UMA's Optimistic Oracle requires 24–48 hours for liveness, even when outcomes are crystal clear. This creates:

* Poor user experience for traders watching obvious outcomes

* Capital inefficiency as funds sit locked unnecessarily

* Higher costs from extended staking and gas fees

* Competitive disadvantage versus centralized prediction platforms

### The Attention Gap
Low-liquidity markets are systematically vulnerable. When validator rewards are small, bad actors can submit false data and profit before anyone notices. The economics of decentralized validation break down at small scale.

### The Context Problem
Generic oracles treat all data equally. They don't understand that "Who won the World Cup?" has different evidentiary requirements than "What is ETH/USD?" This one-size-fits-all approach misses opportunities for intelligent automation.

### The RWA Barrier
As tokenized real-world assets explode on Solana, there's no trusted infrastructure for bringing verified RWA data on-chain at scale. Treasury yields, real estate indices, commodity prices — these need domain-specific handling, not generic price feeds.

## 💡 Our Solution: Five Pillars of Truth
### 1. Event-Resolution Engine: Built for Speed
Our core oracle uses optimistic submission with short liveness windows. For unambiguous outcomes, we achieve sub-2-hour finality. Traders don't wait for artificial timers when the evidence is overwhelming.

The engine supports:

* Binary outcomes (yes/no)

* Multi-choice events (election with 5 candidates)

* Numeric ranges (temperature readings, vote counts)

* Batch resolution for correlated events (playoff series, multi-region elections)

### 2. AI-Assisted Proposing: Your 24/7 Research Team
Here's where it gets interesting. We've deployed LLM-based agents that:

* Continuously monitor verified data sources (AP, Reuters, official blockchain events)

* Aggregate evidence from multiple channels

* Generate confidence scores: "99.8% confident — 47 corroborating sources"

* Auto-submit proposals for high-confidence events

* Flag edge cases for human review

Think of it as having an army of interns who never sleep, never miss a detail, and summarize everything perfectly. The AI doesn't decide truth — it accelerates the path to consensus by doing the tedious research work.

Every AI proposal includes cryptographic metadata: what sources it checked, when, and with what confidence. Full provenance, always auditable.

### 3. Autonomous Dispute Network: The Watchdogs
Remember that vulnerable illiquid market? Here's the defense.

We've created an incentivized network of dispute-bots that:

* Scan every proposal against independent data sources

* Flag inconsistencies within minutes

* Earn rewards for catching false submissions

* Create economic deterrence even in $100 markets

These bots operate 24/7 across all markets simultaneously. They're not human validators choosing what to watch — they're automated security monitoring everything. A bad actor can't find an unguarded moment.

The economics work because bots share infrastructure costs across thousands of markets. What's unprofitable for a human validator watching one small market becomes profitable for a bot watching thousands.

### 4. Hybrid Oracle Controller: One Interface, Multiple Truths
Not all truth is created equal. "Who won the game?" is subjective judgment. "What's the price of SOL?" is objective measurement.

Our hybrid controller intelligently routes requests:

Subjective Path → Optimistic oracle with AI assistance

Objective Path → Real-time price feeds (Pyth, RedStone, Chainlink)

One SDK. One integration. Your protocol doesn't need to know the difference. We handle routing, fallbacks, and failovers automatically.

If Pyth goes down, we switch to RedStone. If an objective feed looks anomalous, we can trigger optimistic verification. The system thinks about data integrity so developers don't have to.

### 5. RWA & Time-Series Feeds: Bridging Two Worlds
The future of DeFi includes tokenized treasuries, real estate, commodities, and corporate debt. These assets need verified off-chain data:

* What's the current 10-year Treasury yield?

* What's the NAV of this tokenized real estate fund?

* What's today's gold spot price from LBMA?

* Has this corporate bond defaulted?

We're building specialized feeds that:

* Connect to custodian APIs and regulatory filings

* Bridge attestations via Wormhole and Solana protocols

* Provide time-series data for DeFi strategies

* Enable composability between TradFi and crypto

Imagine a DeFi protocol that automatically rebalances based on Fed rate decisions, or a prediction market about real estate prices that settles against verified indices. That's the composability we're unlocking.

## 🏗️ How It Works: A User Journey
### Scenario: FIFA World Cup Final

1. Event Creation (T=0)

   * Market creator submits: "Will Argentina win the 2026 World Cup Final?"

   * PredictLink registers the event, links to official FIFA data sources

2. The Match Ends (T=90 minutes)

   * Argentina wins 3-1

   * Within 60 seconds, our AI agents detect the outcome across 40+ verified sources

   * Confidence score: 99.9%

3. AI Proposal (T=2 minutes)

   * AI agent submits resolution with evidence bundle

   * Evidence stored on Arweave, hash posted on-chain

   * 2-hour liveness period begins

   * Agent stakes bond (skin in the game)

4. Autonomous Monitoring (T=2 mins to 2 hours)

   * 50+ dispute-bots independently verify the outcome

   * All confirm: outcome matches reality

   * No disputes filed

5. Instant Settlement (T=2 hours, 1 second)

   * Liveness expires with zero disputes

   * Market resolves automatically

   * Winners receive payouts

   * AI agent receives proposer reward

Total time: 2 hours from event end to settlement.

Compare this to traditional oracles: 24–48 hours of unnecessary waiting for an outcome the entire world already knows.

### Scenario 2: Contentious Election

1. Local election ends, results are close

2. AI agent detects mixed signals from sources

3. Confidence score: 67% (below auto-submit threshold)

4. System flags for human proposer review

5. Human validator reviews evidence, submits proposal

6. Dispute-bot detects conflicting data from one source

7. Bot files dispute with counter-evidence

8. 3-day resolution period with DAO arbitration

9. Final settlement after thorough review

The system knows when to move fast and when to slow down. Speed where appropriate, caution where necessary.

## 📊 Performance Metrics
| Metric                  | Target                  | Why It Matters                  |
|-------------------------|-------------------------|---------------------------------|
| Finalization (Uncontested) | ≤ 2 hours              | 10–24x faster than current oracles |
| AI Auto-Resolution Rate | 80%+                   | Most events are unambiguous     |
| Dispute Detection Time  | ≤ 5 minutes            | Stops manipulation before it spreads |
| Daily Throughput        | 1,000+ requests        | Scales with ecosystem growth    |
| Concurrent Active Markets | 50,000+              | Enterprise-grade capacity       |
| Uptime                  | 99.9%                  | Critical infrastructure reliability |

## 💰 Economic Model: Aligned Incentives
### The Flywheel
More markets → More fees → Higher dispute rewards → More bots → Better security → More markets

### Revenue Streams
* Oracle fees (0.1–0.5% of market volume) paid by market creators

* Premium RWA data API subscriptions

* White-label oracle solutions for enterprises

### Participant Incentives
* AI Proposers: Earn 60% of oracle fees for accurate, fast submissions

* Dispute Bots: Earn 30% of fees + bounties for catching false data

* Validators: Earn rewards for arbitration in contested cases

* Stakers: Provide economic security, earn yield from protocol revenue

### Penalty Mechanisms
* Dishonest proposals forfeit full bond

* Frivolous disputes lose staked capital

* Slashed funds go to reward pool, strengthening honest participation

## 🔒 Security & Trust: Defense in Depth
### Layer 1: Economic Security
* All proposers stake bonds (skin in the game)

* Slashing for dishonest behavior

* Progressive penalties for repeat offenders

### Layer 2: Autonomous Monitoring
* Dispute-bots create adversarial verification

* Redundant checking across independent agents

* 24/7 monitoring with no attention gaps

### Layer 3: Cryptographic Provenance
* All evidence timestamped and hashed

* Immutable storage on Arweave

* Full audit trails for every decision

### Layer 4: AI Transparency
* Confidence scores published on-chain

* Source attribution for every data point

* Human override capability for AI decisions

### Layer 5: DAO Governance
* Community arbitration for edge cases

* Parameter adjustments via voting

* Emergency pause mechanisms

## 🛣️ Development Roadmap
### Phase 1: MVP (Hackathon) ✅
* Binary optimistic oracle with 2-hour liveness

* AI evidence layer with OpenAI integration

* Basic dispute mechanism with bonding

* Frontend dashboard for monitoring

* Integration with 1–2 prediction market protocols

* Demo with real event data (sports/crypto events)

### Phase 2: Expansion (+1 Month)
* Deploy autonomous dispute-bot network (5–10 bots)

* RWA data feeds for treasuries and commodities

* Multi-choice and numeric outcome support

* Enhanced AI models for complex event types

* Arweave evidence storage integration

### Phase 3: Scale (+2 Months)
* Hybrid routing controller (subjective + objective paths)

* Full integration with Pyth, Chainlink, RedStone

* Developer SDKs for Solana protocols

* Advanced analytics dashboard

* Mobile app for dispute resolution

### Phase 4: Ecosystem (+3 Months)
* DAO governance launch with token

* Cross-chain attestation via Wormhole

* Insurance protocol partnerships

* Regulatory compliance tools for RWA

* Enterprise white-label solutions

## 🎯 Target Users & Use Cases
### Prediction Markets
* Sports betting platforms (instant post-game settlement)

* Political forecasting (election outcomes, policy decisions)

* DeFi event markets (protocol launches, governance votes)

* Entertainment predictions (award shows, reality TV)

### RWA Protocols
* Tokenized treasury platforms needing yield data

* Real estate tokenization requiring price indices

* Commodity-backed tokens needing spot prices

* Corporate debt platforms tracking defaults

### DeFi Infrastructure
* Insurance protocols with parametric triggers

* Automated trading strategies based on RWA data

* Cross-chain bridges needing event verification

* DAO governance requiring verified outcomes

### GameFi & Metaverse
* Games with real-world outcome dependencies

* Fantasy sports with instant settlements

* Betting mechanics tied to live events

* Achievement systems verified by external data

## 🌟 Innovation & Impact
### What Makes PredictLink Different
Unlike UMA's Optimistic Oracle: We add AI assistance and autonomous monitoring, reducing finality from 48 hours to 2 hours while maintaining decentralization.

Unlike Chainlink: We handle subjective events and provide context-aware resolution, not just price feeds.

Unlike Pyth: We combine objective data streams with optimistic mechanisms for events that need human judgment.

We're not replacing these oracles — we're filling the gaps they leave.

### Ecosystem Impact
* 60–80% cost reduction through faster finality and lower capital lockup

* New market designs previously impossible with slow oracles (micro-markets, live betting)

* RWA composability enabling TradFi integration at scale

* Shared security infrastructure benefiting the entire Solana DeFi ecosystem

## The Bigger Picture
Oracles are truth infrastructure. Every DeFi protocol, every prediction market, every RWA token ultimately depends on trusted data about the real world.

Today, that infrastructure is slow, expensive, and fragmented. PredictLink unifies it: fast when possible, careful when necessary, always watching, never sleeping.

As Solana scales to millions of users and billions in TVL, the oracle layer needs to scale with it. That's what we're building.

## 👥 Team

* Smart Contract Developer: Solana/Rust/Anchor expertise, previous DeFi protocol experience

* Backend Engineer: Node.js, microservices architecture, API integrations at scale

* AI/ML Engineer: LLM prompt engineering, confidence scoring systems, autonomous agents

* Frontend Developer: Next.js, real-time data visualization, Web3 UX

* Product Lead: 5+ years in DeFi, deep prediction market domain knowledge


##  Contact

Twitter: [@predictlinkoracle]\

Telegram: [@Tom_Tom29]

## 🏆 Core Competencies
### Technical Excellence: Production-ready Solana architecture with novel AI integration
### Real Problem, Real Solution: Every prediction market and RWA protocol on Solana needs what we're building
### Ecosystem Impact: We're not building for ourselves — we're building infrastructure that benefits everyone
### Execution: Not just ideas — working demo, clear roadmap, scalable design
### Vision: This isn't just a hackathon project. It's the foundation for Solana's truth economy.

### Track: DeFi Infrastructure / Oracle & Data Layer Innovation
The Ask: We're not just asking judges to evaluate a project. We're asking you to imagine a Solana where truth moves at the speed of information. Where winners get paid instantly. Where no market is too small to be secure. Where real-world assets compose seamlessly with crypto-native protocols.

That's the future PredictLink enables. And it starts now.

**PredictLink: Connecting Real-World Truth to On-Chain Markets**

**Because certainty shouldn't wait.**



# PredictLink Oracle Deployment Guide

This guide covers deploying PredictLink to Solana Devnet (for testing) and Mainnet (production). Assumes Node.js v20+, Rust v1.75+, Anchor v0.30.1, and Solana CLI v1.18+ installed. Use a secure wallet (e.g., hardware) for Mainnet.

## Prerequisites
- **Solana CLI**: `sh -c "$(curl -sSfL https://release.solana.com/v1.18.0/install)"`
- **Anchor**: `cargo install --git https://github.com/coral-xyz/anchor anchor-cli --locked`
- **Node.js**: v20+ with Yarn/NPM.
- **Arweave Wallet**: Fund with AR (~$5 for testing).
- **OpenAI Key**: From [platform.openai.com](https://platform.openai.com).
- **Env Vars**: Copy `.env.example` to `.env` and fill (RPC, keys, etc.).

## 1. Local Development
### Setup
```bash
git clone https://github.com/uncletom29/predictlink-oracle.git
cd predictlink-oracle
yarn install  # Or npm install
cp .env.example .env
# Edit .env: SOLANA_RPC_URL=localhost, etc.
```

### Run Localnet
```bash
cd predictlink-programs
anchor build
anchor deploy --provider.cluster localnet

# Backend
cd backend && yarn dev

# Frontend
cd ../frontend && yarn dev
```

### Test
- Open `http://localhost:3000`.
- Create event, propose, monitor dashboard.
- Verify txs: `solana logs`.

## 2. Devnet Deployment
### Deploy Smart Contracts
```bash
# Config: Anchor.toml cluster=devnet
anchor build
anchor deploy --provider.cluster devnet --provider.wallet ~/.config/solana/id.json

# Update PROGRAM_ID in .env and frontend next.config.js
echo "Program deployed: $(solana address)"
```

### Deploy Backend
```bash
cd backend
yarn build
# Docker (optional)
docker build -t predictlink-backend .
docker run -p 3001:3001 --env-file .env predictlink-backend

# Or PM2/PM2 ecosystem.config.js
pm2 start ecosystem.config.js --env devnet
```

### Deploy Frontend
```bash
cd frontend
yarn build
# Vercel (recommended)
vercel --prod --env NEXT_PUBLIC_SOLANA_RPC=https://api.devnet.solana.com

# Or Docker
docker build -t predictlink-frontend .
docker run -p 3000:3000 predictlink-frontend
```

### Verify
- Dashboard: `https://your-vercel-app.vercel.app/dashboard`.
- Tx Explorer: [explorer.solana.com/?cluster=devnet](https://explorer.solana.com/?cluster=devnet).
- Arweave: Check txIds on [arweave.net](https://arweave.net).

## 3. Mainnet Deployment
**Warning**: Use funded mainnet wallet. Costs: ~0.1 SOL deploy + gas.

### Smart Contracts
```bash
# Anchor.toml: cluster=mainnet
anchor build -- --release  # Optimized
anchor deploy --provider.cluster mainnet

# Verify on-chain (optional)
anchor idl init --provider.cluster mainnet
```

### Backend
```bash
cd backend
yarn build
# AWS ECS or Railway
# Example: Railway CLI
railway up --env .env.mainnet

# Monitoring: Integrate Datadog/Sentry
```

### Frontend
```bash
cd frontend
yarn build
vercel --prod --env NEXT_PUBLIC_SOLANA_RPC=https://api.mainnet-beta.solana.com
```

### Post-Deploy
- **DAO Init**: Seed authority PDA.
- **Bots**: Deploy 5+ dispute-bots via Kubernetes.
- **CI/CD**: GitHub Actions (`.github/workflows/deploy.yml`).
  ```yaml
  # Example snippet
  - name: Deploy to Mainnet
    run: anchor deploy --provider.cluster mainnet
  ```
- **Costs**:
  - Deploy: 0.05-0.2 SOL.
  - AI: $0.01/proposal (GPT-4o-mini).
  - Arweave: $0.005/MB.

## Troubleshooting
- **Anchor Errors**: `anchor keys list`; Ensure wallet funded (`solana airdrop 2` on Devnet).
- **RPC Timeouts**: Use Helius/QuickNode paid RPC.
- **Arweave Fails**: Check wallet balance (`arweave wallet balance`).
- **CORS Issues**: Update `cors` origins in backend.
- **Logs**: `pm2 logs` or `docker logs`.



For support: [DM on Twitter](https://x.com/hackcat_29).
```