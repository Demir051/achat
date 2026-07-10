export const BOT_TYPES = {
  PROFANITY_FILTER: {
    type: "PROFANITY_FILTER",
    name: "Küfür Filtresi",
    description: "Küfür içeren mesajları otomatik sansürler veya engeller",
    defaultConfig: { mode: "filter" as "filter" | "block" },
  },
  WELCOME: {
    type: "WELCOME",
    name: "Karşılama Botu",
    description: "Yeni üyelere özel karşılama mesajı gönderir",
    defaultConfig: {
      message: "Hoş geldin {user}! 🎉 Sunucumuza katıldın — keyfini çıkar!",
    },
  },
  DICE: {
    type: "DICE",
    name: "Zar Botu",
    description: "!zar veya !dice yazınca 1-6 arası sayı atar",
    defaultConfig: {},
  },
  JOKE: {
    type: "JOKE",
    name: "Şaka Botu",
    description: "!şaka veya !joke yazınca rastgele şaka söyler",
    defaultConfig: {},
  },
  EIGHT_BALL: {
    type: "EIGHT_BALL",
    name: "8 Ball",
    description: "!8ball [soru] — sihirli 8 top cevap verir",
    defaultConfig: {},
  },
} as const;

export type BotType = keyof typeof BOT_TYPES;

const JOKES = [
  "Neden bilgisayar soğuk algınlığına yakalandı? Çünkü Windows'u açık bırakmış! 😄",
  "Programcı neden gözlük takar? Çünkü C# göremez! 🤓",
  "Discord değil achat — ama yine de eğlenceliyiz!",
  "Bug değil, özellik derler... sonra hotfix gelir. 🔥",
];

const EIGHT_BALL = [
  "Kesinlikle evet!", "Bence evet.", "Şüphesiz.", "Evet.", "Belirtiler evet diyor.",
  "Belirsiz, tekrar dene.", "Daha sonra sor.", "Şimdi söyleme.", "Odaklan ve tekrar sor.",
  "Buna güvenme.", "Cevabım hayır.", "Kaynaklarım hayır diyor.", "Kesinlikle hayır.",
];

export function processBotCommand(content: string): string | null {
  const cmd = content.trim().toLowerCase();
  if (cmd === "!zar" || cmd === "!dice") {
    return `🎲 Zar: **${Math.floor(Math.random() * 6) + 1}**`;
  }
  if (cmd === "!şaka" || cmd === "!joke" || cmd === "!saka") {
    return JOKES[Math.floor(Math.random() * JOKES.length)];
  }
  if (cmd.startsWith("!8ball") || cmd.startsWith("!8top")) {
    const ans = EIGHT_BALL[Math.floor(Math.random() * EIGHT_BALL.length)];
    return `🎱 ${ans}`;
  }
  if (cmd === "!coin" || cmd === "!yazitura") {
    return Math.random() > 0.5 ? "🪙 Yazı!" : "🪙 Tura!";
  }
  return null;
}

export function getDefaultBots() {
  return [
    { type: "PROFANITY_FILTER", name: "Küfür Filtresi", enabled: true, config: JSON.stringify(BOT_TYPES.PROFANITY_FILTER.defaultConfig) },
    { type: "WELCOME", name: "Karşılama Botu", enabled: true, config: JSON.stringify(BOT_TYPES.WELCOME.defaultConfig) },
    { type: "DICE", name: "Zar Botu", enabled: true, config: "{}" },
    { type: "JOKE", name: "Şaka Botu", enabled: true, config: "{}" },
  ];
}

export function getDefaultRoles() {
  return [
    { name: "everyone", color: "#99aab5", position: 0, mentionable: true },
    { name: "Moderator", color: "#e74c3c", position: 1, mentionable: true },
    { name: "VIP", color: "#f1c40f", position: 2, mentionable: true },
  ];
}
