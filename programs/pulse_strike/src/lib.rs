//! PULSE STRIKE on Solana: the premium battle pass and the market where players sell what they
//! drop to each other.
//!
//! Everything here is small on purpose. A pass is an account that says "this wallet owns season
//! N" — the game reads it and opens the premium track. A listing is an account that says "this
//! wallet offers this item at this price"; buying it pays the seller directly, sends the market's
//! cut to the treasury and closes the listing in the same transaction. Nothing is held in escrow
//! and nobody can move a payment anywhere but to the seller and the treasury written below.
//!
//! What is not on chain yet is the item itself: it lives in the player's profile, and a listing
//! names it by weapon, skin and serial number.

use anchor_lang::prelude::*;
use anchor_lang::system_program::{self, Transfer};

// Replaced with the program's real address when it is deployed.
declare_id!("11111111111111111111111111111111");

/// Where the pass price and the market's cut go.
pub const TREASURY: Pubkey = anchor_lang::solana_program::pubkey!("691rAh7nKkyXAMrZfk2wmK453K2HkxQaKnjsrkEKrt4E");
/// The premium pass: 0.05 SOL a season.
pub const PASS_PRICE: u64 = 50_000_000;
/// The market keeps five percent of a sale.
pub const FEE_BPS: u64 = 500;
/// Nothing is listed for less than 0.001 SOL.
pub const MIN_PRICE: u64 = 1_000_000;
/// The longest item id a listing can carry.
pub const MAX_ITEM: usize = 24;

#[program]
pub mod pulse_strike {
    use super::*;

    /// Buys the premium pass for a season. The account this creates is the proof: it can only
    /// exist once per wallet and season, so a pass cannot be paid for twice.
    pub fn buy_pass(ctx: Context<BuyPass>, season: u16) -> Result<()> {
        pay(&ctx.accounts.player, &ctx.accounts.treasury, &ctx.accounts.system_program, PASS_PRICE)?;
        let pass = &mut ctx.accounts.pass;
        pass.owner = ctx.accounts.player.key();
        pass.season = season;
        pass.bought_at = Clock::get()?.unix_timestamp;
        pass.bump = ctx.bumps.pass;
        emit!(PassBought { owner: pass.owner, season });
        Ok(())
    }

    /// Puts an item up for sale. `nonce` only has to be different for each of a seller's
    /// listings; `kind` is 0 for a weapon skin and 1 for an agent.
    pub fn list(ctx: Context<List>, nonce: u64, kind: u8, item: String, skin: u16, serial: u32, price: u64) -> Result<()> {
        require!(price >= MIN_PRICE, MarketError::PriceTooLow);
        require!(kind <= 1, MarketError::UnknownKind);
        require!(!item.is_empty() && item.len() <= MAX_ITEM, MarketError::BadItem);
        let listing = &mut ctx.accounts.listing;
        listing.seller = ctx.accounts.seller.key();
        listing.nonce = nonce;
        listing.kind = kind;
        listing.item = item.clone();
        listing.skin = skin;
        listing.serial = serial;
        listing.price = price;
        listing.listed_at = Clock::get()?.unix_timestamp;
        listing.bump = ctx.bumps.listing;
        emit!(Listed { listing: listing.key(), seller: listing.seller, kind, item, skin, serial, price });
        Ok(())
    }

    /// Buys a listing: the seller is paid, the treasury takes its cut, and the listing is closed
    /// with its deposit going back to the seller — all or nothing.
    pub fn buy(ctx: Context<Buy>) -> Result<()> {
        let listing = &ctx.accounts.listing;
        let fee = listing.price.checked_mul(FEE_BPS).ok_or(MarketError::Overflow)? / 10_000;
        pay(&ctx.accounts.buyer, &ctx.accounts.seller, &ctx.accounts.system_program, listing.price - fee)?;
        pay(&ctx.accounts.buyer, &ctx.accounts.treasury, &ctx.accounts.system_program, fee)?;
        emit!(Sold {
            listing: listing.key(),
            seller: listing.seller,
            buyer: ctx.accounts.buyer.key(),
            kind: listing.kind,
            item: listing.item.clone(),
            skin: listing.skin,
            serial: listing.serial,
            price: listing.price,
        });
        Ok(())
    }

    /// The seller takes a listing back; its deposit is returned.
    pub fn cancel(ctx: Context<Cancel>) -> Result<()> {
        emit!(Cancelled { listing: ctx.accounts.listing.key(), seller: ctx.accounts.seller.key() });
        Ok(())
    }
}

/// Moves lamports from a signer to an address.
fn pay<'info>(from: &Signer<'info>, to: &UncheckedAccount<'info>, system: &Program<'info, System>, lamports: u64) -> Result<()> {
    system_program::transfer(CpiContext::new(system.to_account_info(), Transfer { from: from.to_account_info(), to: to.to_account_info() }), lamports)
}

#[derive(Accounts)]
#[instruction(season: u16)]
pub struct BuyPass<'info> {
    #[account(mut)]
    pub player: Signer<'info>,
    #[account(init, payer = player, space = 8 + Pass::INIT_SPACE, seeds = [b"pass", player.key().as_ref(), &season.to_le_bytes()], bump)]
    pub pass: Account<'info, Pass>,
    /// CHECK: only ever the treasury written into the program.
    #[account(mut, address = TREASURY)]
    pub treasury: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(nonce: u64)]
pub struct List<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,
    #[account(init, payer = seller, space = 8 + Listing::INIT_SPACE, seeds = [b"listing", seller.key().as_ref(), &nonce.to_le_bytes()], bump)]
    pub listing: Account<'info, Listing>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Buy<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    /// CHECK: must be the wallet that made the listing; it is paid and gets the listing's deposit back.
    #[account(mut, address = listing.seller)]
    pub seller: UncheckedAccount<'info>,
    #[account(
        mut,
        close = seller,
        seeds = [b"listing", listing.seller.as_ref(), &listing.nonce.to_le_bytes()],
        bump = listing.bump,
        constraint = listing.seller != buyer.key() @ MarketError::OwnListing,
    )]
    pub listing: Account<'info, Listing>,
    /// CHECK: only ever the treasury written into the program.
    #[account(mut, address = TREASURY)]
    pub treasury: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Cancel<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,
    #[account(mut, close = seller, has_one = seller, seeds = [b"listing", seller.key().as_ref(), &listing.nonce.to_le_bytes()], bump = listing.bump)]
    pub listing: Account<'info, Listing>,
}

/// A wallet owns the premium pass of a season.
#[account]
#[derive(InitSpace)]
pub struct Pass {
    pub owner: Pubkey,
    pub season: u16,
    pub bought_at: i64,
    pub bump: u8,
}

/// An item offered for sale.
#[account]
#[derive(InitSpace)]
pub struct Listing {
    pub seller: Pubkey,
    pub nonce: u64,
    /// 0 a weapon skin, 1 an agent.
    pub kind: u8,
    /// The weapon's or the agent's id in the game.
    #[max_len(MAX_ITEM)]
    pub item: String,
    pub skin: u16,
    pub serial: u32,
    /// Lamports.
    pub price: u64,
    pub listed_at: i64,
    pub bump: u8,
}

#[event]
pub struct PassBought {
    pub owner: Pubkey,
    pub season: u16,
}

#[event]
pub struct Listed {
    pub listing: Pubkey,
    pub seller: Pubkey,
    pub kind: u8,
    pub item: String,
    pub skin: u16,
    pub serial: u32,
    pub price: u64,
}

#[event]
pub struct Sold {
    pub listing: Pubkey,
    pub seller: Pubkey,
    pub buyer: Pubkey,
    pub kind: u8,
    pub item: String,
    pub skin: u16,
    pub serial: u32,
    pub price: u64,
}

#[event]
pub struct Cancelled {
    pub listing: Pubkey,
    pub seller: Pubkey,
}

#[error_code]
pub enum MarketError {
    #[msg("The price is below the minimum of 0.001 SOL")]
    PriceTooLow,
    #[msg("An item is a weapon skin (0) or an agent (1)")]
    UnknownKind,
    #[msg("The item id is empty or too long")]
    BadItem,
    #[msg("A seller cannot buy their own listing")]
    OwnListing,
    #[msg("The price is too large")]
    Overflow,
}
