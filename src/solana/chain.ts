/**
 * Solana: the wallet, the premium battle pass and the item market. Devnet.
 *
 * There is no custom program yet, so everything is built from two stock ones: System (SOL moves
 * from wallet to wallet) and Memo (a signed note attached to the transaction). The market is a
 * public log of such notes addressed to the treasury:
 *   pulse:list:<kind>:<id>:<skin>:<serial>:<lamports>:<seller>   an item is offered
 *   pulse:buy:<listing signature>                                 it is bought: the same transaction pays the seller
 *   pulse:cancel:<listing signature>                              the seller takes it back
 * Anyone can rebuild the order book from the chain; payment goes straight from buyer to seller,
 * with a 5% fee to the treasury. What is not on chain yet is the item itself: it lives in the
 * player's profile, and becomes an NFT held in escrow once the contract is deployed.
 */

import { Buffer } from "buffer";
import {
  Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, TransactionInstruction, clusterApiUrl,
  type ParsedInstruction, type ParsedTransactionWithMeta,
} from "@solana/web3.js";

export const CLUSTER = "devnet";
export const TREASURY = new PublicKey("691rAh7nKkyXAMrZfk2wmK453K2HkxQaKnjsrkEKrt4E");
const MEMO = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
export const PASS_MEMO = "pulse:pass:s1";
export const MARKET_FEE = 0.05;
export const LIST_FEE_SOL = 0.001;
const BURNER_KEY = "pulse.burner.v1";

/**
 * The game's own program on devnet (`programs/pulse_strike`): the premium pass and the market live
 * in it as accounts. With this left empty everything below falls back to plain transfers with
 * Memo notes, the protocol described at the top of this file, which is how it worked before.
 */
export const PROGRAM_ID = "4ZHAWqT8mQvowMnt4LEA282koU1FhdUd9RL1htfmbg8V";
const PROGRAM = PROGRAM_ID ? new PublicKey(PROGRAM_ID) : null;
export const onProgram = () => PROGRAM !== null;
const SEASON_NO = 1;

export const connection = new Connection(clusterApiUrl(CLUSTER), "confirmed");
/** A link to a transaction, or to an account when given an address instead of a signature. */
export const explorer = (sig: string) => `https://explorer.solana.com/${sig.length < 60 ? "address" : "tx"}/${sig}?cluster=${CLUSTER}`;

// How Anchor names things on the wire: the first eight bytes of a hash of the name.
const IX = {
  buyPass: [57, 144, 218, 182, 67, 42, 234, 124],
  list: [54, 174, 193, 67, 17, 41, 132, 38],
  buy: [102, 6, 61, 18, 1, 218, 235, 234],
  cancel: [232, 219, 223, 41, 219, 236, 220, 190],
};
/** The mark every listing account starts with, in the form the RPC filter wants. */
const LISTING_MARK = "dV6QTCMAagy";
const u16 = (n: number) => {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n, 0);
  return b;
};
const u32 = (n: number) => {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n, 0);
  return b;
};
const u64 = (n: bigint | number) => {
  const b = Buffer.alloc(8);
  new DataView(b.buffer, b.byteOffset, 8).setBigUint64(0, BigInt(n), true);
  return b;
};
const text = (t: string) => Buffer.concat([u32(Buffer.byteLength(t, "utf8")), Buffer.from(t, "utf8")]);
const signer = (pubkey: PublicKey) => ({ pubkey, isSigner: true, isWritable: true });
const writable = (pubkey: PublicKey) => ({ pubkey, isSigner: false, isWritable: true });
const SYSTEM = { pubkey: SystemProgram.programId, isSigner: false, isWritable: false };
const call = (name: keyof typeof IX, keys: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[], ...args: Buffer[]) =>
  new TransactionInstruction({ programId: PROGRAM!, keys, data: Buffer.concat([Buffer.from(IX[name]), ...args]) });
const passAddress = (owner: PublicKey) => PublicKey.findProgramAddressSync([Buffer.from("pass"), owner.toBuffer(), u16(SEASON_NO)], PROGRAM!)[0];
export const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;
export const sol = (lamports: number) => lamports / LAMPORTS_PER_SOL;

export interface Wallet {
  kind: "phantom" | "burner";
  address: string;
  /** Signs and sends; resolves with the signature once the network confirms it. */
  send(tx: Transaction): Promise<string>;
}

interface PhantomProvider {
  isPhantom?: boolean;
  publicKey: PublicKey | null;
  connect(opts?: { onlyIfTrusted?: boolean }): Promise<{ publicKey: PublicKey }>;
  disconnect(): Promise<void>;
  signAndSendTransaction(tx: Transaction): Promise<{ signature: string }>;
}

function phantom(): PhantomProvider | null {
  const w = window as unknown as { phantom?: { solana?: PhantomProvider }; solana?: PhantomProvider };
  const p = w.phantom?.solana ?? w.solana;
  return p?.isPhantom ? p : null;
}

export const hasPhantom = () => phantom() !== null;

async function prepare(tx: Transaction, payer: PublicKey): Promise<{ blockhash: string; lastValidBlockHeight: number }> {
  const latest = await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = latest.blockhash;
  tx.feePayer = payer;
  return latest;
}

async function confirm(signature: string, latest: { blockhash: string; lastValidBlockHeight: number }): Promise<string> {
  const res = await connection.confirmTransaction({ signature, ...latest }, "confirmed");
  if (res.value.err) throw new Error("Сеть отклонила транзакцию");
  return signature;
}

export async function connectPhantom(): Promise<Wallet> {
  const p = phantom();
  if (!p) throw new Error("Phantom не найден: установи расширение и переключи его на Devnet");
  const { publicKey } = await p.connect();
  return {
    kind: "phantom", address: publicKey.toBase58(),
    send: async (tx) => {
      const latest = await prepare(tx, publicKey);
      const { signature } = await p.signAndSendTransaction(tx);
      return confirm(signature, latest);
    },
  };
}

/** A throwaway devnet wallet kept in this browser: lets anyone try the market without an extension. */
export function connectBurner(): Wallet {
  let kp: Keypair;
  try {
    const saved = localStorage.getItem(BURNER_KEY);
    kp = saved ? Keypair.fromSecretKey(Uint8Array.from(JSON.parse(saved) as number[])) : Keypair.generate();
    if (!saved) localStorage.setItem(BURNER_KEY, JSON.stringify(Array.from(kp.secretKey)));
  } catch {
    kp = Keypair.generate();
  }
  return {
    kind: "burner", address: kp.publicKey.toBase58(),
    send: async (tx) => {
      const latest = await prepare(tx, kp.publicKey);
      tx.sign(kp);
      return confirm(await connection.sendRawTransaction(tx.serialize()), latest);
    },
  };
}

export async function balance(address: string): Promise<number> {
  return sol(await connection.getBalance(new PublicKey(address)));
}

/** Asks the devnet faucet for test SOL. The faucet is rate-limited and often says no. */
export async function airdrop(address: string): Promise<void> {
  const latest = await connection.getLatestBlockhash("confirmed");
  await confirm(await connection.requestAirdrop(new PublicKey(address), LAMPORTS_PER_SOL), latest);
}

function memo(text: string, signer: PublicKey): TransactionInstruction {
  return new TransactionInstruction({ programId: MEMO, keys: [{ pubkey: signer, isSigner: true, isWritable: false }], data: Buffer.from(text, "utf8") });
}

function pay(from: PublicKey, to: PublicKey, lamports: number): TransactionInstruction {
  return SystemProgram.transfer({ fromPubkey: from, toPubkey: to, lamports: Math.round(lamports) });
}

/** Lamports a transaction moved into `to`, and who paid for it. */
function received(tx: ParsedTransactionWithMeta | null, to: string): { payer: string; lamports: number } | null {
  if (!tx || tx.meta?.err) return null;
  const keys = tx.transaction.message.accountKeys;
  let lamports = 0;
  for (const ix of tx.transaction.message.instructions) {
    const p = (ix as ParsedInstruction).parsed as { type?: string; info?: { destination?: string; lamports?: number } } | undefined;
    if (p?.type === "transfer" && p.info?.destination === to) lamports += p.info.lamports ?? 0;
  }
  return { payer: keys[0].pubkey.toBase58(), lamports };
}

/** Strips the "[length] " prefix RPC nodes put before a memo. */
const memoText = (m: string | null | undefined) => (m ?? "").replace(/^\[\d+\]\s*/, "");

// ---------------------------------------------------------------------------------------------
// Battle pass

export function passTx(buyer: string, priceSol: number): Transaction {
  const from = new PublicKey(buyer);
  // Through the program the price is the program's own; the pass becomes an account anyone can check.
  if (PROGRAM) return new Transaction().add(call("buyPass", [signer(from), writable(passAddress(from)), writable(TREASURY), SYSTEM], u16(SEASON_NO)));
  return new Transaction().add(pay(from, TREASURY, priceSol * LAMPORTS_PER_SOL), memo(PASS_MEMO, from));
}

/** Looks on chain for this wallet's payment for the season pass; returns its signature. */
export async function findPass(address: string, priceSol: number): Promise<string | null> {
  if (PROGRAM) {
    const pass = passAddress(new PublicKey(address));
    if (await connection.getAccountInfo(pass)) return (await connection.getSignaturesForAddress(pass, { limit: 1 }))[0]?.signature ?? pass.toBase58();
  }
  const sigs = await connection.getSignaturesForAddress(new PublicKey(address), { limit: 200 });
  for (const s of sigs) {
    if (s.err || !memoText(s.memo).includes(PASS_MEMO)) continue;
    const got = received(await connection.getParsedTransaction(s.signature, { maxSupportedTransactionVersion: 0 }), TREASURY.toBase58());
    if (got && got.payer === address && got.lamports >= priceSol * LAMPORTS_PER_SOL * 0.999) return s.signature;
  }
  return null;
}

/** Coins bought with SOL: a transfer to the treasury with a note of which pack. */
export function coinsTx(buyer: string, pack: string, priceSol: number): Transaction {
  const from = new PublicKey(buyer);
  return new Transaction().add(pay(from, TREASURY, priceSol * LAMPORTS_PER_SOL), memo(`pulse:coins:${pack}`, from));
}

// ---------------------------------------------------------------------------------------------
// Market

export interface Listing {
  sig: string;
  seller: string;
  kind: "w" | "a";
  id: string;
  skin: number;
  serial: number;
  lamports: number;
  time: number;
}

export interface Book {
  open: Listing[];
  /** Listing signature to the buyer's address, for sales that went through. */
  sold: Record<string, string>;
  cancelled: string[];
}

/** The address of the listing a transaction from `listTx` will create, when it goes through the program. */
let lastListing: string | null = null;
export const listedAs = () => lastListing;

export function listTx(seller: string, item: { kind: "w" | "a"; id: string; skin: number; serial: number }, priceSol: number): Transaction {
  const from = new PublicKey(seller);
  lastListing = null;
  if (PROGRAM) {
    // Any number the seller has not used before: the listing's address is made from it.
    const nonce = BigInt(Date.now()) * 1000n + BigInt(Math.floor(Math.random() * 1000));
    const listing = PublicKey.findProgramAddressSync([Buffer.from("listing"), from.toBuffer(), u64(nonce)], PROGRAM)[0];
    lastListing = listing.toBase58();
    return new Transaction().add(
      call("list", [signer(from), writable(listing), SYSTEM], u64(nonce), Buffer.from([item.kind === "a" ? 1 : 0]), text(item.id), u16(item.skin), u32(item.serial), u64(Math.round(priceSol * LAMPORTS_PER_SOL))),
    );
  }
  const note = `pulse:list:${item.kind}:${item.id}:${item.skin}:${item.serial}:${Math.round(priceSol * LAMPORTS_PER_SOL)}:${seller}`;
  return new Transaction().add(pay(from, TREASURY, LIST_FEE_SOL * LAMPORTS_PER_SOL), memo(note, from));
}

export function buyTx(buyer: string, l: Listing): Transaction {
  const from = new PublicKey(buyer);
  if (PROGRAM) return new Transaction().add(call("buy", [signer(from), writable(new PublicKey(l.seller)), writable(new PublicKey(l.sig)), writable(TREASURY), SYSTEM]));
  const fee = Math.round(l.lamports * MARKET_FEE);
  return new Transaction().add(pay(from, new PublicKey(l.seller), l.lamports - fee), pay(from, TREASURY, fee), memo(`pulse:buy:${l.sig}`, from));
}

export function cancelTx(seller: string, l: { sig: string }): Transaction {
  const from = new PublicKey(seller);
  if (PROGRAM) return new Transaction().add(call("cancel", [signer(from), writable(new PublicKey(l.sig))]));
  return new Transaction().add(pay(from, TREASURY, 5000), memo(`pulse:cancel:${l.sig}`, from));
}

/** The order book as the program holds it: every listing is an account. `mine` are listings to ask after if they are gone. */
async function programBook(mine: string[]): Promise<Book> {
  const accounts = await connection.getProgramAccounts(PROGRAM!, { filters: [{ memcmp: { offset: 0, bytes: LISTING_MARK } }] });
  const open: Listing[] = [];
  for (const { pubkey, account } of accounts) {
    const d = Buffer.from(account.data);
    const view = new DataView(d.buffer, d.byteOffset, d.byteLength);
    const len = d.readUInt32LE(49);
    const o = 53 + len;
    open.push({
      sig: pubkey.toBase58(), seller: new PublicKey(d.subarray(8, 40)).toBase58(), kind: d[48] === 1 ? "a" : "w", id: d.toString("utf8", 53, o),
      skin: d.readUInt16LE(o), serial: d.readUInt32LE(o + 2), lamports: Number(view.getBigUint64(o + 6, true)), time: Number(view.getBigInt64(o + 14, true)),
    });
  }
  open.sort((a, b) => b.time - a.time);
  // A listing of ours that is no longer there was closed: by a buyer who paid for it, or by us.
  const sold: Record<string, string> = {};
  const cancelled: string[] = [];
  for (const id of mine) {
    if (id.length >= 60 || open.some((l) => l.sig === id)) continue;
    const last = (await connection.getSignaturesForAddress(new PublicKey(id), { limit: 3 })).find((x) => !x.err);
    const tx = last && (await connection.getParsedTransaction(last.signature, { maxSupportedTransactionVersion: 0 }));
    if (!tx) continue;
    const keys = tx.transaction.message.accountKeys.map((k) => k.pubkey.toBase58());
    // A sale is the only thing that brings the treasury into a transaction with a listing.
    if (keys.includes(TREASURY.toBase58())) sold[id] = keys[0];
    else cancelled.push(id);
  }
  return { open, sold, cancelled };
}

/** Rebuilds the order book: from the program's accounts, or — before it is deployed — from the treasury's transaction history. */
export async function fetchBook(mine: string[] = []): Promise<Book> {
  if (PROGRAM) return programBook(mine);
  const sigs = (await connection.getSignaturesForAddress(TREASURY, { limit: 400 })).filter((s) => !s.err).reverse();
  const listings = new Map<string, Listing>();
  const claims: { sig: string; target: string; type: "buy" | "cancel" }[] = [];
  for (const s of sigs) {
    const text = memoText(s.memo);
    const p = text.split(":");
    if (p[0] !== "pulse") continue;
    if (p[1] === "list" && p.length >= 8 && (p[2] === "w" || p[2] === "a")) {
      const lamports = Number(p[6]);
      if (!Number.isFinite(lamports) || lamports <= 0) continue;
      listings.set(s.signature, { sig: s.signature, kind: p[2], id: p[3], skin: Number(p[4]) || 0, serial: Number(p[5]) || 0, lamports, seller: p[7], time: s.blockTime ?? 0 });
    } else if ((p[1] === "buy" || p[1] === "cancel") && p[2]) claims.push({ sig: s.signature, target: p[2], type: p[1] });
  }
  const sold: Record<string, string> = {};
  const cancelled: string[] = [];
  // A claim counts only if the chain agrees: the seller signed the cancel, the buyer really paid the seller.
  for (const c of claims) {
    const l = listings.get(c.target);
    if (!l || sold[l.sig] || cancelled.includes(l.sig)) continue;
    const tx = await connection.getParsedTransaction(c.sig, { maxSupportedTransactionVersion: 0 });
    if (c.type === "cancel") {
      if (received(tx, TREASURY.toBase58())?.payer === l.seller) cancelled.push(l.sig);
    } else {
      const got = received(tx, l.seller);
      if (got && got.lamports >= l.lamports * (1 - MARKET_FEE) - 1) sold[l.sig] = got.payer;
    }
  }
  const open = [...listings.values()].filter((l) => !sold[l.sig] && !cancelled.includes(l.sig)).sort((a, b) => b.time - a.time);
  return { open, sold, cancelled };
}
