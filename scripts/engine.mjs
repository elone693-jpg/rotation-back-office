// Charge le moteur de index.html dans Node (sans navigateur) pour les tests et le rappel par mail.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function loadEngine({ today } = {}) {
  const html = readFileSync(fileURLToPath(new URL('../index.html', import.meta.url)), 'utf8');
  let js = html.match(/<script>([\s\S]*)<\/script>/)[1];
  js = js.replace('/* ---------- démarrage',
    'globalThis.__t={compute,state,defaults,dutyIds,recLabel,parseBulk,vMoi,checklist,canTick,tick,progress,myCollab,ui,riskDays,effMap,vActivite,vAbsences,vPlanning,vEquipe,vReglages,taches,collabs,byId,nextWorkday,journal,cptGet,cptSet,TODAY,DNL,short,addDays,weekday};return;/*');
  const el = { innerHTML: '', contains: () => false, className: '', addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] };
  const store = new Map();
  globalThis.document = { querySelector: () => el, addEventListener() {}, activeElement: null, getElementById: () => null };
  globalThis.localStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
  globalThis.__TODAY__ = today;
  new Function(js)();
  return { ...globalThis.__t, store };
}
