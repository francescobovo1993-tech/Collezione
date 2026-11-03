import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import catalog from '../data/catalog.json';
import changelog from '../data/changelog.json';
import sheet from '../data/sheet-seed.json';
import volumi from '../data/volumi.json';
import { App, type AppData } from './App';
import { LocalStorageStore } from './lib/state';
import './styles.css';

const data = { catalog, volumi, sheet, changelog } as unknown as AppData;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App data={data} store={new LocalStorageStore()} />
  </StrictMode>,
);
