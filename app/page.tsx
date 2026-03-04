import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <div className="container panel" style={{ display: "grid", gap: 16 }}>
        <h1>hoodies 神経衰弱</h1>
        <p className="meta">
          20種類の絵柄を2枚ずつ使った40枚構成です。全てのペアを揃えるまでの回数を競います。
        </p>
        <div className="row">
          <Link href="/single">
            <button>1人モード</button>
          </Link>
          <Link href="/multi">
            <button className="secondary">4人対戦モード</button>
          </Link>
        </div>
      </div>
    </main>
  );
}
