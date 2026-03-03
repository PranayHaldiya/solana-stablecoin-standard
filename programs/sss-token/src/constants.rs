pub const STABLECOIN_SEED: &[u8] = b"stablecoin";
pub const MINTER_SEED: &[u8] = b"minter";
pub const BLACKLIST_SEED: &[u8] = b"blacklist";
pub const AUDIT_LOG_SEED: &[u8] = b"audit_log";

/// Maximum name length
pub const MAX_NAME_LEN: usize = 32;
/// Maximum symbol length
pub const MAX_SYMBOL_LEN: usize = 10;
/// Maximum URI length
pub const MAX_URI_LEN: usize = 200;
/// Maximum reason length for blacklist
pub const MAX_REASON_LEN: usize = 128;
/// Maximum decimals
pub const MAX_DECIMALS: u8 = 9;
