# Tiny Fighter Arena ⚔️

A tiny, static, bring-your-own-Pollen fighting game. Describe a fighter in **one line** — the AI designs the whole character (name, look, stats, abilities, quirks), draws the portrait, and runs a short turn-by-turn battle against a challenger with live AI commentary.

No build step. No framework. Pure HTML/CSS/JS. Hosted on GitHub Pages.

## Play

1. Open the page.
2. Click **🔑 Pollen key** and paste your own **Pollen API key** (from [gen.pollinations.ai](https://gen.pollinations.ai/docs)). It is stored **only in your browser's `localStorage`** and is sent **only** to `gen.pollinations.ai`.
3. Type a one-line fighter description, pick a challenger, and hit **⚒️ Forge & Fight**.
4. Fight round by round (or hit **⏩ Auto-fight**).
5. Beat a challenger to unlock the next. Try the **daily boss** too.
6. **🔗 Copy share link** gives a URL that replays your fighter against your challenger with the same seed.

### Tips for a strong fighter
Be specific, inventive, and clever. The designer rewards creativity, specificity and wit with higher stats — generic or vague descriptions get weak fighters. Clever concepts win.

## How it works

- **Text:** `POST https://gen.pollinations.ai/v1/chat/completions` (OpenAI-compatible), `Authorization: Bearer <your key>`, model `openai` (GPT-5.4 Nano alias).
- **Image:** `https://gen.pollinations.ai/image/<urlencoded prompt>` with `?model=z-image&width=512&height=512&seed=...&nologo=true`.
- **Design:** one JSON-mode call returns the fighter sheet, parsed leniently (the app tolerates stray markdown fences or trailing commas).
- **Battle:** damage/initiative/crits are computed locally from the fighter's stats (so links with the same seed replay the same outcome); the AI supplies one vivid commentary sentence per exchange, with a canned fallback if the API errors or rate-limits.
- **Errors:** 401/402/403/429/5xx and network failures are surfaced in the UI with friendly messages and retry-safe buttons.

## Files
```
index.html    markup / screens
styles.css    arcade-dark theme
app.js        all game logic (API, forge, battle, ladder, sharing)
```

## Privacy
No key is ever hardcoded or committed. Your Pollen key lives in `localStorage` in your own browser and travels only to `gen.pollinations.ai`.

## License
MIT — do what you like.
