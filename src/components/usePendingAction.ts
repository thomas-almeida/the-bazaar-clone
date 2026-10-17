"use client";

// Rastreia qual ação assíncrona está em andamento. O `busy` booleano desabilita
// tudo, mas sem identificar a ação não dá para girar só o botão correspondente —
// em `/admin` várias chamadas podem coexistir na mesma tela.

import { useCallback, useState } from "react";

export function usePendingAction() {
  const [pending, setPending] = useState<string | null>(null);

  /** Executa `task` marcando `key` como pendente; sempre limpa no fim. */
  const run = useCallback(async (key: string, task: () => Promise<unknown>) => {
    setPending(key);
    try {
      await task();
    } finally {
      setPending(null);
    }
  }, []);

  const is = useCallback((key: string) => pending === key, [pending]);

  return { pending, run, is };
}
