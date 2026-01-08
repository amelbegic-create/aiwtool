// Simulacija podataka o restoranima
export interface Restaurant {
  id: string;
  name: string;
  city: string;
  type: 'Drive' | 'In-Store' | 'Mall';
}

// Ovdje definišemo koji su restorani dodijeljeni ulogovanom korisniku
export const USER_RESTAURANTS: Restaurant[] = [
  { id: "1", name: "MCD Titova", city: "Sarajevo", type: "In-Store" },
  { id: "2", name: "MCD Nedžarići", city: "Sarajevo", type: "Drive" },
  { id: "3", name: "MCD Šip", city: "Sarajevo", type: "Drive" },
  { id: "4", name: "MCD Mostar", city: "Mostar", type: "Drive" },
  { id: "5", name: "MCD Banja Luka", city: "Banja Luka", type: "Drive" },
];

// Opcija za odabir svih restorana (za regionalne menadžere)
export const ALL_RESTAURANTS_OPTION: Restaurant = {
  id: "all",
  name: "Svi Restorani",
  city: "Globalni Pregled",
  type: "Mall" // Nije bitno
};