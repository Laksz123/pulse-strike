/** The connected wallet, and what the game does with it. */

import { create } from "zustand";
import { SEASON } from "../arena/pass";
import { COIN_PACKS } from "../arena/shop";
import { useStore } from "../store";
import {
  LIST_FEE_SOL, airdrop, balance, buyTx, cancelTx, coinsTx, connectBurner, connectPhantom, fetchBook, findPass, listTx, passTx, sol, type Book, type Listing, type Wallet,
} from "./chain";

interface WalletState {
  wallet: Wallet | null;
  balance: number | null;
  busy: string;
  error: string;
  book: Book | null;
  /** Last confirmed transaction, to link to the explorer. */
  lastSig: string;
}

export const useWallet = create<WalletState>(() => ({ wallet: null, balance: null, busy: "", error: "", book: null, lastSig: "" }));

const say = (e: unknown) => {
  const text = e instanceof Error ? e.message : String(e);
  if (/User rejected|rejected the request/i.test(text)) return "Транзакция отменена в кошельке";
  if (/429|rate limit|airdrop/i.test(text)) return "Кран devnet сейчас не даёт SOL. Попробуй позже или возьми на faucet.solana.com";
  if (/insufficient|debit an account|0x1\b/i.test(text)) return "На кошельке не хватает SOL";
  if (/Failed to fetch|NetworkError/i.test(text)) return "Нет связи с сетью Solana";
  return text;
};

async function run<T>(label: string, job: () => Promise<T>): Promise<T | null> {
  useWallet.setState({ busy: label, error: "" });
  try {
    return await job();
  } catch (e) {
    useWallet.setState({ error: say(e) });
    return null;
  } finally {
    useWallet.setState({ busy: "" });
  }
}

export async function refreshBalance(): Promise<void> {
  const w = useWallet.getState().wallet;
  if (!w) return;
  try {
    useWallet.setState({ balance: await balance(w.address) });
  } catch {
    // The balance is a convenience: failing to read it should not break anything.
  }
}

export async function connect(kind: "phantom" | "burner"): Promise<void> {
  const w = await run("Подключаем кошелёк…", async () => (kind === "phantom" ? connectPhantom() : connectBurner()));
  if (!w) return;
  useWallet.setState({ wallet: w });
  useStore.setState({ wallet: w.address });
  void refreshBalance();
  // A pass bought earlier with this wallet comes back on any device.
  if (!useStore.getState().premium) {
    try {
      const sig = await findPass(w.address, SEASON.priceSol);
      if (sig) useStore.setState({ premium: true, premiumSig: sig });
    } catch {
      // Not critical.
    }
  }
}

export function disconnect(): void {
  useWallet.setState({ wallet: null, balance: null, error: "" });
  useStore.setState({ wallet: null });
}

export async function faucet(): Promise<void> {
  const w = useWallet.getState().wallet;
  if (!w) return;
  await run("Просим тестовые SOL…", () => airdrop(w.address));
  await refreshBalance();
}

/** Buys the premium track of the season pass. */
export async function buyPremium(): Promise<boolean> {
  const w = useWallet.getState().wallet;
  if (!w) {
    useWallet.setState({ error: "Сначала подключи кошелёк" });
    return false;
  }
  const sig = await run("Покупаем пропуск…", () => w.send(passTx(w.address, SEASON.priceSol)));
  if (!sig) return false;
  useStore.setState({ premium: true, premiumSig: sig });
  useWallet.setState({ lastSig: sig });
  useStore.getState().toast("Премиум-пропуск активирован", "#ffb81a");
  void refreshBalance();
  return true;
}

/** Buys a pack of coins for SOL. */
export async function buyCoins(id: string): Promise<boolean> {
  const w = useWallet.getState().wallet;
  const pack = COIN_PACKS.find((p) => p.id === id);
  if (!pack) return false;
  if (!w) {
    useWallet.setState({ error: "Сначала подключи кошелёк в разделе «Маркет»" });
    return false;
  }
  const sig = await run("Покупаем монеты…", () => w.send(coinsTx(w.address, pack.id, pack.sol)));
  if (!sig) return false;
  const s = useStore.getState();
  useStore.setState({ salt: s.salt + pack.coins });
  useWallet.setState({ lastSig: sig });
  s.toast(`+${pack.coins} монет`, "#ffd24a");
  void refreshBalance();
  return true;
}

/** Reads the order book and settles what happened to the player's own listings. */
export async function loadBook(): Promise<void> {
  const book = await run("Читаем маркет из сети…", fetchBook);
  if (!book) return;
  useWallet.setState({ book });
  const s = useStore.getState();
  const still = s.listed.filter((l) => {
    if (book.sold[l.sig]) {
      s.toast(`Продано за ${l.price} SOL`, "#4fc24a");
      return false;
    }
    return true;
  });
  if (still.length !== s.listed.length) useStore.setState({ listed: still });
}

export async function sell(kind: "w" | "a", uid: string, priceSol: number): Promise<boolean> {
  const w = useWallet.getState().wallet;
  const s = useStore.getState();
  if (!w) {
    useWallet.setState({ error: "Сначала подключи кошелёк" });
    return false;
  }
  const weapon = kind === "w" ? s.markers.find((m) => m.uid === uid) : undefined;
  const agent = kind === "a" ? s.agents.find((a) => a.uid === uid) : undefined;
  const item = weapon ? { kind, id: weapon.id, skin: weapon.skin, serial: weapon.serial } : agent && !agent.starter ? { kind, id: agent.id, skin: 0, serial: agent.serial } : null;
  if (!item || !(priceSol >= 0.001)) {
    useWallet.setState({ error: "Укажи цену от 0.001 SOL" });
    return false;
  }
  const sig = await run("Выставляем на маркет…", () => w.send(listTx(w.address, item, priceSol)));
  if (!sig) return false;
  // The item leaves the inventory for as long as it is on sale.
  const now = useStore.getState();
  const equipped = { ...now.equipped };
  if (weapon && equipped[weapon.id] === uid) delete equipped[weapon.id];
  const agents = now.agents.filter((a) => a.uid !== uid);
  useStore.setState({
    markers: now.markers.filter((m) => m.uid !== uid), agents, equipped, agent: now.agent === uid ? agents[0].uid : now.agent, knife: now.knife === uid ? "" : now.knife,
    listed: [...now.listed, { sig, ...item, price: priceSol }],
  });
  useWallet.setState({ lastSig: sig });
  now.toast(`Выставлено за ${priceSol} SOL · сбор ${LIST_FEE_SOL} SOL`, "#4fc24a");
  void refreshBalance();
  void loadBook();
  return true;
}

export async function buy(l: Listing): Promise<boolean> {
  const w = useWallet.getState().wallet;
  if (!w) {
    useWallet.setState({ error: "Сначала подключи кошелёк" });
    return false;
  }
  if (l.seller === w.address) {
    useWallet.setState({ error: "Это твой лот" });
    return false;
  }
  const sig = await run("Покупаем…", async () => {
    // Someone may have been quicker.
    const fresh = await fetchBook();
    if (!fresh.open.some((x) => x.sig === l.sig)) throw new Error("Лот уже продан или снят");
    return w.send(buyTx(w.address, l));
  });
  if (!sig) return false;
  const s = useStore.getState();
  s.grant(l.kind === "w" ? { kind: "skin", id: l.id, skin: l.skin } : { kind: "agent", id: l.id }, l.serial);
  useWallet.setState({ lastSig: sig });
  s.toast(`Куплено за ${sol(l.lamports)} SOL`, "#4fc24a");
  void refreshBalance();
  void loadBook();
  return true;
}

export async function unlist(sig: string): Promise<boolean> {
  const w = useWallet.getState().wallet;
  const s = useStore.getState();
  const mine = s.listed.find((l) => l.sig === sig);
  if (!w || !mine) return false;
  const done = await run("Снимаем с продажи…", () => w.send(cancelTx(w.address, { sig })));
  if (!done) return false;
  useStore.setState({ listed: useStore.getState().listed.filter((l) => l.sig !== sig) });
  useStore.getState().grant(mine.kind === "w" ? { kind: "skin", id: mine.id, skin: mine.skin } : { kind: "agent", id: mine.id }, mine.serial);
  useWallet.setState({ lastSig: done });
  void refreshBalance();
  void loadBook();
  return true;
}
