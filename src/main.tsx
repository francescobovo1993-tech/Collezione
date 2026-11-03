import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import catalog from '../data/catalog.json';
import changelog from '../data/changelog.json';
import sheet from '../data/sheet-seed.json';
import volumi from '../data/volumi.json';
import { App, type AppData } from './App';
import { LocalStorageStore } from './lib/state';
import { SyncedStore } from './lib/sync';
import './styles.css';

const data = { catalog, volumi, sheet, changelog } as unknown as AppData;

// With a Supabase project in the build, marks sync to the signed-in account; otherwise browser only.
// The Supabase library is loaded only in that case.
const local = new LocalStorageStore();
const configured = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
const sync = configured ? new SyncedStore(local, new (await import('./lib/supabase')).SupabaseRemote()) : undefined;
sync?.start();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App data={data} store={sync ?? local} sync={sync} />
  </StrictMode>,
);
