"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import CardGrid from "@/components/CardGrid";
import { createDeck } from "@/lib/cards";
import { playMismatchSound } from "@/lib/sound";

type SingleState = {
  deck: ReturnType<typeof createDeck>;
  revealed: number[];
  matched: number[];
  wrong: number[];
  attempts: number;
  locked: boolean;
};

function initState(): SingleState {
  return {
    deck: createDeck(),
    revealed: [],
    matched: [],
    wrong: [],
    attempts: 0,
    locked: false
  };
}

export default function SinglePage() {
  const [state, setState] = useState<SingleState>(() => initState());

  const revealSet = useMemo(() => new Set(state.revealed), [state.revealed]);
  const matchedSet = useMemo(() => new Set(state.matched), [state.matched]);
  const wrongSet = useMemo(() => new Set(state.wrong), [state.wrong]);
  const clear = state.matched.length === state.deck.length;

  const reset = () => setState(initState());

  const flip = (idx: number) => {
    let shouldPlayMissSound = false;
    setState((prev) => {
      if (prev.locked || prev.revealed.includes(idx) || prev.matched.includes(idx)) {
        return prev;
      }

      const revealed = [...prev.revealed, idx];
      if (revealed.length < 2) {
        return { ...prev, revealed };
      }

      const [a, b] = revealed;
      const isMatch = prev.deck[a].id === prev.deck[b].id;
      const attempts = prev.attempts + 1;

      if (isMatch) {
        return {
          ...prev,
          attempts,
          revealed: [],
          wrong: [],
          matched: [...prev.matched, a, b]
        };
      }

      shouldPlayMissSound = true;
      window.setTimeout(() => {
        setState((curr) => ({ ...curr, revealed: [], wrong: [], locked: false }));
      }, 2000);

      return {
        ...prev,
        attempts,
        revealed,
        wrong: [a, b],
        locked: true
      };
    });
    if (shouldPlayMissSound) playMismatchSound();
  };

  return (
    <main>
      <div className="container" style={{ display: "grid", gap: 12 }}>
        <div className="panel" style={{ display: "grid", gap: 10 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h1>1人モード</h1>
            <Link href="/">トップへ</Link>
          </div>
          <p className="meta">20枚すべて揃うまでの回数チャレンジです。</p>
          <div className="row">
            <p>回数: {state.attempts}</p>
            <button onClick={reset}>リセット</button>
          </div>
          {clear && <p className="result">クリア: {state.attempts} 回で全ペア達成</p>}
        </div>

        <div className="panel">
          {state.wrong.length > 0 && <p className="meta" style={{ color: "#dc2626", marginBottom: 8 }}>不一致です</p>}
          <CardGrid deck={state.deck} revealed={revealSet} matched={matchedSet} wrong={wrongSet} onFlip={flip} disabled={state.locked} />
        </div>
      </div>
    </main>
  );
}
