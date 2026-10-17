"use client";

// Dica flutuante do vendedor (carta de loja do bazar). Reaproveita o visual de
// `.card-tip`, mas só com nome e descrição do vendedor — sem atributos de carta.

import type { SellerInfo } from "@/lib/store";

const SELLER_ACCENT: Record<SellerInfo["category"], string> = {
  dano: "#ff6a5a",
  cura: "#6ddf8f",
  aceleracao: "#f5b74e",
  escudo: "#68d8ff",
};

const SELLER_KIND: Record<SellerInfo["category"], string> = {
  dano: "VENDEDOR · DANO",
  cura: "VENDEDOR · CURA",
  aceleracao: "VENDEDOR · ACELERAÇÃO",
  escudo: "VENDEDOR · ESCUDO",
};

export default function SellerTooltip({ seller }: { seller: SellerInfo }) {
  return (
    <div
      className="card-tip seller-tip"
      role="tooltip"
      style={{ ["--tip-accent" as string]: SELLER_ACCENT[seller.category] }}
    >
      <div className="card-tip-head">
        <strong>{seller.name}</strong>
      </div>
      <p className="card-tip-kind">{SELLER_KIND[seller.category]}</p>
      <p className="card-tip-desc">{seller.description}</p>
    </div>
  );
}
