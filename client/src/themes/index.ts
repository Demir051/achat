export interface ThemeDefinition {
  id: string;
  name: string;
  subtitle: string;
  category: "classic" | "color" | "series";
  accent: string;
  accentHover: string;
  accentSoft: string;
  bg0: string;
  bg1: string;
  bg2: string;
  bg3: string;
  text: string;
  textMuted: string;
  glass: string;
  wallpaper: string; // CSS class name
}

export const THEMES: ThemeDefinition[] = [
  {
    id: "midnight",
    name: "Midnight",
    subtitle: "Varsayılan — sade menekşe",
    category: "classic",
    accent: "#7c6cff",
    accentHover: "#8f81ff",
    accentSoft: "rgba(124, 108, 255, 0.14)",
    bg0: "#0c0c10",
    bg1: "#131318",
    bg2: "#1a1a21",
    bg3: "#22222b",
    text: "#e9e9ee",
    textMuted: "#9a9aa6",
    glass: "rgba(12, 12, 16, 0.38)",
    wallpaper: "wp-midnight",
  },
  {
    id: "emerald",
    name: "Emerald",
    subtitle: "Canlı yeşil — doğa esintisi",
    category: "color",
    accent: "#3ecf8e",
    accentHover: "#52db9c",
    accentSoft: "rgba(62, 207, 142, 0.16)",
    bg0: "#081210",
    bg1: "#0e1a16",
    bg2: "#142620",
    bg3: "#1a322a",
    text: "#e8f5ef",
    textMuted: "#8fbfb0",
    glass: "rgba(8, 18, 16, 0.38)",
    wallpaper: "wp-emerald",
  },
  {
    id: "crimson",
    name: "Crimson",
    subtitle: "Kızıl — tutkulu ve sıcak",
    category: "color",
    accent: "#ff4d6d",
    accentHover: "#ff6b85",
    accentSoft: "rgba(255, 77, 109, 0.15)",
    bg0: "#100809",
    bg1: "#180c0f",
    bg2: "#221015",
    bg3: "#2c1419",
    text: "#fceef1",
    textMuted: "#c49aa4",
    glass: "rgba(16, 8, 9, 0.38)",
    wallpaper: "wp-crimson",
  },
  {
    id: "ocean",
    name: "Ocean",
    subtitle: "Derin mavi — sakin dalgalar",
    category: "color",
    accent: "#4dabf7",
    accentHover: "#69b8f9",
    accentSoft: "rgba(77, 171, 247, 0.15)",
    bg0: "#060d14",
    bg1: "#0a1520",
    bg2: "#0f1e2e",
    bg3: "#15283c",
    text: "#e8f2fa",
    textMuted: "#8fafc9",
    glass: "rgba(6, 13, 20, 0.38)",
    wallpaper: "wp-ocean",
  },
  {
    id: "dark-series",
    name: "Dark",
    subtitle: "Netflix — zaman döngüsü",
    category: "series",
    accent: "#c8c8c8",
    accentHover: "#e0e0e0",
    accentSoft: "rgba(200, 200, 200, 0.12)",
    bg0: "#050505",
    bg1: "#0a0a0a",
    bg2: "#111111",
    bg3: "#1a1a1a",
    text: "#e8e8e8",
    textMuted: "#888888",
    glass: "rgba(5, 5, 5, 0.22)",
    wallpaper: "wp-dark-series",
  },
  {
    id: "westeros",
    name: "Westeros",
    subtitle: "Game of Thrones — taht oyunu",
    category: "series",
    accent: "#c9a227",
    accentHover: "#dbb43a",
    accentSoft: "rgba(201, 162, 39, 0.15)",
    bg0: "#0a0806",
    bg1: "#120e0a",
    bg2: "#1a1410",
    bg3: "#241c16",
    text: "#f0e8dc",
    textMuted: "#a89880",
    glass: "rgba(10, 8, 6, 0.22)",
    wallpaper: "wp-westeros",
  },
  {
    id: "heisenberg",
    name: "Heisenberg",
    subtitle: "Breaking Bad — çöl tozu",
    category: "series",
    accent: "#ffd60a",
    accentHover: "#ffe033",
    accentSoft: "rgba(255, 214, 10, 0.14)",
    bg0: "#0c0a06",
    bg1: "#141008",
    bg2: "#1c160c",
    bg3: "#261e10",
    text: "#f5f0e0",
    textMuted: "#b0a480",
    glass: "rgba(12, 10, 6, 0.22)",
    wallpaper: "wp-heisenberg",
  },
  {
    id: "hawkins",
    name: "Hawkins",
    subtitle: "Stranger Things — ters dünya",
    category: "series",
    accent: "#e03131",
    accentHover: "#f03e3e",
    accentSoft: "rgba(224, 49, 49, 0.15)",
    bg0: "#08060e",
    bg1: "#0e0a18",
    bg2: "#141022",
    bg3: "#1a162c",
    text: "#ece8f4",
    textMuted: "#9888b8",
    glass: "rgba(8, 6, 14, 0.22)",
    wallpaper: "wp-hawkins",
  },
  {
    id: "nightcity",
    name: "Night City",
    subtitle: "Cyberpunk: Edgerunners — neon sokaklar",
    category: "series",
    accent: "#ff2a6d",
    accentHover: "#ff4d88",
    accentSoft: "rgba(255, 42, 109, 0.15)",
    bg0: "#0a0612",
    bg1: "#100a1c",
    bg2: "#160e28",
    bg3: "#1e1234",
    text: "#f0e8ff",
    textMuted: "#9888c0",
    glass: "rgba(10, 6, 18, 0.22)",
    wallpaper: "wp-nightcity",
  },
];

export function getTheme(id: string): ThemeDefinition {
  const resolved = id === "matrix" ? "midnight" : id;
  return THEMES.find((t) => t.id === resolved) ?? THEMES[0];
}

export function applyTheme(themeId: string) {
  const t = getTheme(themeId);
  const root = document.documentElement;
  const isSeries = t.category === "series";

  root.style.setProperty("--accent", t.accent);
  root.style.setProperty("--accent-hover", t.accentHover);
  root.style.setProperty("--accent-soft", t.accentSoft);
  root.style.setProperty("--accent-glow", t.accent.replace(")", ", 0.4)").replace("rgb", "rgba").replace("#", "")); // fallback
  root.style.setProperty("--bg-0", t.bg0);
  root.style.setProperty("--bg-1", t.bg1);
  root.style.setProperty("--bg-2", t.bg2);
  root.style.setProperty("--bg-3", t.bg3);
  root.style.setProperty("--text", t.text);
  root.style.setProperty("--text-muted", t.textMuted);
  root.style.setProperty("--text-msg", isSeries ? "#f2f2f5" : t.text);
  root.style.setProperty("--glass", isSeries ? "transparent" : t.glass);
  root.style.setProperty("--surface-hover", isSeries ? "rgba(255,255,255,0.06)" : t.bg3);
  root.style.setProperty("--border", isSeries ? "transparent" : t.bg3);
  root.style.setProperty("--border-soft", isSeries ? "transparent" : t.bg2);
  root.dataset.theme = t.id;
  root.dataset.wallpaper = t.wallpaper;
  root.dataset.themeCategory = t.category;
}
