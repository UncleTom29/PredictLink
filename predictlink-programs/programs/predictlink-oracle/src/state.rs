use anchor_lang::prelude::*;

#[account]
#[derive(Default, Debug)]
pub struct Oracle {
    pub authority: Pubkey,       
    pub active_proposals: u64,    
    pub total_resolved: u64,      
    pub bond_amount: u64,         
    pub liveness_period: i64,     
    pub bump: u8,                 
}

#[account]
#[derive(Default, Debug)]
pub struct Proposal {
    pub id: u64,                          
    pub event_id: Pubkey,                
    pub proposer: Pubkey,                
    pub outcome: bool,                   
    pub evidence_hash: [u8; 32],         
    pub submitted_at: i64,               
    pub liveness_end: i64,               
    pub bonded_amount: u64,              
    pub resolved: bool,                
    pub disputed: bool,                
    pub dispute_bond: u64,               
    pub disputer: Option<Pubkey>,        
    pub dispute_evidence_hash: [u8; 32], 
    pub resolver: Option<Pubkey>,         
    pub bump: u8,                        
}

#[account]
#[derive(Default, Debug)]
pub struct Event {
    pub id: u64,                  
    pub description: String,      
    pub resolution_type: u8,     
    pub market_address: Pubkey,   
    pub created_at: i64,         
    pub creator: Pubkey,         
    pub bump: u8,                
}


#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub enum ResolutionType {
    Binary,
    MultiChoice { options: Vec<String> },
    Numeric { min: u64, max: u64 },
}