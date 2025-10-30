// programs/src/state.rs
use anchor_lang::prelude::*;

#[account]
#[derive(Default, Debug)]
pub struct Oracle {
    pub authority: Pubkey,        // Authority for governance/resolution
    pub active_proposals: u64,    // Number of active proposals
    pub total_resolved: u64,      // Cumulative resolved proposals
    pub bond_amount: u64,         // Minimum bond for proposers/disputers (lamports)
    pub liveness_period: i64,     // Default liveness in seconds (e.g., 7200 for 2 hours)
    pub bump: u8,                 // PDA bump for oracle
}

#[account]
#[derive(Default, Debug)]
pub struct Proposal {
    pub id: u64,                          // Unique proposal ID (incremented globally)
    pub event_id: Pubkey,                 // PDA or key of the associated event/market
    pub proposer: Pubkey,                 // Proposer pubkey
    pub outcome: bool,                    // Resolved outcome (true/false for binary)
    pub evidence_hash: [u8; 32],          // SHA-256 hash of evidence bundle
    pub submitted_at: i64,                // Unix timestamp of submission
    pub liveness_end: i64,                // Unix timestamp when liveness ends
    pub bonded_amount: u64,               // Amount bonded by proposer
    pub resolved: bool,                   // Whether proposal is resolved
    pub disputed: bool,                   // Whether disputed
    pub dispute_bond: u64,                // Bond from disputer (if disputed)
    pub disputer: Option<Pubkey>,         // Disputer pubkey (if disputed)
    pub dispute_evidence_hash: [u8; 32],  // Counter-evidence hash (if disputed)
    pub resolver: Option<Pubkey>,         // Who resolved it (authority or DAO)
    pub bump: u8,                         // PDA bump
}

#[account]
#[derive(Default, Debug)]
pub struct Event {
    pub id: u64,                  // Unique event ID
    pub description: String,      // Human-readable event desc (e.g., "Solana > $200?")
    pub resolution_type: u8,      // 0: binary, 1: multi-choice, 2: numeric (MVP: binary only)
    pub market_address: Pubkey,   // Associated prediction market PDA
    pub created_at: i64,          // Creation timestamp
    pub creator: Pubkey,          // Event creator
    pub bump: u8,                 // PDA bump
}

// For future multi-choice/numeric
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub enum ResolutionType {
    Binary,
    MultiChoice { options: Vec<String> },
    Numeric { min: u64, max: u64 },
}