import { useEffect, useState } from "react";
import {
  DEFAULT_MODEL,
  MODEL_API_URL,
  MODEL_GROUPS,
  VERIFIED_MODEL,
  WEATHER_MODELS,
  mixKey,
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

// Na odpověď Scorecastu čekáme nejvýš tak dlouho – předpověď na ni čeká.
const TIMEOUT_MS = 3000;

function timeoutSignal(ms: number): AbortSignal | undefined {
  if (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal) {
    return AbortSignal.timeout(ms);
  }
  if (typeof AbortController === "undefined") return undefined;
  const c = new AbortController();
  setTimeout(() => c.abort(), ms);
  return c.signal;
}

// Pořadí se přepočítává jednou za noc → v rámci běhu appky stačí cache
// podle místa (zaokrouhleno na ~1 km). Chyby se necachují.
const cache = new Map<string, Promise<VerifiedPick | null>>();
const KNOWN = new Set(WEATHER_MODELS.map((m) => m.id));

function parsePick(d: BestResponse): VerifiedPick | null {
  if (!d.model) return null; // v okolí nejsou stanice
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
  return {
    mix: Object.fromEntries(MODEL_GROUPS.map((g) => [g, parts[g].model])) as ModelMix,
    parts,
    station: d.station ?? "",
    distanceKm: d.distanceKm ?? 0,
    stations: d.stations ?? 0,
    leads: d.leads ?? [1, 2],
  };
}

// Výběr pro místo: null = v okolí nejsou stanice; při chybě (síť, časový
// limit, chyba služby) promise selže a příští volání to zkusí znovu.
export function resolveVerifiedModel(
  lat: number,
  lon: number,
): Promise<VerifiedPick | null> {
  if (!MODEL_API_URL) return Promise.resolve(null);
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  let job = cache.get(key);
  if (!job) {
    const url = `${MODEL_API_URL}/api/best?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`;
    job = fetch(url, { signal: timeoutSignal(TIMEOUT_MS) })
      .then((r) => {
        if (!r.ok) throw new Error(`Scorecast ${r.status}`);
        return r.json() as Promise<BestResponse>;
      })
      .then(parsePick)
      .catch((e) => {
        cache.delete(key);
        throw e;
      });
    cache.set(key, job);
  }
  return job;
}

// Z čeho stahovat předpověď: mix modelů, bez výběru Automaticky.
export const sourceFor = (pick: VerifiedPick | null): string | ModelMix =>
  pick?.mix ?? DEFAULT_MODEL;

export const sourceKeyOf = (src: string | ModelMix): string =>
  typeof src === "string" ? src : mixKey(src);

// Zdroj předpovědi pro zvolený model. U „Ověřeného pro místo" se zeptá
// Scorecastu; předpověď má počkat, dokud není `ready`. Při chybě je
// `failed` a použije se Automaticky; obnovení (reloadTick) to zkusí znovu.
export function useVerifiedSource(
  lat: number,
  lon: number,
  modelChoice: string,
  reloadTick: number,
) {
  const isVerified = modelChoice === VERIFIED_MODEL;
  const key = `${lat},${lon}`;
  const [state, setState] = useState<{
    key: string;
    pick: VerifiedPick | null;
    failed: boolean;
  } | null>(null);
  useEffect(() => {
    if (!isVerified) return;
    let cancelled = false;
    const [la, lo] = key.split(",").map(Number);
    resolveVerifiedModel(la, lo).then(
      (pick) => {
        if (!cancelled) setState({ key, pick, failed: false });
      },
      () => {
        if (!cancelled) setState({ key, pick: null, failed: true });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [isVerified, key, reloadTick]);
  const ready = !isVerified || state?.key === key;
  const pick = isVerified && ready ? state?.pick ?? null : null;
  const source = isVerified ? sourceFor(pick) : modelChoice;
  return {
    isVerified,
    ready,
    pick,
    failed: isVerified && ready && !!state?.failed,
    source,
    sourceKey: sourceKeyOf(source),
    // Model pro popisky (legenda meteogramu, hlášky).
    model: typeof source === "string" ? source : VERIFIED_MODEL,
  };
}
