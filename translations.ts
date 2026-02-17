// Centralni rječnik prijevoda (DE) za glavne module.
// Ključevi su deskriptivni (nav_*, login_*, dashboard_*, btn_*, status_*),
// vrijednosti su tekstovi na njemačkom jeziku.

export const dict = {
  // --- Navigacija ---
  nav_dashboard: "Dashboard",
  nav_team: "Mein Team",
  nav_staff_tools: "Mitarbeiter-Tools",
  nav_profile: "Profil",
  nav_requests: "Anfragen",
  nav_requests_pending: "Offene Anfragen",
  nav_profile_tooltip: "Mein Profil",
  nav_logout: "Abmelden",

  // --- Login / auth ---
  login_title: "Anmelden",
  login_subtitle: "Melden Sie sich bei Ihrem Konto an",
  login_brand_title: "AIW Services",
  login_brand_subtitle: "Enterprise-Managementsystem für McDonald’s Österreich.",
  login_brand_hint: "Melden Sie sich mit Ihren offiziellen Zugangsdaten an.",
  login_error_credentials: "Ungültige Anmeldedaten. Bitte E-Mail und Passwort prüfen.",
  login_error_generic: "Fehler bei der Anmeldung. Bitte erneut versuchen.",
  login_btn_label: "Anmelden",
  login_btn_loading: "Anmeldung...",
  login_timeout_title: "Sie wurden aufgrund von Inaktivität automatisch abgemeldet.",
  login_timeout_subtitle: "Bitte melden Sie sich erneut an.",
  login_timeout_button: "Zurück zur Anmeldung",

  // --- Layout / globalno ---
  app_title: "AIW Services",
  app_description: "Enterprise Management System",

  // --- Dashboard hero ---
  dashboard_hero_chip: "System aktiv",
  dashboard_hero_subtitle: "Operative Übersicht und Schnellzugriff.",
  dashboard_greeting_morning: "Guten Morgen",
  dashboard_greeting_day: "Guten Tag",
  dashboard_greeting_default: "Willkommen zurück",

  // --- Dashboard pločice / tekstovi ---
  dashboard_tile_vacation_label: "Jahresurlaub",
  dashboard_tile_vacation_sub: "Tage verbleibend",
  dashboard_tile_pds_label: "PDS-Score",
  dashboard_tile_requests_label: "Anfragen",
  dashboard_tile_requests_sub: "Offen",
  dashboard_section_my_tools: "MEINE TOOLS",
  dashboard_recent_vacations_empty: "Derzeit keine Aktivitäten für Jahresurlaub.",

  // --- Dashboard / drugi dijelovi ---
  dashboard_vacation_status_label: "Urlaubsstatus",
  dashboard_vacation_status_rest: "Resturlaub Tage",
  dashboard_vacation_status_not_available: "Daten nicht verfügbar.",
  dashboard_vacation_status_open_cta: "Urlaub öffnen",
  dashboard_team_card_title: "Mein Team",
  dashboard_team_card_subtitle: "Teamübersicht und Urlaubsfreigaben.",
  dashboard_team_card_link: "Team öffnen",

  // --- Dugmad / opće ---
  btn_save: "Speichern",
  btn_cancel: "Abbrechen",
  btn_back: "Zurück",
  btn_back_to_dashboard: "Zurück zum Dashboard",
};

export type DictKey = keyof typeof dict;

export function t(key: DictKey): string {
  return dict[key];
}

