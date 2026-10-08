# PULSE STRIKE

A Counter-Strike-style team shooter that runs in a browser tab, on a desktop or a phone, with
nothing to install. Players earn cases by playing, open them for weapon skins, blades and agents,
and sell what they drop to each other for SOL.

**Play it:** https://pulse-strike-swart.vercel.app

Built for the Colosseum Crypto World's Fair hackathon, Superteam Kazakhstan track.

## What is in the game

- **Matches.** Bomb plant, team deathmatch and free-for-all against bots, on three hand-built
  maps (Oasis, Summit, Neon). Round money, a buy menu, grenades, a radar, team choice.
- **Weapons.** Sixteen paint markers, none of them an ordinary rifle: charges that bounce, stick,
  home in, split, arc. Ten blades with their own draw and inspect animations.
- **Items.** Skins, blades and agents are items with a serial number. They drop from ten kinds of
  cases — each shows what is inside, the odds and what it goes for — and from a battle pass with
  a free and a premium track.
- **Phones.** Touch controls, an interface that fits itself to the screen, lighter graphics.

## Solana

Devnet.

- **The premium pass** is bought with SOL from a wallet (Phantom, or a throwaway wallet the game
  keeps in the browser for trying it out).
- **The market** is where players sell items to each other: the buyer pays the seller directly
  and five percent goes to the treasury.

`programs/pulse_strike` is the Anchor program for both: a pass is an account that says a wallet
owns a season; a listing is an account that names an item and its price, and buying it pays the
seller, pays the fee and closes the listing in one transaction. Nothing is held in escrow.

`src/solana/chain.ts` is the client. It talks to the program when `PROGRAM_ID` is set; until the
program is deployed it uses plain transfers with Memo notes, a protocol described at the top of
that file. What is not on chain yet is the item itself: it lives in the player's profile.

## Running it

```bash
npm install
npm run dev
```

The game is then at http://localhost:5183. `npm run build` type-checks and builds it.

To build the program you need Rust, the Solana CLI and Anchor 0.30.1:

```bash
cargo-build-sbf --manifest-path programs/pulse_strike/Cargo.toml
```

## Made with

Vite, React, TypeScript, three.js, Rapier, zustand, `@solana/web3.js`, Anchor. Sound is
synthesised in the browser; weapon and agent icons are rendered from the same 3D models the match
uses.
