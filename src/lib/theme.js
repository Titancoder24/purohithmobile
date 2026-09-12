// Purohith Connect — theme tokens (mirrors /app/frontend/tailwind/CSS vars).
export const colors = {
  brandBrown: "#8F1028",
  brandBrownDark: "#68101F",
  brandOrange: "#F06412",
  brandOrangeDark: "#C94708",
  brandTint: "#FFF4EC",
  saffron: "#E65319",
  saffronDark: "#B93B0D",
  marigold: "#F5A524",
  ink: "#191919",
  muted: "#F6F6F4",
  muted2: "#686864",
  warmBorder: "#E7E7E3",
  cotton: "#FFFFFF",
  cottonDark: "#F7F7F7",
  white: "#FFFFFF",
  danger: "#B91C1C",
  success: "#15803D",
  info: "#1D4ED8",
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 };
export const radii = { sm: 8, md: 10, lg: 12, xl: 16, pill: 999 };
export const font = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  heading: "Inter_700Bold",
  body: "Inter_400Regular",
  sizes: { xs: 11, sm: 13, base: 15, lg: 17, xl: 20, h2: 24, h1: 30 },
};

export const type = {
  display: { fontFamily: font.semibold, fontSize: 30, lineHeight: 36, color: colors.ink },
  title: { fontFamily: font.semibold, fontSize: 24, lineHeight: 30, color: colors.ink },
  section: { fontFamily: font.semibold, fontSize: 19, lineHeight: 24, color: colors.ink },
  body: { fontFamily: font.regular, fontSize: 14, lineHeight: 20, color: colors.ink },
  secondary: { fontFamily: font.regular, fontSize: 12, lineHeight: 18, color: colors.muted2 },
  label: { fontFamily: font.semibold, fontSize: 12, lineHeight: 16, color: colors.ink },
  eyebrow: { fontFamily: font.bold, fontSize: 10, lineHeight: 14, color: colors.saffron, letterSpacing: .7 },
};

export const shadow = {
  card: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  saffron: {
    shadowColor: "#8F1028",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 10,
    elevation: 3,
  },
};

// Status pill styles (matches web STATUS_STYLES).
export const statusPill = {
  pending: { bg: "#FEF3C7", fg: "#B45309" },
  confirmed: { bg: "#FED7AA", fg: "#C2410C" },
  completed: { bg: "#DCFCE7", fg: "#166534" },
  rejected: { bg: "#FEE2E2", fg: "#991B1B" },
  cancelled: { bg: "#E7E0D3", fg: "#78716C" },
  refunded: { bg: "#DBEAFE", fg: "#1D4ED8" },
  paid: { bg: "#DCFCE7", fg: "#166534" },
  open: { bg: "#FEF3C7", fg: "#B45309" },
  in_review: { bg: "#DBEAFE", fg: "#1D4ED8" },
  resolved: { bg: "#DCFCE7", fg: "#166534" },
};
