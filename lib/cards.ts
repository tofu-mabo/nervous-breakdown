export const CARD_IMAGES = Array.from({ length: 20 }, (_, i) => {
  const num = String(i + 1).padStart(2, "0");
  return `/cards/hoodie_${num}.png`;
});

export type DeckCard = {
  id: number;
  image: string;
};

export function createDeck(): DeckCard[] {
  const doubled = CARD_IMAGES.flatMap((image, id) => [
    { id, image },
    { id, image }
  ]);
  return shuffle(doubled);
}

export function shuffle<T>(arr: T[]): T[] {
  const copied = [...arr];
  for (let i = copied.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copied[i], copied[j]] = [copied[j], copied[i]];
  }
  return copied;
}
