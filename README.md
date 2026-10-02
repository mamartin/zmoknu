# Zmoknu? ☔

Přehledná webová aplikace pro počasí a radar srážek, inspirovaná [Aladinem](https://aladinonline.oblacno.cz).
Postavená v Reactu + Vite, připravená k nasazení na **Vercel**.

## Co umí

- **Aktuální počasí** – teplota, pocitová teplota, vítr a nárazy, vlhkost, tlak, srážky.
- **Hodinová předpověď** – až 48 hodin s ikonami, pravděpodobností srážek a větrem.
- **Denní předpověď až na 16 dní** – tedy výrazně dále než Aladin.
- **Radar srážek s posuvníkem času** – minulost i krátkodobá predikce (nowcast),
  přehrávání i ruční posun po snímcích (data RainViewer).
- **Hledání měst** a **geolokace** ("moje poloha").
- **Responzivní design** pro mobil i desktop, motiv pozadí podle aktuálního počasí.

## Zdroje dat (zdarma, bez API klíče)

- [Open-Meteo](https://open-meteo.com) – předpověď a geokódování.
- [RainViewer](https://www.rainviewer.com/api.html) – radarové snímky.
- Mapové dlaždice: OpenStreetMap + CARTO.

## Spuštění lokálně

```bash
npm install
npm run dev
```

Aplikace běží na `http://localhost:5173`.

## Build

```bash
npm run build      # výstup do dist/
npm run preview    # náhled produkčního buildu
```

## Nasazení na Vercel

1. Nahraj repozitář na GitHub.
2. Na [vercel.com](https://vercel.com) zvol **Add New → Project** a vyber repozitář.
3. Vercel automaticky rozpozná Vite. Stačí potvrdit:
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. Deploy. Hotovo – appka je online.

Případně přes CLI:

```bash
npm i -g vercel
vercel
```

## Ověřený model pro místo

Volba **„Ověřený pro místo (podle měření)"** v nastavení složí předpověď pro
hledané místo z modelů, které se v okolí za posledních 30 dní nejvíc trefovaly
v předpovědi na 1–2 dny, a to zvlášť pro teplotu (s pocitovou teplotou
a vlhkostí), vítr a srážky (s oblačností a ikonou počasí). Automaticky nahradí
jen model s jasným náskokem. Mix platí pro dnešek až pozítří (tak daleko je
ověřený), další dny i hodiny, které modely nemají, jsou z Automaticky. Když
služba nebo některý model neodpovídá, použije se Automaticky a poznámka
v nastavení to řekne.

Pořadí modelů počítá samostatná služba
[Scorecast](https://github.com/mamartin/scorecast) (noční srovnání předpovědí
s měřením stanic). Aplikace volá její `/api/best?lat=…&lon=…`; adresu služby
nastavte v `VITE_MODEL_API_URL`. Bez ní se volba v nastavení nezobrazí.

## Licence

Copyright (C) 2026 Jan Václavík

Tento projekt je licencován pod **GNU Affero General Public License v3.0 nebo
novější (AGPL-3.0-or-later)** – viz soubor [`LICENSE`](./LICENSE).

Znamená to, že kód smíš volně používat, upravovat i šířit, ale **veškeré
odvozené dílo musí zůstat open source pod stejnou licencí**. Navíc – na rozdíl
od běžné GPL – tato povinnost platí i tehdy, když upravenou verzi pouze
**provozuješ jako síťovou/webovou službu**: uživatelům takové služby musíš
zpřístupnit odpovídající zdrojový kód.
