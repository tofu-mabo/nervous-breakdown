"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import { WebrtcProvider } from "y-webrtc";
import CardGrid from "@/components/CardGrid";
import { CARD_IMAGES, DeckCard, createDeck, shuffle } from "@/lib/cards";
import { playMismatchSound } from "@/lib/sound";

type Profile = {
  id: string;
  name: string;
  joinedAt: number;
};

type GameState = {
  phase: "lobby" | "playing" | "finished";
  deckIds: number[];
  flips: number[];
  matchedBy: Array<string | null>;
  attempts: Record<string, number>;
  turnId: string;
  participants: string[];
  hostId: string;
  resolving: boolean;
};

const ROOM_CAPACITY = 4;

function defaultGame(): GameState {
  return {
    phase: "lobby",
    deckIds: [],
    flips: [],
    matchedBy: [],
    attempts: {},
    turnId: "",
    participants: [],
    hostId: "",
    resolving: false
  };
}

function makeDeckFromIds(deckIds: number[]): DeckCard[] {
  return deckIds.map((id) => ({ id, image: CARD_IMAGES[id] }));
}

function nextTurn(current: string, participants: string[], active: Set<string>) {
  if (!participants.length) return "";
  const start = participants.indexOf(current);
  for (let i = 1; i <= participants.length; i += 1) {
    const idx = (Math.max(start, 0) + i) % participants.length;
    const id = participants[idx];
    if (active.has(id)) return id;
  }
  return current;
}

export default function MultiRoomClient({ roomId }: { roomId: string }) {
  const [name, setName] = useState("");
  const [joined, setJoined] = useState(false);
  const [myId, setMyId] = useState("");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [game, setGame] = useState<GameState>(defaultGame());

  const docRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebrtcProvider | null>(null);
  const gameMapRef = useRef<Y.Map<unknown> | null>(null);
  const profilesRef = useRef<Y.Map<Profile> | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const mismatchSignalRef = useRef<string>("");

  const activeIds = useMemo(() => new Set(profiles.map((p) => p.id)), [profiles]);
  const participants = useMemo(() => {
    if (game.participants.length) {
      return game.participants
        .map((id) => profiles.find((p) => p.id === id) || { id, name: `Player-${id.slice(-4)}`, joinedAt: 0 })
        .slice(0, ROOM_CAPACITY);
    }
    return profiles.slice(0, ROOM_CAPACITY);
  }, [game.participants, profiles]);

  const hostId = game.hostId || participants[0]?.id || "";
  const isHost = myId !== "" && myId === hostId;
  const isParticipant = participants.some((p) => p.id === myId);
  const isMyTurn = game.phase === "playing" && game.turnId === myId;
  const roomUrl = typeof window !== "undefined" ? window.location.href : "";

  const deck = useMemo(() => {
    if (!game.deckIds.length) return [];
    return makeDeckFromIds(game.deckIds);
  }, [game.deckIds]);

  const revealedSet = useMemo(() => new Set(game.flips), [game.flips]);
  const matchedSet = useMemo(() => {
    const set = new Set<number>();
    game.matchedBy.forEach((owner, idx) => {
      if (owner) set.add(idx);
    });
    return set;
  }, [game.matchedBy]);
  const wrongSet = useMemo(() => {
    if (game.phase !== "playing" || game.flips.length !== 2 || !deck.length) return new Set<number>();
    const [a, b] = game.flips;
    if (deck[a]?.id !== deck[b]?.id) return new Set<number>([a, b]);
    return new Set<number>();
  }, [deck, game.flips, game.phase]);

  const ranking = useMemo(() => {
    const scoreMap: Record<string, number> = {};
    game.matchedBy.forEach((owner) => {
      if (owner) scoreMap[owner] = (scoreMap[owner] || 0) + 1;
    });

    return participants
      .map((p) => ({
        ...p,
        cards: scoreMap[p.id] || 0,
        pairs: Math.floor((scoreMap[p.id] || 0) / 2),
        attempts: game.attempts[p.id] || 0
      }))
      .sort((a, b) => b.cards - a.cards || a.attempts - b.attempts);
  }, [game.attempts, game.matchedBy, participants]);

  useEffect(() => {
    const cached = localStorage.getItem(`nb-name-${roomId}`);
    if (cached) setName(cached);
  }, [roomId]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      providerRef.current?.destroy();
      docRef.current?.destroy();
    };
  }, []);

  useEffect(() => {
    if (!joined) return;

    const doc = new Y.Doc();
    const provider = new WebrtcProvider(`nervous-breakdown-${roomId}`, doc);
    const gameMap = doc.getMap<unknown>("game");
    const profilesMap = doc.getMap<Profile>("profiles");
    const selfId = String(doc.clientID);
    const joinedAt = Date.now();

    docRef.current = doc;
    providerRef.current = provider;
    gameMapRef.current = gameMap;
    profilesRef.current = profilesMap;
    setMyId(selfId);

    const syncProfiles = () => {
      const awarenessStates = Array.from(provider.awareness.getStates().values());
      const awarenessIds = new Set<string>();
      awarenessStates.forEach((state) => {
        const player = (state as { player?: Profile }).player;
        if (player?.id) awarenessIds.add(player.id);
      });

      const list = Array.from(profilesMap.entries())
        .map(([, profile]) => profile)
        .filter((profile) => awarenessIds.has(profile.id))
        .sort((a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id));

      setProfiles(list);
    };

    const syncGame = () => {
      setGame({
        phase: (gameMap.get("phase") as GameState["phase"]) || "lobby",
        deckIds: (gameMap.get("deckIds") as number[]) || [],
        flips: (gameMap.get("flips") as number[]) || [],
        matchedBy: (gameMap.get("matchedBy") as Array<string | null>) || [],
        attempts: (gameMap.get("attempts") as Record<string, number>) || {},
        turnId: (gameMap.get("turnId") as string) || "",
        participants: (gameMap.get("participants") as string[]) || [],
        hostId: (gameMap.get("hostId") as string) || "",
        resolving: Boolean(gameMap.get("resolving"))
      });
    };

    provider.on("synced", () => {
      profilesMap.set(selfId, { id: selfId, name, joinedAt });
      provider.awareness.setLocalStateField("player", { id: selfId, name, joinedAt });

      if (!gameMap.has("phase")) {
        gameMap.set("phase", "lobby");
      }
      syncProfiles();
      syncGame();
    });

    const awarenessHandler = () => {
      syncProfiles();
      const currHost = (gameMap.get("hostId") as string) || "";
      const visible = Array.from(provider.awareness.getStates().values())
        .map((state) => (state as { player?: Profile }).player)
        .filter((v): v is Profile => Boolean(v?.id))
        .sort((a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id))
        .slice(0, ROOM_CAPACITY);

      if (!currHost && visible[0]?.id === selfId) {
        gameMap.set("hostId", selfId);
      }

      if (currHost && !visible.some((p) => p.id === currHost) && visible[0]?.id === selfId) {
        gameMap.set("hostId", visible[0].id);
      }
    };

    provider.awareness.on("change", awarenessHandler);
    gameMap.observe(syncGame);
    profilesMap.observe(syncProfiles);

    return () => {
      if (profilesMap.has(selfId)) {
        profilesMap.delete(selfId);
      }
      provider.awareness.setLocalState(null);
      provider.awareness.off("change", awarenessHandler);
      gameMap.unobserve(syncGame);
      profilesMap.unobserve(syncProfiles);
      provider.destroy();
      doc.destroy();
    };
  }, [joined, name, roomId]);

  useEffect(() => {
    if (wrongSet.size !== 2) {
      mismatchSignalRef.current = "";
      return;
    }
    const key = [...wrongSet].sort((a, b) => a - b).join("-");
    if (mismatchSignalRef.current === key) return;
    mismatchSignalRef.current = key;
    playMismatchSound();
  }, [wrongSet]);

  useEffect(() => {
    const gameMap = gameMapRef.current;
    if (!gameMap || !isHost) return;
    if (game.phase !== "playing" || !game.resolving || game.flips.length !== 2) return;

    timeoutRef.current = window.setTimeout(() => {
      const latestFlips = (gameMap.get("flips") as number[]) || [];
      if (latestFlips.length !== 2 || !gameMap.get("resolving")) return;

      const deckIds = (gameMap.get("deckIds") as number[]) || [];
      const matchedBySource = gameMap.get("matchedBy") as Array<string | null> | undefined;
      const matchedBy = matchedBySource ? [...matchedBySource] : [];
      const attempts = { ...((gameMap.get("attempts") as Record<string, number>) || {}) };
      const participantsIds = (gameMap.get("participants") as string[]) || [];
      let turnId = (gameMap.get("turnId") as string) || "";
      const [a, b] = latestFlips;

      attempts[turnId] = (attempts[turnId] || 0) + 1;

      if (deckIds[a] === deckIds[b]) {
        matchedBy[a] = turnId;
        matchedBy[b] = turnId;
      } else {
        turnId = nextTurn(turnId, participantsIds, activeIds);
      }

      const finished = matchedBy.length > 0 && matchedBy.every((m) => m !== null);
      gameMap.doc?.transact(() => {
        gameMap.set("matchedBy", matchedBy);
        gameMap.set("attempts", attempts);
        gameMap.set("turnId", turnId);
        gameMap.set("flips", []);
        gameMap.set("resolving", false);
        if (finished) {
          gameMap.set("phase", "finished");
        }
      });
    }, 2000);

    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, [activeIds, game.flips, game.phase, game.resolving, isHost]);

  const joinRoom = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    localStorage.setItem(`nb-name-${roomId}`, trimmed);
    setName(trimmed);
    setJoined(true);
  };

  const startGame = () => {
    const gameMap = gameMapRef.current;
    if (!gameMap || !isHost) return;

    const fixedPlayers = participants.slice(0, ROOM_CAPACITY);
    if (fixedPlayers.length < 2) return;

    const deckIds = createDeck().map((c) => c.id);
    const attempts: Record<string, number> = {};
    fixedPlayers.forEach((p) => {
      attempts[p.id] = 0;
    });

    gameMap.doc?.transact(() => {
      gameMap.set("phase", "playing");
      gameMap.set("deckIds", shuffle(deckIds));
      gameMap.set("flips", []);
      gameMap.set("matchedBy", Array(20).fill(null));
      gameMap.set("attempts", attempts);
      gameMap.set("participants", fixedPlayers.map((p) => p.id));
      gameMap.set("turnId", fixedPlayers[0].id);
      gameMap.set("hostId", fixedPlayers[0].id);
      gameMap.set("resolving", false);
    });
  };

  const resetToLobby = () => {
    const gameMap = gameMapRef.current;
    if (!gameMap || !isHost) return;
    gameMap.doc?.transact(() => {
      gameMap.set("phase", "lobby");
      gameMap.set("deckIds", []);
      gameMap.set("flips", []);
      gameMap.set("matchedBy", []);
      gameMap.set("attempts", {});
      gameMap.set("participants", []);
      gameMap.set("turnId", "");
      gameMap.set("resolving", false);
    });
  };

  const flipCard = (idx: number) => {
    const gameMap = gameMapRef.current;
    if (!gameMap) return;
    if (!isParticipant || !isMyTurn) return;

    const matchedBy = (gameMap.get("matchedBy") as Array<string | null>) || [];
    const flips = (gameMap.get("flips") as number[]) || [];

    if (matchedBy[idx] || flips.includes(idx) || flips.length >= 2 || gameMap.get("resolving")) return;

    const next = [...flips, idx];
    gameMap.doc?.transact(() => {
      gameMap.set("flips", next);
      if (next.length === 2) {
        gameMap.set("resolving", true);
      }
    });
  };

  if (!joined) {
    return (
      <main>
        <div className="container panel" style={{ display: "grid", gap: 12 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h1>ルーム参加</h1>
            <Link href="/multi">戻る</Link>
          </div>
          <p className="meta">URLを共有して、ユーザー名を入力して参加してください。</p>
          <div className="row">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ユーザー名" maxLength={20} />
            <button onClick={joinRoom} disabled={!name.trim()}>
              参加する
            </button>
          </div>
          <p className="meta">ルームURL: {typeof window !== "undefined" ? window.location.href : ""}</p>
        </div>
      </main>
    );
  }

  return (
    <main>
      <div className="container" style={{ display: "grid", gap: 12 }}>
        <div className="panel" style={{ display: "grid", gap: 10 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h1>4人対戦ルーム: {roomId}</h1>
            <Link href="/">トップへ</Link>
          </div>
          <p className="meta">参加中: {profiles.length}/4</p>
          <p className="meta">共有URL: {roomUrl}</p>
          {!isParticipant && profiles.length > ROOM_CAPACITY && (
            <p className="meta">このルームは満員です（観戦のみ）。</p>
          )}
          <div className="row">
            {participants.map((p) => (
              <span key={p.id} className="meta">
                {p.name}
                {p.id === hostId ? " (Host)" : ""}
                {p.id === game.turnId && game.phase === "playing" ? " <- Turn" : ""}
              </span>
            ))}
          </div>
          <div className="row">
            <button onClick={startGame} disabled={!isHost || game.phase === "playing" || participants.length < 2}>
              ゲーム開始
            </button>
            <button className="secondary" onClick={resetToLobby} disabled={!isHost}>
              ロビーに戻す
            </button>
          </div>
          {game.phase === "playing" && (
            <p className="meta">{isMyTurn ? "あなたの番です" : "相手の番です"} / 現在ターン: {participants.find((p) => p.id === game.turnId)?.name}</p>
          )}
          {game.phase === "finished" && <p className="result">ゲーム終了: 獲得枚数ランキング</p>}
        </div>

        {game.phase === "playing" || game.phase === "finished" ? (
          <div className="panel">
            {wrongSet.size > 0 && <p className="meta" style={{ color: "#dc2626", marginBottom: 8 }}>不一致です</p>}
            <CardGrid
              deck={deck}
              revealed={revealedSet}
              matched={matchedSet}
              wrong={wrongSet}
              onFlip={flipCard}
              disabled={!isParticipant || !isMyTurn || game.resolving}
            />
          </div>
        ) : (
          <div className="panel">
            <p className="meta">ホストが「ゲーム開始」を押すと20枚のカードが配られます。</p>
          </div>
        )}

        <div className="panel">
          <h2>ランキング</h2>
          <div className="rank">
            {ranking.map((r, idx) => (
              <div className="rank-item" key={r.id}>
                {idx + 1}位: {r.name} / 獲得 {r.cards} 枚 ({r.pairs} ペア) / 試行 {r.attempts} 回
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
