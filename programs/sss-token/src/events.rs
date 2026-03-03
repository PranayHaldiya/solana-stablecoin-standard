use anchor_lang::prelude::*;

#[event]
pub struct StablecoinInitialized {
    pub mint: Pubkey,
    pub authority: Pubkey,
    pub name: String,
    pub symbol: String,
    pub decimals: u8,
    pub preset: String,
    pub enable_permanent_delegate: bool,
    pub enable_transfer_hook: bool,
}

#[event]
pub struct TokensMinted {
    pub mint: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
    pub minter: Pubkey,
}

#[event]
pub struct TokensBurned {
    pub mint: Pubkey,
    pub amount: u64,
    pub burner: Pubkey,
}

#[event]
pub struct AccountFrozen {
    pub mint: Pubkey,
    pub account: Pubkey,
    pub authority: Pubkey,
}

#[event]
pub struct AccountThawed {
    pub mint: Pubkey,
    pub account: Pubkey,
    pub authority: Pubkey,
}

#[event]
pub struct StablecoinPaused {
    pub mint: Pubkey,
    pub authority: Pubkey,
}

#[event]
pub struct StablecoinUnpaused {
    pub mint: Pubkey,
    pub authority: Pubkey,
}

#[event]
pub struct BlacklistAdded {
    pub mint: Pubkey,
    pub address: Pubkey,
    pub reason: String,
    pub authority: Pubkey,
}

#[event]
pub struct BlacklistRemoved {
    pub mint: Pubkey,
    pub address: Pubkey,
    pub authority: Pubkey,
}

#[event]
pub struct TokensSeized {
    pub mint: Pubkey,
    pub from: Pubkey,
    pub to: Pubkey,
    pub amount: u64,
    pub authority: Pubkey,
}

#[event]
pub struct AuthorityTransferred {
    pub mint: Pubkey,
    pub old_authority: Pubkey,
    pub new_authority: Pubkey,
}

#[event]
pub struct MinterUpdated {
    pub mint: Pubkey,
    pub minter: Pubkey,
    pub quota: u64,
    pub active: bool,
}

#[event]
pub struct RoleUpdated {
    pub mint: Pubkey,
    pub role: String,
    pub account: Pubkey,
}
