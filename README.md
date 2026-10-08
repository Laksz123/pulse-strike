# PULSE STRIKE

A Counter-Strike-style team shooter that runs in a browser tab — desktop or phone, nothing to
install — where every skin a player drops is theirs to sell for SOL.

**[Play the live demo](https://pulse-strike-swart.vercel.app)** ·
**[Program on Solana devnet](https://explorer.solana.com/address/4ZHAWqT8mQvowMnt4LEA282koU1FhdUd9RL1htfmbg8V?cluster=devnet)**

Submission to the Colosseum Crypto World's Fair hackathon, Superteam Kazakhstan track.

| Name | Role | Contact |
| --- | --- | --- |
| Laksxe | Solo builder: game design, economy, direction of the build | [GitHub](https://github.com/Laksz123) |

## Problem and solution

**1. A good shooter is a 30 GB download.**
Most people who would try a new competitive shooter never get past the installer.
PULSE STRIKE opens from a link and plays in a browser tab, on a laptop or a phone, with touch
controls and graphics that scale themselves down for a weak device.

**2. Skins are never really the player's.**
In the big shooters an item can be sold only inside the publisher's store, on its terms.
Here a sale is a transaction between two wallets: the buyer pays the seller directly, the market
keeps five percent, and nothing is held in escrow.

**3. Trading cheap items does not survive fees.**
A skin worth a few cents cannot carry a card fee or a slow settlement.
On Solana a sale costs a fraction of a cent and settles in about a second, so a market for cheap
items makes sense.

## Why Solana

- **Cost.** Listing, buying and cancelling are each one small transaction; a five-percent fee on a
  cheap item is still more than the network takes.
- **Speed.** A purchase is confirmed while the player is still looking at the item.
- **Accounts as state.** A pass or a listing is simply an account of the program: the game reads
  the market straight from the chain, with no server of ours in between.
- **Wallets.** Phantom for players who have one; a throwaway wallet made in the browser for
  those who do not.

## Features

**The game**

- Bomb plant, team deathmatch and free-for-all against bots on three hand-built maps.
- Round money, a buy menu, grenades, a radar, team choice, hitboxes per body part.
- Sixteen paint markers, none of them an ordinary rifle: charges that bounce, stick, home in,
  split, arc. Ten blades with their own draw and inspect animations.
- Ten kinds of cases, each showing what is inside, the odds and what it goes for; a battle pass
  with a free and a premium track; daily and season missions.
- Phones: touch controls, an interface that fits the screen, lighter graphics.

**On chain**

- **Premium pass.** Bought with SOL; recorded as an account that says a wallet owns a season, so
  it cannot be paid for twice and comes back on any device.
- **Market.** A listing is an account naming an item, its serial number and its price. Buying it
  pays the seller, pays the fee and closes the listing in one transaction; the seller can take
  it back at any time.

## Tech stack

| Layer | Technology |
| --- | --- |
| On-chain program | Rust · Anchor 0.30 |
| Chain client | TypeScript · `@solana/web3.js` (instructions built by hand, listings read from program accounts) |
| Game | TypeScript · three.js · Rapier (WebAssembly physics) · Web Audio |
| Interface | React · zustand · Vite |
| Hosting | Vercel |
| Built with | Claude Code (AI coding agent) · OpenAI image generation for art |

## Architecture

```
┌────────────────────────┐        ┌──────────────────────────────┐
│  Browser               │        │  Solana devnet               │
│                        │        │                              │
│  Game (three.js,       │        │  pulse_strike program        │
│  Rapier, React)        │        │  ┌────────────────────────┐  │
│        │               │  buy   │  │ Pass     wallet+season │  │
│  Profile: items,       │  pass  │  ├────────────────────────┤  │
│  cases, pass progress  │───────▶│  │ Listing  item + price  │  │
│        │               │  list  │  └────────────────────────┘  │
│  src/solana/chain.ts   │  buy   │        │            │        │
│  wallet: Phantom or    │ cancel │     seller      treasury     │
│  in-browser            │◀───────│     (95%)        (5%)        │
└────────────────────────┘  read  └──────────────────────────────┘
```

- `programs/pulse_strike/src/lib.rs` — the program: `buy_pass`, `list`, `buy`, `cancel`.
- `src/solana/chain.ts` — builds the instructions and reads the order book from accounts.
- `src/solana/wallet.ts` — what the game calls: connect, buy the pass, sell, buy, unlist.
- `src/arena/` — the match: maps, bots, weapons, hit detection, rendering.
- `src/ui/` — menus, the pass, missions, cases, the market, the in-match HUD.

What is not on chain yet is the item itself: it lives in the player's profile, and a listing
names it by id and serial number.

## Quick start

Prerequisites: Node.js 20+.

```bash
git clone https://github.com/Laksz123/pulse-strike
cd pulse-strike
npm install
npm run dev
```

The game is then at http://localhost:5183. `npm run build` type-checks and builds it.

To build the program you also need Rust and the Solana CLI:

```bash
cargo-build-sbf --manifest-path programs/pulse_strike/Cargo.toml
```

To try the Solana parts in the game, open the Market, press "Тестовый кошелёк" (test wallet) and send that address
some devnet SOL from https://faucet.solana.com.

## Roadmap

- [x] Playable shooter in the browser, desktop and phone
- [x] Cases, battle pass, missions
- [x] Premium pass and player-to-player market as a Solana program on devnet
- [ ] Items as on-chain assets, held by the program while listed
- [ ] Matches between players, not only against bots
- [ ] Mainnet

## Resources

- Live game: https://pulse-strike-swart.vercel.app
- Program: `4ZHAWqT8mQvowMnt4LEA282koU1FhdUd9RL1htfmbg8V` (devnet)
