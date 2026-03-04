"use client";

import { DeckCard } from "@/lib/cards";

type CardGridProps = {
  deck: DeckCard[];
  revealed: Set<number>;
  matched: Set<number>;
  wrong?: Set<number>;
  onFlip: (index: number) => void;
  disabled?: boolean;
};

export default function CardGrid({ deck, revealed, matched, wrong = new Set(), onFlip, disabled = false }: CardGridProps) {
  return (
    <div className="grid">
      {deck.map((card, idx) => {
        const isFace = revealed.has(idx) || matched.has(idx);
        const classes = `card ${!isFace ? "back" : ""} ${matched.has(idx) ? "matched" : ""} ${wrong.has(idx) ? "wrong" : ""}`.trim();

        return (
          <button
            key={`${card.id}-${idx}`}
            className={classes}
            onClick={() => onFlip(idx)}
            disabled={disabled || isFace}
            aria-label={`card-${idx}`}
          >
            {!isFace ? "hoodie" : <img className="card-image" src={card.image} alt={`hoodie-${card.id}`} />}
          </button>
        );
      })}
    </div>
  );
}
