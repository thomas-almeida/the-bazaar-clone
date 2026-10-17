"use client";

// Indicador de carregamento para botões que chamam API ou navegam.
//
// Fica ancorado na direita do botão porque os botões do projeto são flex com
// `justify-content: space-between`: acrescentar o spinner como último filho
// empurra só o lado direito, sem deslocar o rótulo. A largura dele é reservada
// no botão via `.is-loading`, para o texto não "pular" quando ele aparece.

export default function Spinner({ className = "" }: { className?: string }) {
  return <span className={`ui-spinner${className ? ` ${className}` : ""}`} aria-hidden="true" />;
}

/** Marcador para uso condicional junto de um botão já carregando. */
export function SpinnerWhen({ active }: { active: boolean }) {
  return active ? <Spinner /> : null;
}
