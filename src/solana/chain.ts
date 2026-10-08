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

export const connection = new Connection(clusterApiUrl(CLUSTER), "confirmed");
export const explorer = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=${CLUSTER}`;
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
  return new Transaction().add(pay(from, TREASURY, priceSol * LAMPORTS_PER_SOL), memo(PASS_MEMO, from));
}

/** Looks on chain for this wallet's payment for the season pass; returns its signature. */
export async function findPass(address: string, priceSol: number): Promise<string | null> {
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

export function listTx(seller: string, item: { kind: "w" | "a"; id: string; skin: number; serial: number }, priceSol: number): Transaction {
  const from = new PublicKey(seller);
  const note = `pulse:list:${item.kind}:${item.id}:${item.skin}:${item.serial}:${Math.round(priceSol * LAMPORTS_PER_SOL)}:${seller}`;
  return new Transaction().add(pay(from, TREASURY, LIST_FEE_SOL * LAMPORTS_PER_SOL), memo(note, from));
}

export function buyTx(buyer: string, l: Listing): Transaction {
  const from = new PublicKey(buyer);
  const fee = Math.round(l.lamports * MARKET_FEE);
  return new Transaction().add(pay(from, new PublicKey(l.seller), l.lamports - fee), pay(from, TREASURY, fee), memo(`pulse:buy:${l.sig}`, from));
}

export function cancelTx(seller: string, l: { sig: string }): Transaction {
  const from = new PublicKey(seller);
  return new Transaction().add(pay(from, TREASURY, 5000), memo(`pulse:cancel:${l.sig}`, from));
}

/** Rebuilds the order book from the treasury's transaction history. */
export async function fetchBook(): Promise<Book> {
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
