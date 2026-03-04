"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

function roomId() {
  return Math.random().toString(36).slice(2, 9);
}

export default function MultiTopPage() {
  const router = useRouter();
  const [createdUrl, setCreatedUrl] = useState("");

  const createRoom = () => {
    const id = roomId();
    const url = `${window.location.origin}/multi/${id}`;
    setCreatedUrl(url);
    router.push(`/multi/${id}`);
  };

  return (
    <main>
      <div className="container panel" style={{ display: "grid", gap: 12 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h1>4人対戦モード</h1>
          <Link href="/">トップへ</Link>
        </div>
        <p className="meta">ホストがルームURLを発行し、最大4人まで参加できます。</p>
        <div className="row">
          <button onClick={createRoom}>ルームを作成する</button>
        </div>
        {createdUrl && (
          <div className="panel" style={{ padding: 12 }}>
            <p>生成URL:</p>
            <a href={createdUrl}>{createdUrl}</a>
          </div>
        )}
      </div>
    </main>
  );
}
