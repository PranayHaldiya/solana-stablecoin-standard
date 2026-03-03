use anchor_lang::prelude::*;
use anchor_lang::system_program::{create_account, CreateAccount};
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};
use spl_tlv_account_resolution::{account::ExtraAccountMeta, seeds::Seed, state::ExtraAccountMetaList};
use spl_transfer_hook_interface::instruction::{ExecuteInstruction, TransferHookInstruction};
use spl_token_2022::extension::{
    transfer_hook::TransferHookAccount,
    BaseStateWithExtensions, StateWithExtensionsMut,
};
use spl_token_2022::state::Account as Token2022Account;

declare_id!("J8sRn7M35NfUi511JY3Hnw4dPBm9UvwmpKCBrAbzCMKq");

/// Seed for the blacklist PDA used in ExtraAccountMeta
pub const BLACKLIST_SEED: &[u8] = b"blacklist";

#[program]
pub mod sss_transfer_hook {
    use super::*;

    /// Initialize the ExtraAccountMetaList for this mint.
    /// Stores the additional accounts needed by the transfer_hook instruction.
    pub fn initialize_extra_account_meta_list(
        ctx: Context<InitializeExtraAccountMetaList>,
    ) -> Result<()> {
        // Define the extra accounts needed by our transfer hook:
        // We need a blacklist PDA derived from the source token account owner
        // to check if the sender is blacklisted.
        // And another for the destination owner.
        let account_metas = vec![
            // index 5: blacklist entry for source owner
            // Seeds: ["blacklist", source_owner_pubkey]
            // source owner is at account_index 3 (owner in transfer instruction)
            ExtraAccountMeta::new_with_seeds(
                &[
                    Seed::Literal { bytes: BLACKLIST_SEED.to_vec() },
                    Seed::AccountKey { index: 3 }, // owner (sender)
                ],
                false, // is_signer
                false, // is_writable
            )?,
            // index 6: blacklist entry for destination owner
            // We derive destination owner from the destination token account data
            // owner field is at offset 32, length 32
            ExtraAccountMeta::new_with_seeds(
                &[
                    Seed::Literal { bytes: BLACKLIST_SEED.to_vec() },
                    Seed::AccountData { account_index: 2, data_index: 32, length: 32 },
                ],
                false,
                false,
            )?,
        ];

        // Calculate account size
        let account_size = ExtraAccountMetaList::size_of(account_metas.len())? as u64;
        let lamports = Rent::get()?.minimum_balance(account_size as usize);

        let mint = ctx.accounts.mint.key();
        let signer_seeds: &[&[&[u8]]] = &[&[
            b"extra-account-metas",
            mint.as_ref(),
            &[ctx.bumps.extra_account_meta_list],
        ]];

        // Create the ExtraAccountMetaList account
        create_account(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                CreateAccount {
                    from: ctx.accounts.payer.to_account_info(),
                    to: ctx.accounts.extra_account_meta_list.to_account_info(),
                },
            )
            .with_signer(signer_seeds),
            lamports,
            account_size,
            ctx.program_id,
        )?;

        // Initialize the account data with extra account metas
        ExtraAccountMetaList::init::<ExecuteInstruction>(
            &mut ctx.accounts.extra_account_meta_list.try_borrow_mut_data()?,
            &account_metas,
        )?;

        msg!("ExtraAccountMetaList initialized for mint {}", mint);
        Ok(())
    }

    /// The transfer hook - called on every token transfer.
    /// Checks that neither sender nor recipient is blacklisted.
    pub fn transfer_hook(ctx: Context<TransferHook>, _amount: u64) -> Result<()> {
        // Verify this is actually being called during a transfer
        assert_is_transferring(&ctx)?;

        // Check sender blacklist PDA
        let sender_blacklist = &ctx.accounts.sender_blacklist;
        if !sender_blacklist.data_is_empty() {
            // Account exists - check if the address field is non-zero (active blacklist)
            let data = sender_blacklist.try_borrow_data()?;
            if data.len() >= 72 { // discriminator(8) + stablecoin(32) + address(32)
                let address_bytes = &data[40..72];
                let is_zeroed = address_bytes.iter().all(|&b| b == 0);
                if !is_zeroed {
                    msg!("Transfer blocked: sender is blacklisted");
                    return Err(error!(TransferHookError::SenderBlacklisted));
                }
            }
        }

        // Check recipient blacklist PDA
        let recipient_blacklist = &ctx.accounts.recipient_blacklist;
        if !recipient_blacklist.data_is_empty() {
            let data = recipient_blacklist.try_borrow_data()?;
            if data.len() >= 72 {
                let address_bytes = &data[40..72];
                let is_zeroed = address_bytes.iter().all(|&b| b == 0);
                if !is_zeroed {
                    msg!("Transfer blocked: recipient is blacklisted");
                    return Err(error!(TransferHookError::RecipientBlacklisted));
                }
            }
        }

        msg!("Transfer hook: transfer allowed");
        Ok(())
    }

    /// Fallback instruction handler for Token-2022 CPI compatibility.
    /// Matches the SPL Transfer Hook Interface discriminator.
    pub fn fallback<'info>(
        program_id: &Pubkey,
        accounts: &'info [AccountInfo<'info>],
        data: &[u8],
    ) -> Result<()> {
        let instruction = TransferHookInstruction::unpack(data)?;

        match instruction {
            TransferHookInstruction::Execute { amount } => {
                let amount_bytes = amount.to_le_bytes();
                __private::__global::transfer_hook(program_id, accounts, &amount_bytes)
            }
            _ => Err(ProgramError::InvalidInstructionData.into()),
        }
    }
}

/// Verify that the token transfer is actually in progress
fn assert_is_transferring(ctx: &Context<TransferHook>) -> Result<()> {
    let source_token_info = ctx.accounts.source_token.to_account_info();
    let account_data_ref = source_token_info.try_borrow_data()?;
    let mut data_vec = account_data_ref.as_ref().to_vec();
    let account = StateWithExtensionsMut::<Token2022Account>::unpack(
        &mut data_vec,
    );
    
    // If we can unpack and check extensions, verify transferring flag
    if let Ok(account) = account {
        if let Ok(hook_account) = account.get_extension::<TransferHookAccount>() {
            if !bool::from(hook_account.transferring) {
                return Err(error!(TransferHookError::NotTransferring));
            }
        }
    }

    Ok(())
}

#[derive(Accounts)]
pub struct InitializeExtraAccountMetaList<'info> {
    #[account(mut)]
    payer: Signer<'info>,

    /// CHECK: ExtraAccountMetaList account, must use these seeds
    #[account(
        mut,
        seeds = [b"extra-account-metas", mint.key().as_ref()],
        bump,
    )]
    pub extra_account_meta_list: AccountInfo<'info>,

    pub mint: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

/// Accounts for the transfer hook execution
/// Order matters - first 4 are from the token transfer, then ExtraAccountMetas
#[derive(Accounts)]
pub struct TransferHook<'info> {
    #[account(token::mint = mint, token::authority = owner)]
    pub source_token: InterfaceAccount<'info, TokenAccount>,

    pub mint: InterfaceAccount<'info, Mint>,

    #[account(token::mint = mint)]
    pub destination_token: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: source token account owner
    pub owner: UncheckedAccount<'info>,

    /// CHECK: ExtraAccountMetaList account
    #[account(
        seeds = [b"extra-account-metas", mint.key().as_ref()],
        bump,
    )]
    pub extra_account_meta_list: UncheckedAccount<'info>,

    /// CHECK: Sender blacklist PDA - may or may not exist
    #[account(
        seeds = [BLACKLIST_SEED, owner.key().as_ref()],
        bump,
    )]
    pub sender_blacklist: UncheckedAccount<'info>,

    /// CHECK: Recipient blacklist PDA - may or may not exist
    pub recipient_blacklist: UncheckedAccount<'info>,
}

#[error_code]
pub enum TransferHookError {
    #[msg("Sender is blacklisted")]
    SenderBlacklisted,
    #[msg("Recipient is blacklisted")]
    RecipientBlacklisted,
    #[msg("Token is not currently being transferred")]
    NotTransferring,
}
