export interface Station {
  key: string;
  label: string;
  group: string;
  isCustom?: boolean;
}

/** Sve podrazumijevane stanice kako su definirane u Produktivnosti. */
export const DEFAULT_STATIONS: Station[] = [
  { key: "ausgabe",      label: "Ausgabe",    group: "Service" },
  { key: "kueche",       label: "Küche",      group: "Kuhinja" },
  { key: "lobby",        label: "Lobby",      group: "Lobby"   },
  { key: "mccafe",       label: "McCafé",     group: "McCafé"  },
  { key: "drive",        label: "Drive",      group: "Service" },
  { key: "getraenke",    label: "Getränke",   group: "Service" },
  { key: "kasse",        label: "Kasse",      group: "Service" },
  { key: "tableservice", label: "T.Serv.",    group: "Service" },
  { key: "pommes",       label: "Pommes",     group: "Service" },
  { key: "sf",           label: "SF Prod.",   group: "Ostalo"  },
  { key: "pause",        label: "Pause (-)",  group: "Ostalo"  },
];

/**
 * Default stanice filtrirane za Aushilfe (bez "pause" – nije radno mjesto).
 */
export function getDefaultStationsForAushilfe(): Station[] {
  return DEFAULT_STATIONS.filter(s => s.key !== "pause");
}
