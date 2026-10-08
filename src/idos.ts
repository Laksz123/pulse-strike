import { create } from "zustand";
import type { ClientState, IDosGamesClient, OperationFailure, OperationResult } from "@idosgames/core";

/** The game's title on iDos Games: accounts live there. */
export const TITLE_ID = "8C3Q33PG";
const KEY = "ps-account";

export type AccountKind = "guest" | "email" | "idos";

interface Saved {
  kind: AccountKind;
  /** The player's id on iDos Games; empty while the server has not been reached. */
  id: string;
  name: string;
  email: string;
}

interface AccountState extends Saved {
  status: "out" | "in";
  /** What is being waited for, in words; empty when idle. */
  busy: string;
  error: string;
  /** An address that was sent a code and is waiting for it to be typed in. */
  pending: string;
}

function saved(): Saved | null {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? "null") as Saved | null;
    return s && (s.kind === "guest" || s.kind === "email" || s.kind === "idos") ? s : null;
  } catch {
    return null;
  }
}

function keep(s: Saved | null): void {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {
    // Storage is closed (a private window): the choice lasts until the tab is shut.
  }
}

const NOBODY: Saved = { kind: "guest", id: "", name: "", email: "" };
const was = saved();

/**
 * Who is playing. A player who has chosen before is let straight in from what was remembered,
 * and the session is renewed behind the lobby — the game never waits for a server to be played.
 */
export const useAccount = create<AccountState>(() => ({ ...(was ?? NOBODY), status: was ? "in" : "out", busy: "", error: "", pending: "" }));

/**
 * Whether signing in through idosgames.com can be offered. The page leaves for the site and comes
 * back, which a frame cannot do, and the site only returns to the game's own address there.
 */
export const CAN_SSO = typeof window !== "undefined" && window.top === window.self && /(^|\.)idos\.games$/.test(location.hostname);

type Sdk = typeof import("@idosgames/core");
let sdk: Sdk | null = null;
let client: IDosGamesClient | null = null;

/** The SDK is a chunk of its own, fetched once the lobby is already on screen. */
async function idos(): Promise<IDosGamesClient> {
  if (!client) {
    const [core, platform] = await Promise.all([import("@idosgames/core"), import("@idosgames/core/platform")]);
    sdk = core;
    client = core.createIDosGamesClient({ titleID: TITLE_ID, platform: new platform.BrowserPlatformAdapter() });
    client.auth.setRememberSession(true);
  }
  return client;
}

const lost = (error: string): OperationFailure => ({ ok: false, reason: "connection", error });

/** One call to the server that always answers: a lost connection or a silent server is a failure like any other. */
async function ask<T>(call: (c: IDosGamesClient) => Promise<OperationResult<T>>, ms = 20000): Promise<OperationResult<T>> {
  try {
    const c = await idos();
    return await Promise.race([call(c), new Promise<OperationFailure>((done) => setTimeout(() => done(lost("timeout")), ms))]);
  } catch (e) {
    return lost(e instanceof Error ? e.message : String(e));
  }
}

/** The server's codes, in the player's words. It never says whether an address has an account. */
const WORDS: Record<string, string> = {
  INCORRECT_EMAIL_OR_PASSWORD: "Неверная почта или пароль.",
  INVALID_VERIFICATION_CODE: "Код не подошёл или устарел. Проверь его или запроси новый.",
  INVALID_INPUT_DATA: "Заполни почту и пароль.",
  RATE_LIMIT_EXCEEDED: "Слишком часто. Подожди пару секунд и попробуй ещё раз.",
  OPERATION_IN_PROGRESS: "Запрос уже выполняется. Подожди пару секунд.",
  EMAIL_SENDER_NOT_CONFIGURED: "Письма с кодом сейчас не отправляются. Играй как гость или войди через iDos Games.",
  INVALID_OR_USED_SSO_CODE: "Вход через iDos Games не завершился. Попробуй ещё раз.",
  BANNED_GLOBAL: "Этот аккаунт заблокирован.",
};

function explain(r: OperationFailure): string {
  if (r.reason === "connection") return "Нет связи с сервером. Проверь интернет и попробуй ещё раз.";
  if (r.reason === "throttled") return WORDS.RATE_LIMIT_EXCEEDED;
  return WORDS[r.error] ?? "Не получилось. Попробуй ещё раз.";
}

/** A player's id as shown to the player: its own part, without the title's id that every one of them ends with. */
export const shortId = (id: string) => (id.endsWith(TITLE_ID) ? id.slice(0, -TITLE_ID.length) : id).slice(0, 8).toUpperCase();

const set = useAccount.setState;
const fail = (error: string) => set({ busy: "", error });

function enter(kind: AccountKind, state: ClientState | null, email = ""): void {
  const id = client?.auth.context?.userID ?? state?.User?.UserID ?? "";
  const tag = id ? ` ${shortId(id).slice(-4)}` : "";
  const name = state?.User?.PublicData?.Username || (kind === "email" && email ? email.split("@")[0].slice(0, 16) : `${kind === "guest" ? "Гость" : "Игрок"}${tag}`);
  const me = { kind, id, name, email };
  keep(me);
  set({ ...me, status: "in", busy: "", error: "", pending: "" });
}

function leave(error = ""): void {
  client?.auth.logout();
  keep(null);
  set({ ...NOBODY, status: "out", busy: "", error, pending: "" });
}

let booted = false;

/** Run once when the lobby opens: finish a sign-in that went through idosgames.com, or renew the remembered session. */
export async function boot(): Promise<void> {
  if (booted) return;
  booted = true;
  let c: IDosGamesClient;
  try {
    c = await idos();
  } catch {
    return;
  }
  const back = CAN_SSO ? sdk!.readSsoCodeFromUrl() : null;
  if (back) {
    set({ status: "out", busy: "Входим…", error: "" });
    const r = await ask((x) => x.auth.loginWithSsoCode(back.code));
    if (r.ok) enter("idos", r.data);
    else leave(explain(r));
    return;
  }
  const me = useAccount.getState();
  if (me.status !== "in") return;
  // A remembered account whose session is gone must not be quietly swapped for this device's guest.
  if (me.kind !== "guest" && (c.auth.lastAuthType === "None" || c.auth.lastAuthType === "Device")) return leave("Сессия закончилась — войди снова.");
  const r = await ask((x) => x.auth.autoLogin());
  if (useAccount.getState().status !== "in") return;
  if (r.ok) enter(me.kind, r.data, me.email);
  else if (me.kind !== "guest" && r.reason !== "connection" && r.reason !== "throttled") leave("Сессия закончилась — войди снова.");
}

/** Play without an account: a guest tied to this device. With no server in reach the game opens all the same. */
export async function guest(): Promise<void> {
  set({ busy: "Входим…", error: "" });
  const r = await ask((c) => c.auth.loginWithDeviceID(), 8000);
  if (r.ok) return enter("guest", r.data);
  const me: Saved = { kind: "guest", id: "", name: "Гость", email: "" };
  keep(me);
  set({ ...me, status: "in", busy: "", error: "", pending: "" });
}

function checked(email: string, password: string): string {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Проверь почту: в адресе ошибка.";
  if (password.length < 8 || password.length > 100) return "Пароль — от 8 символов.";
  return "";
}

export async function login(email: string, password: string): Promise<void> {
  email = email.trim();
  const wrong = checked(email, password);
  if (wrong) return fail(wrong);
  set({ busy: "Входим…", error: "" });
  const r = await ask((c) => c.auth.loginWithEmail(email, password));
  if (r.ok) enter("email", r.data, email);
  else fail(explain(r));
}

/** Start an account: the server mails a code, and nothing exists until the code is typed in. */
export async function register(email: string, password: string): Promise<void> {
  email = email.trim();
  const wrong = checked(email, password);
  if (wrong) return fail(wrong);
  set({ busy: "Отправляем код…", error: "" });
  const r = await ask((c) => c.auth.registerWithEmail(email, password));
  if (r.ok) set({ busy: "", error: "", pending: email });
  else fail(explain(r));
}

export async function confirm(code: string): Promise<void> {
  const email = useAccount.getState().pending;
  code = code.trim();
  if (!email || !code) return fail("Введи код из письма.");
  set({ busy: "Проверяем код…", error: "" });
  const r = await ask((c) => c.auth.confirmEmailRegistration(email, code));
  if (r.ok) enter("email", r.data, email);
  else fail(explain(r));
}

export async function resend(): Promise<void> {
  const email = useAccount.getState().pending;
  if (!email) return;
  set({ busy: "Отправляем код…", error: "" });
  const r = await ask((c) => c.auth.resendVerificationCode(email));
  if (r.ok) set({ busy: "" });
  else fail(explain(r));
}

/** Back from the code to the form, to fix the address. */
export function retype(): void {
  set({ pending: "", error: "" });
}

/** Sign in with the account of idosgames.com: the page leaves for the site and comes back with a one-time code. */
export async function viaIdos(): Promise<void> {
  set({ busy: "Открываем iDos Games…", error: "" });
  try {
    await idos();
    sdk!.beginSsoRedirect({ titleID: TITLE_ID });
  } catch {
    fail("Не удалось открыть iDos Games. Попробуй ещё раз.");
  }
}

/** Sign out. What was earned stays on the device; the lobby asks again who is playing. */
export function logout(): void {
  leave();
}

/** Change the name other players see. Says what went wrong, or nothing when it worked. */
export async function rename(name: string): Promise<string> {
  name = name.trim();
  if (name.length < 3 || name.length > 16) return "Ник — от 3 до 16 символов.";
  const r = await ask((c) => c.user.changeUsername(name));
  if (!r.ok) return r.reason === "connection" ? explain(r) : "Этот ник занят или не подходит.";
  const me = useAccount.getState();
  const next = { kind: me.kind, id: me.id, name: r.data.Username || name, email: me.email };
  keep(next);
  set(next);
  return "";
}
