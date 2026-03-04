# hoodies 神経衰弱

## 概要
- 20種類の絵柄 x 2枚 = 40枚で遊ぶ神経衰弱ゲーム
- 1人モード: 全ペア達成までの回数チャレンジ
- 4人対戦モード: URLでルーム参加し、獲得枚数でランキング表示

## セットアップ
```bash
npm install
npm run dev
```

## Vercelデプロイ
- Next.jsアプリとしてそのままデプロイ可能
- Build Command: `npm run build`
- Output: Next.js default

## 補足
- 4人対戦は `y-webrtc` によるブラウザ間同期です。
- ルームは最大4人、ホストがゲーム開始できます。
