const DEFAULT_PALETTE = {
  primary: "#8F1028",
  primaryDark: "#68101F",
  accent: "#E65319",
  accentDark: "#B93B0D",
  tint: "#F8E7EA",
  accentTint: "#FDE8DF",
  accentSoft: "#F6C2AE",
  tintBorder: "#E4B3BC",
  onPrimaryMuted: "#F6D5DC",
};

let livePalette = DEFAULT_PALETTE;

export function setLivePalette(palette) {
  livePalette = palette || DEFAULT_PALETTE;
}

export function getLivePalette() {
  return livePalette;
}

export function mix(hex, target, amount) {
  const raw = String(hex || "").replace("#", "");
  const into = String(target || "").replace("#", "");
  if (raw.length !== 6 || into.length !== 6) return "#F7E8EA";
  const channel = (from, to) => Math.round(parseInt(from, 16) * (1 - amount) + parseInt(to, 16) * amount);
  const pair = (from, to) => channel(from, to).toString(16).padStart(2, "0");
  return `#${pair(raw.slice(0, 2), into.slice(0, 2))}${pair(raw.slice(2, 4), into.slice(2, 4))}${pair(raw.slice(4, 6), into.slice(4, 6))}`.toUpperCase();
}

export function tint(hex, amount = 0.14) {
  return mix(hex, "#FFFFFF", 1 - amount);
}

export function darken(hex, amount = 0.22) {
  return mix(hex, "#000000", amount);
}

export function buildPalette(theme) {
  const primary = theme?.primary || DEFAULT_PALETTE.primary;
  const accent = theme?.accent || DEFAULT_PALETTE.accent;
  return {
    primary,
    primaryDark: darken(primary, 0.24),
    accent,
    accentDark: darken(accent, 0.18),
    tint: tint(primary, 0.1),
    accentTint: tint(accent, 0.16),
    accentSoft: tint(accent, 0.42),
    tintBorder: tint(primary, 0.32),
    onPrimaryMuted: tint(primary, 0.22),
  };
}

const BRAND_HEX = {
  "#8F1028": "primary",
  "#68101F": "primaryDark",
  "#F06412": "accent",
  "#C94708": "accentDark",
  "#E65319": "accent",
  "#B93B0D": "accentDark",
  "#F5A524": "accent",
  "#C2410C": "accentDark",
  "#A83C08": "accentDark",
  "#FFF4EC": "tint",
  "#FFF2EC": "tint",
  "#FFF1EB": "tint",
  "#FFF0EA": "tint",
  "#FFF5ED": "tint",
  "#FFF7ED": "accentTint",
  "#FFF9F4": "tint",
  "#FCF3EE": "tint",
  "#F5EFEB": "tint",
  "#FCFAF8": "tint",
  "#FBF9F7": "tint",
  "#FED7AA": "accentTint",
  "#FBE6D3": "tintBorder",
  "#F0D3C3": "tintBorder",
  "#F1B29C": "accentSoft",
  "#E6A177": "accentSoft",
  "#E8C2CA": "tintBorder",
  "#D9ADB6": "tintBorder",
  "#D7A9B2": "tintBorder",
  "#F1CDD4": "onPrimaryMuted",
  "#F4DCE1": "onPrimaryMuted",
  "#F3CDD4": "onPrimaryMuted",
  "#F4DDE1": "onPrimaryMuted",
  "#F0EAE1": "onPrimaryMuted",
};

function paint(style, palette) {
  if (!style || typeof style !== "object") return remap(style, palette);
  if (Array.isArray(style)) return style.map((item) => paint(item, palette));
  const next = {};
  for (const key of Object.keys(style)) {
    const value = style[key];
    next[key] = value && typeof value === "object" ? paint(value, palette) : remap(value, palette);
  }
  return next;
}

function remap(value, palette) {
  if (typeof value !== "string") return value;
  const role = BRAND_HEX[value.toUpperCase()];
  return role ? palette[role] : value;
}

export function bindBrandStyles(definitions) {
  const keys = Object.keys(definitions);
  let paletteRef = null;
  let painted = null;
  return new Proxy(definitions, {
    get(_target, key) {
      if (typeof key !== "string") return undefined;
      const palette = getLivePalette();
      if (palette !== paletteRef) {
        paletteRef = palette;
        painted = {};
        for (const name of keys) painted[name] = paint(definitions[name], palette);
      }
      return painted[key];
    },
    ownKeys() {
      return keys;
    },
    getOwnPropertyDescriptor(_target, key) {
      if (!keys.includes(key)) return undefined;
      return { enumerable: true, configurable: true };
    },
  });
}

export function syncBrandColors(colors, palette) {
  colors.brandBrown = palette.primary;
  colors.brandBrownDark = palette.primaryDark;
  colors.brandOrange = palette.accent;
  colors.brandOrangeDark = palette.accentDark;
  colors.brandTint = palette.tint;
  colors.saffron = palette.accent;
  colors.saffronDark = palette.accentDark;
  colors.marigold = palette.accent;
  colors.accentTint = palette.accentTint;
}
