"use client";

// Ligação entre um evento nomeado de áudio e um elemento da interface.
//
// O evento é resolvido em tempo de clique pela configuração publicada, então
// trocar o arquivo ou o volume no painel não exige tocar em nenhum componente.
//
//   <button onClick={useSoundEvent("ui:menu.ajustes")} ...>   // erro: hook no meio do JSX
//
// Use assim:
//   const click = useSoundEvent("ui:menu.ajustes");
//   <button onClick={() => { click(); abrirAjustes(); }}>

import { useCallback } from "react";
import { playEvent } from "@/lib/sfx";

/**
 * Handler sem argumentos, para poder ser espalhado direto em `onClick` de
 * button/Link semembrulhar o callback original.
 */
export type SoundHandler = () => void;

/** Handler que dispara o evento nomeado. Estável entre renders. */
export function useSoundEvent(event: string): SoundHandler {
  return useCallback(() => {
    playEvent(event);
  }, [event]);
}

/** Handler para hover com limite de repetição já configurado no evento. */
export function useSoundHover(event: string): SoundHandler {
  return useSoundEvent(event);
}/** Dispara um evento a partir de um callback já existente. */
export function withSound<A extends unknown[]>(
  event: string,
  handler: (...args: A) => void,
): (...args: A) => void {
  return (...args: A) => {
    playEvent(event);
    handler(...args);
  };
}
