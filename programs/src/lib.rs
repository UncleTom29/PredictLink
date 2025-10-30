// programs/src/lib.rs
use anchor_lang::prelude::*;
use anchor_lang::solana_program::clock::Clock;
use crate::state::{Oracle, Proposal, Event, ResolutionType};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod predictlink_oracle {
    use super::*;

    /// Initializes the oracle configuration
    pub fn initialize(
        ctx: Context<Initialize>,
        bond_amount: u64,
        liveness_period: i64,
    ) -> Result<()> {
        let oracle = &mut ctx.accounts.oracle;
        oracle.authority = ctx.accounts.authority.key();
        oracle.active_proposals = 0;
        oracle.total_resolved = 0;
        oracle.bond_amount = bond_amount;
        oracle.liveness_period = liveness_period;
        oracle.bump = ctx.bumps.oracle;
        Ok(())
    }

    /// Creates a new event (e.g., prediction market event)
    pub fn create_event(
        ctx: Context<CreateEvent>,
        description: String,
        resolution_type: u8,  // 0 for binary
    ) -> Result<()> {
        let event = &mut ctx.accounts.event;
        let clock = Clock::get()?;
        event.id = ctx.accounts.oracle.total_resolved + 1;  // Simple ID gen
        event.description = description;
        event.resolution_type = resolution_type;
        event.market_address = ctx.accounts.market.key();
        event.created_at = clock.unix_timestamp;
        event.creator = ctx.accounts.creator.key();
        event.bump = ctx.bumps.event;
        Ok(())
    }

    /// Submits a proposal for an event outcome
    pub fn propose(
        ctx: Context<Propose>,
        outcome: bool,
        evidence_hash: [u8; 32],
    ) -> Result<()> {
        let oracle = &mut ctx.accounts.oracle;
        let proposal = &mut ctx.accounts.proposal;
        let event = &ctx.accounts.event;
        let clock = Clock::get()?;

        // Validate bond transfer (system program handles transfer, but check amount)
        require!(ctx.accounts.proposer.to_account_info().lamports() >= oracle.bond_amount, OracleError::InsufficientBond);

        // Validate resolution type (MVP: binary only)
        require!(event.resolution_type == 0, OracleError::ResolutionMismatch);

        // Generate unique ID
        let proposal_id = oracle.active_proposals + 1;
        if proposal_id == u64::MAX {
            return err!(OracleError::ArithmeticOverflow);
        }

        proposal.id = proposal_id;
        proposal.event_id = event.key();
        proposal.proposer = ctx.accounts.proposer.key();
        proposal.outcome = outcome;
        proposal.evidence_hash = evidence_hash;
        proposal.submitted_at = clock.unix_timestamp;
        proposal.liveness_end = clock.unix_timestamp + oracle.liveness_period;
        proposal.bonded_amount = oracle.bond_amount;
        proposal.resolved = false;
        proposal.disputed = false;
        proposal.disputer = None;
        proposal.resolver = None;
        proposal.bump = ctx.bumps.proposal;

        oracle.active_proposals += 1;
        Ok(())
    }

    /// Disputes a proposal during liveness
    pub fn dispute(
        ctx: Context<Dispute>,
        counter_evidence_hash: [u8; 32],
    ) -> Result<()> {
        let oracle = &ctx.accounts.oracle;
        let proposal = &mut ctx.accounts.proposal;
        let clock = Clock::get()?;

        // Check liveness active
        require!(clock.unix_timestamp < proposal.liveness_end, OracleError::LivenessActive);

        // Validate disputer bond
        require!(ctx.accounts.disputer.to_account_info().lamports() >= oracle.bond_amount, OracleError::InsufficientBond);

        // Prevent duplicate disputes
        require!(!proposal.disputed, OracleError::AlreadyResolved);

        proposal.disputed = true;
        proposal.dispute_evidence_hash = counter_evidence_hash;
        proposal.disputer = Some(ctx.accounts.disputer.key());
        proposal.dispute_bond = oracle.bond_amount;

        // Emit dispute event
        emit!(ProposalDisputed {
            proposal_id: proposal.id,
            disputer: ctx.accounts.disputer.key(),
        });

        Ok(())
    }

    /// Resolves a proposal after liveness (auto if uncontested, authority if disputed)
    pub fn resolve(
        ctx: Context<Resolve>,
        final_outcome: bool,
    ) -> Result<()> {
        let oracle = &mut ctx.accounts.oracle;
        let proposal = &mut ctx.accounts.proposal;
        let clock = Clock::get()?;

        // Check liveness expired
        require!(clock.unix_timestamp >= proposal.liveness_end, OracleError::LivenessActive);

        // If disputed, only authority can resolve
        if proposal.disputed {
            require!(ctx.accounts.authority.key() == oracle.authority, OracleError::Unauthorized);
        }

        // Prevent re-resolution
        require!(!proposal.resolved, OracleError::AlreadyResolved);

        // Validate outcome matches type (MVP: binary)
        require!(final_outcome == proposal.outcome || proposal.disputed, OracleError::ResolutionMismatch);  // Allow override if disputed

        proposal.outcome = final_outcome;
        proposal.resolved = true;
        proposal.resolver = Some(ctx.accounts.authority.key());

        // Decrement active, increment total
        oracle.active_proposals = oracle.active_proposals.saturating_sub(1);
        oracle.total_resolved = oracle.total_resolved.saturating_add(1);

        // Emit resolution event
        emit!(ProposalResolved {
            proposal_id: proposal.id,
            event_id: proposal.event_id,
            outcome: final_outcome,
            proposer: proposal.proposer,
            disputed: proposal.disputed,
        });


        Ok(())
    }

    /// Withdraw bond after resolution (proposer or disputer)
    pub fn withdraw_bond(ctx: Context<WithdrawBond>) -> Result<()> {
        let proposal = &ctx.accounts.proposal;
        let oracle = &ctx.accounts.oracle;

        require!(proposal.resolved, OracleError::LivenessActive);

        let withdrawer = if ctx.accounts.withdrawer.key() == proposal.proposer {
            require!(proposal.bonded_amount > 0, OracleError::InsufficientBond);
            proposal.bonded_amount
        } else if let Some(disputer) = proposal.disputer {
            if ctx.accounts.withdrawer.key() == disputer {
                require!(proposal.dispute_bond > 0, OracleError::InsufficientBond);
                proposal.dispute_bond
            } else {
                return err!(OracleError::Unauthorized);
            }
        } else {
            return err!(OracleError::Unauthorized);
        };

  

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction()]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 8 + 8 + 8 + 8 + 1,  // Discriminator + fields
        seeds = [b"oracle"],
        bump
    )]
    pub oracle: Account<'info, Oracle>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(description: String)]
pub struct CreateEvent<'info> {
    #[account(mut)]
    pub oracle: Account<'info, Oracle>,
    #[account(
        init,
        payer = creator,
        space = 8 + 8 + 4 + 256 + 1 + 32 + 8 + 32 + 1,  // Approx for string
        seeds = [b"event", oracle.key().as_ref(), description.as_bytes()],
        bump
    )]
    pub event: Account<'info, Event>,
    /// CHECK: Market address provided by caller
    pub market: AccountInfo<'info>,
    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction()]
pub struct Propose<'info> {
    #[account(mut)]
    pub oracle: Account<'info, Oracle>,
    #[account(
        init,
        payer = proposer,
        space = 8 + 8 + 32 + 32 + 1 + 32 + 8 + 8 + 8 + 1 + 1 + 8 + 32 + 32 + 1 + 32 + 1,  // Disc + fields
        seeds = [b"proposal", event.key().as_ref()],
        bump
    )]
    pub proposal: Account<'info, Proposal>,
    pub event: Account<'info, Event>,
    #[account(mut)]
    pub proposer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction()]
pub struct Dispute<'info> {
    #[account(mut)]
    pub oracle: Account<'info, Oracle>,
    #[account(mut, has_one = event_id @ OracleError::ProposalNotFound)]
    pub proposal: Account<'info, Proposal>,
    pub event: Account<'info, Event>,
    #[account(mut)]
    pub disputer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction()]
pub struct Resolve<'info> {
    #[account(mut)]
    pub oracle: Account<'info, Oracle>,
    #[account(mut, has_one = event_id @ OracleError::ProposalNotFound)]
    pub proposal: Account<'info, Proposal>,
    pub event: Account<'info, Event>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
#[instruction()]
pub struct WithdrawBond<'info> {
    #[account(mut)]
    pub oracle: Account<'info, Oracle>,
    #[account(mut)]
    pub proposal: Account<'info, Proposal>,
    #[account(mut)]
    pub withdrawer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[event]
pub struct ProposalDisputed {
    pub proposal_id: u64,
    pub disputer: Pubkey,
}

#[event]
pub struct ProposalResolved {
    pub proposal_id: u64,
    pub event_id: Pubkey,
    pub outcome: bool,
    pub proposer: Pubkey,
    pub disputed: bool,
}

#[error_code]
pub enum OracleError {
   
}