import { MODEL_API_URL, WEATHER_MODELS } from "./models";

// Výběr modelu podle ověřené přesnosti v okolí místa. Pořadí počítá
// samostatná služba „Přesnost předpovědí" (noční srovnání předpovědí
// s měřením stanic); tady se jen zeptáme jejího /api/best.

export interface VerifiedPick {
  /** Vybraný model (id pro Open-Meteo). */
  model: string;
  /** Průměrná chyba teploty vybraného modelu (°C). */
  mae: number;
  /** Totéž pro výchozí model (Automaticky), pokud je k dispozici. */
  baselineMae?: number;
  /** Nejbližší použitá stanice a její vzdálenost. */
  station: string;
  distanceKm: number;
  /** Kolik stanic do výběru promluvilo. */
  stations: number;
  /** S jakým předstihem (dny) je chyba měřena. */
  leads: number[];
}

interface BestResponse extends Partial<Omit<VerifiedPick, "model">> {
  model: string | null;
}

// Pořadí se přepočítává jednou za noc → v rámci běhu appky stačí cache
// podle místa (zaokrouhleno na ~1 km).
const cache = new Map<string, Promise<VerifiedPick | null>>();
const KNOWN = new Set(WEATHER_MODELS.map((m) => m.id));

export function resolveVerifiedModel(
  lat: number,
  lon: number,
): Promise<VerifiedPick | null> {
  if (!MODEL_API_URL) return Promise.resolve(null);
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  let job = cache.get(key);
  if (!job) {
    const url = `${MODEL_API_URL}/api/best?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`;
    job = fetch(url)
      .then((r) => (r.ok ? (r.json() as Promise<BestResponse>) : null))
      .then((d) => {
        // Neznámý model (služba je novější než appka) radši nepoužijeme.
        if (!d?.model || !KNOWN.has(d.model)) return null;
        return {
          model: d.model,
          mae: Number(d.mae ?? NaN),
          baselineMae: d.baselineMae ?? undefined,
          station: d.station ?? "",
          distanceKm: d.distanceKm ?? 0,
          stations: d.stations ?? 0,
          leads: d.leads ?? [1, 2],
        };
      })
      .catch(() => {
        // Síťová chyba – příště to zkusíme znovu.
        cache.delete(key);
        return null;
      });
    cache.set(key, job);
  }
  return job;
}
