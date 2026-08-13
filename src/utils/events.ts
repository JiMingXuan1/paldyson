// Minimal typed event emitter used to decouple game systems from the DOM UI.

type Handler<T> = (payload: T) => void;

export class Emitter<Map extends Record<string, unknown>> {
  private handlers = new Map<keyof Map, Set<Handler<never>>>();

  on<K extends keyof Map>(event: K, fn: Handler<Map[K]>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(fn as Handler<never>);
    return () => this.off(event, fn);
  }

  off<K extends keyof Map>(event: K, fn: Handler<Map[K]>): void {
    this.handlers.get(event)?.delete(fn as Handler<never>);
  }

  emit<K extends keyof Map>(event: K, payload: Map[K]): void {
    this.handlers.get(event)?.forEach((fn) => (fn as Handler<Map[K]>)(payload));
  }
}

export interface GameEvents {
  inventory: { inv: Record<string, number> };
  power: { gen: number; use: number };
  time: { day: number; hour: number; isNight: boolean };
  toast: { text: string; kind?: "info" | "warn" | "good" };
  research: { state: unknown };
  pals: { count: number };
  buildingPanel: { uid: number } | null;
  victory: { stats: unknown };
}
