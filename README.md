# 🍜 Shiokmash

Facemash, but for Singapore food. Two dishes go head-to-head — you pick the more shiok one. Scores update, rankings emerge, debates begin.

## How it works

Each vote calls a [Lahlang](https://lahlang.dev/) script to compute the new scores. Lahlang is a Singlish-based esoteric programming language — all keywords are Singaporean slang (`eh listen lah`, `confirm or not`, `oi`, `suay suay`, etc.). The rest is vanilla Node.js + Express.

```
vote comes in
  → Node.js reads current scores
  → generates a .lah script with scores embedded
  → runs it via the lahlang CLI
  → lahlang outputs "1015|985"
  → Node.js saves the result
```

## Stack

- **Node.js / Express 5** — server, routing, file I/O
- **[Lahlang](https://lahlang.dev/)** — score arithmetic, battle intro text, leaderboard commentary
- **Vanilla HTML/CSS/JS** — frontend, no framework

## Dishes

15 contenders: Hainanese Chicken Rice, Char Kway Teow, Laksa, Bak Kut Teh, Hokkien Mee, Nasi Lemak, Chilli Crab, Satay, Kaya Toast, Fish Head Curry, Orh Luak, Roti Prata, Mee Goreng, Wonton Mee, Rojak.

## Run locally

```bash
npm install
npm start
# → http://localhost:1965
```

Requires Node.js 16+ and the `lahlang` CLI (installed automatically via npm).
