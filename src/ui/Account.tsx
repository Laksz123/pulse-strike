import { useEffect, useState, type KeyboardEvent } from "react";
import { agentIcon } from "../arena/render";
import { sfx } from "../game/audio";
import { CAN_SSO, boot, confirm, guest, login, logout, register, rename, resend, retype, shortId, useAccount, viaIdos } from "../idos";
import { short } from "../solana/chain";
import { connect, disconnect, useWallet } from "../solana/wallet";
import { PhantomButton } from "./Phantom";

/**
 * Enter in a field does what the button beside it does. These are not forms: the page of
 * iDos Games shows the game in a frame where forms are not allowed to be sent.
 */
const onEnter = (run: () => void) => (e: KeyboardEvent) => {
  if (e.key === "Enter") run();
};

/** The wallet row: the same two ways in as on the market, or the address once one is connected. */
function WalletRow() {
  const wallet = useWallet((w) => w.wallet);
  const balance = useWallet((w) => w.balance);
  const busy = useWallet((w) => w.busy);
  if (wallet) {
    return (
      <div className="ac-wallet on">
        <i />
        <span><b>{short(wallet.address)}</b>{balance !== null && <small>{balance.toFixed(3)} SOL</small>}</span>
        <button onClick={() => { sfx.back(); disconnect(); }}>Отключить</button>
      </div>
    );
  }
  return (
    <div className="ac-wallet">
      <i />
      <span><b>Кошелёк Solana</b><small>для маркета и премиума</small></span>
      <PhantomButton className="sol" />
      <button disabled={!!busy} onClick={() => void connect("burner")} title="Создаётся прямо здесь и хранится в этом браузере">Тестовый</button>
    </div>
  );
}

/** The code from the letter: the last step of making an account. */
function Code() {
  const email = useAccount((a) => a.pending);
  const busy = useAccount((a) => a.busy);
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const submit = () => void confirm(code);
  return (
    <div className="ac-form">
      <b className="ac-title">Код из письма</b>
      <p>Отправили код на <b>{email}</b>. Письмо приходит за минуту; загляни и в «Спам».</p>
      <input className="ac-code" inputMode="numeric" autoComplete="one-time-code" maxLength={8} placeholder="000000" value={code} autoFocus onChange={(e) => setCode(e.target.value.replace(/\s/g, ""))} onKeyDown={onEnter(submit)} />
      <button className="ac-submit" disabled={!!busy || code.length < 4} onClick={submit}><b className="toon">{busy || "Подтвердить"}</b></button>
      <div className="ac-links">
        <button type="button" onClick={retype}>← Другая почта</button>
        <button type="button" disabled={!!busy} onClick={() => { setSent(true); void resend(); }}>{sent ? "Отправили ещё раз" : "Отправить код ещё раз"}</button>
      </div>
    </div>
  );
}

/** Signing in or making an account: the same two fields, and a switch between the two. */
function Form() {
  const busy = useAccount((a) => a.busy);
  const [fresh, setFresh] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const submit = () => void (fresh ? register(email, password) : login(email, password));
  const tab = (to: boolean) => () => {
    sfx.click();
    setFresh(to);
    useAccount.setState({ error: "" });
  };
  return (
    <div className="ac-form">
      <div className="ac-tabs">
        <button type="button" className={fresh ? "" : "on"} onClick={tab(false)}>Вход</button>
        <button type="button" className={fresh ? "on" : ""} onClick={tab(true)}>Регистрация</button>
      </div>
      <input type="email" autoComplete="email" placeholder="Почта" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={onEnter(submit)} />
      <input type="password" autoComplete={fresh ? "new-password" : "current-password"} placeholder={fresh ? "Пароль — от 8 символов" : "Пароль"} value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={onEnter(submit)} />
      <button className="ac-submit" disabled={!!busy} onClick={submit}><b className="toon">{busy || (fresh ? "Создать аккаунт" : "Войти")}</b></button>
      {CAN_SSO && <button type="button" className="ac-sso" disabled={!!busy} onClick={() => void viaIdos()}>Войти через iDos Games</button>}
    </div>
  );
}

/**
 * Who is playing: asked once, before the lobby. A guest goes straight in; an account — kept by
 * iDos Games — is made with a letter and a code, or signed into. The wallet is connected here too.
 */
export function AccountGate() {
  const status = useAccount((a) => a.status);
  const busy = useAccount((a) => a.busy);
  const error = useAccount((a) => a.error);
  const pending = useAccount((a) => a.pending);
  useEffect(() => void boot(), []);
  if (status === "in") return null;
  return (
    <div className="ac">
      <div className="ac-card">
        <header className="ac-head">
          <small>Pulse Strike</small>
          <h2 className="toon">Кто играет?</h2>
        </header>
        <div className="ac-cols">
          <section className="ac-guest">
            <div className="ac-face"><img src={agentIcon("rookie")} alt="" draggable={false} /></div>
            <b className="ac-title">Гость</b>
            <p>Сразу в бой, без регистрации. Прогресс остаётся на этом устройстве.</p>
            <button className="ac-go" disabled={!!busy} onClick={() => { sfx.click(); void guest(); }}><b className="toon">Играть</b></button>
          </section>
          <i className="ac-or">или</i>
          <section className="ac-own">
            {pending ? <Code /> : <Form />}
          </section>
        </div>
        {error && <div className="ac-error">{error}</div>}
        <WalletRow />
        <footer className="ac-foot">Аккаунт хранит iDos Games — он один на все игры платформы.</footer>
      </div>
    </div>
  );
}

const KIND = { guest: "Гость", email: "Аккаунт", idos: "iDos Games" };

/** The account in the lobby's menu: who is signed in, the name, the wallet, and the way out. */
export function AccountPanel() {
  const a = useAccount();
  const [name, setName] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (name === null || saving) return;
    setSaving(true);
    const wrong = await rename(name);
    setSaving(false);
    setNote(wrong);
    if (!wrong) setName(null);
  };
  return (
    <div className="ac-panel">
      <div className="ac-me">
        <i className={a.kind}>{KIND[a.kind]}</i>
        <b>{a.name}</b>
        <small>{a.kind === "email" ? a.email : a.id ? `ID ${shortId(a.id)}` : "нет связи с сервером"}</small>
      </div>
      {name === null ? (
        a.id && <button className="ac-line" onClick={() => { setName(a.name); setNote(""); }}>Сменить ник</button>
      ) : (
        <div className="ac-nick">
          <input value={name} maxLength={16} autoFocus onChange={(e) => setName(e.target.value)} onKeyDown={onEnter(() => void save())} />
          <button disabled={saving} onClick={() => void save()}>{saving ? "…" : "OK"}</button>
        </div>
      )}
      {note && <span className="ac-note">{note}</span>}
      <WalletRow />
      {a.kind === "guest"
        ? <button className="ac-line go" onClick={() => { sfx.click(); logout(); }}>Войти в аккаунт</button>
        : <button className="ac-line" onClick={() => { sfx.back(); logout(); }}>Выйти из аккаунта</button>}
    </div>
  );
}
