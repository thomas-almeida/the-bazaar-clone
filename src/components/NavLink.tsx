"use client";

// Link de navegação com indicador de carregamento.
//
// O App Router não expõe eventos de rota, então o "pendente" é inference:
// marca no clique e limpa quando o pathname muda (navegação normal) ou por
// timeout (destino igual ao atual, link externo, ou rota que nem compilou).
// Sem o timeout o spinner ficaria preso em links que não mudam a URL.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import Spinner from "./Spinner";
import { useSoundEvent } from "./useSoundEvent";

/** generouso o bastante para o primeiro compile em dev, curto para não travar a UI */
const NAV_TIMEOUT_MS = 8000;

export default function NavLink({
  event,
  href,
  className,
  children,
  onClick,
  ...rest
}: {
  event: string;
  href: string;
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
} & Omit<React.ComponentProps<typeof Link>, "href" | "className" | "onClick">) {
  const [pending, setPending] = useState(false);
  const timer = useRef<number | null>(null);
  const pathname = usePathname();
  const sound = useSoundEvent(event);

  const clear = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    setPending(false);
  }, []);

  useEffect(() => {
    clear();
  }, [pathname, clear]);

  useEffect(() => clear, [clear]);

  return (
    <Link
      {...rest}
      href={href}
      className={`${className ?? ""}${pending ? " is-loading" : ""}`.trim()}
      aria-busy={pending || undefined}
      onClick={() => {
        sound();
        onClick?.();
        setPending(true);
        if (timer.current !== null) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(clear, NAV_TIMEOUT_MS);
      }}
    >
      {children}
      {pending && <Spinner />}
    </Link>
  );
}
