import { useEffect, useState } from "react";
import { FRAMED, hasPhantom } from "../solana/chain";
import { connect, useWallet } from "../solana/wallet";

/**
 * The button that connects Phantom. Inside the page of iDos Games a game may not touch a wallet,
 * so there it opens the game in a tab of its own, where it can.
 */
export function PhantomButton({ className, label = "Phantom" }: { className?: string; label?: string }) {
  const busy = useWallet((w) => w.busy);
  const [found, setFound] = useState(hasPhantom());
  // Phantom injects itself a moment after the page loads.
  useEffect(() => {
    const t = setTimeout(() => setFound(hasPhantom()), 800);
    return () => clearTimeout(t);
  }, []);
  if (FRAMED) {
    return (
      <button className={className} title="На этой странице кошелёк игре недоступен — открой игру отдельной вкладкой" onClick={() => window.open(location.href, "_blank", "noopener")}>
        Phantom — в новой вкладке ↗
      </button>
    );
  }
  return <button className={className} disabled={!found || !!busy} onClick={() => void connect("phantom")}>{found ? label : "Phantom не найден"}</button>;
}
