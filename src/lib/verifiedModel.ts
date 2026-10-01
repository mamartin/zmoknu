import {
  DEFAULT_MODEL,
  MODEL_API_URL,
  MODEL_GROUPS,
  WEATHER_MODELS,
  type ModelGroup,
  type ModelMix,
} from "./models";

// Výběr modelů podle ověřené přesnosti v okolí místa. Pořadí počítá
// samostatná služba Scorecast (noční srovnání předpovědí s měřením
// stanic); tady se jen zeptáme jejího /api/best.

export interface MixPart {
  model: string;
  /** O kolik % je model přesnější než Automaticky (0 = je to Automaticky). */
  gainPct: number;
}

export interface VerifiedPick {
  /** Model pro každou skupinu veličin (id pro Open-Meteo). */
  mix: ModelMix;
  parts: Record<ModelGroup, MixPart>;
  /** Nejbližší použitá stanice a její vzdálenost. */
  station: string;
  distanceKm: number;
  /** Kolik stanic do výběru promluvilo. */
  stations: number;
  /** S jakým předstihem (dny) je přesnost měřena. */
  leads: number[];
}

interface BestResponse {
  model: string | null;
  mix?: Partial<
    Record<ModelGroup, { model?: string; gainPct?: number | null }>
  > | null;
  station?: string;
  distanceKm?: number;
  stations?: number;
  leads?: number[];
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
        if (!d?.model) return null;
        const parts = {} as Record<ModelGroup, MixPart>;
        for (const g of MODEL_GROUPS) {
          // Starší služba bez mixu → jeden model na všechno. Neznámý model
          // (služba je novější než appka) radši nahradíme Automaticky.
          const p = d.mix ? d.mix[g] : { model: d.model, gainPct: null };
          const known = p?.model != null && KNOWN.has(p.model);
          parts[g] = {
            model: known ? p.model! : DEFAULT_MODEL,
            gainPct: known ? Math.max(0, p.gainPct ?? 0) : 0,
          };
        }
        const mix = Object.fromEntries(
          MODEL_GROUPS.map((g) => [g, parts[g].model]),
        ) as ModelMix;
        return {
          mix,
          parts,
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
