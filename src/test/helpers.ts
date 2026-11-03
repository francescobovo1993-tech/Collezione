import catalog from '../../data/catalog.json';
import changelog from '../../data/changelog.json';
import volumi from '../../data/volumi.json';
import type { AppData } from '../App';
import type { StateStore } from '../lib/state';
import type { State } from '../lib/types';

export const data = { catalog, volumi, changelog } as unknown as AppData;

/** Recursively freeze, like the prototype's store snapshots that caused silent no-op edits. */
export function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
}

export class MemoryStore implements StateStore {
  saved: State[] = [];
  constructor(private initial: State | null = null) {}
  load() { return this.initial; }
  save(s: State) { this.saved.push(s); }
  get last() { return this.saved[this.saved.length - 1]; }
}
