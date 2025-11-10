use anchor_lang::prelude::*;

#[error_code]
pub enum OracleError {
    #[msg("Unauthorized access")]
    Unauthorized,
    #[msg("Liveness period still active")]
    LivenessActive,
    #[msg("Proposal already resolved")]
    AlreadyResolved,
    #[msg("Insufficient bond amount")]
    InsufficientBond,
    #[msg("Event not found or invalid")]
    InvalidEvent,
    #[msg("Proposal not found")]
    ProposalNotFound,
    #[msg("Dispute period expired")]
    DisputeExpired,
    #[msg("Invalid evidence hash")]
    InvalidEvidence,
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
    #[msg("Proposal ID already exists")]
    IdExists,
    #[msg("Event resolution type mismatch")]
    ResolutionMismatch,
}