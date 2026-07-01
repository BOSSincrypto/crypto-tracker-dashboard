/**
 * SEO / social metadata for the homepage (`/`). Kept in a dedicated
 * module so the route file stays focused on composition.
 */
const SITE_NAME = "Crypto Portfolio Tracker";
// Kept under 60 chars for full display in Google SERP.
const TITLE = "Crypto Portfolio Tracker — Live P&L & Allocation";
// Kept under 160 chars.
const DESCRIPTION =
  "Local-first crypto portfolio tracker with live CoinGecko prices, cost-basis P&L, allocation charts and CSV/JSON import & export. No signup.";
const OG_DESCRIPTION = DESCRIPTION;

export const indexHead = () => ({
  meta: [
    { title: TITLE },
    { name: "description", content: DESCRIPTION },
    { name: "keywords", content: "crypto portfolio tracker, bitcoin tracker, cost basis, unrealized pnl, coingecko, portfolio allocation, csv import" },
    { name: "author", content: SITE_NAME },
    { name: "robots", content: "index,follow,max-image-preview:large" },
    { property: "og:title", content: TITLE },
    { property: "og:description", content: OG_DESCRIPTION },
    { property: "og:url", content: "/" },
    { property: "og:type", content: "website" },
    { property: "og:locale", content: "en_US" },
    { name: "twitter:title", content: SITE_NAME },
    { name: "twitter:description", content: "Local-first crypto portfolio tracker with live prices, P&L and CSV/JSON I/O." },
  ],
  links: [{ rel: "canonical", href: "/" }],
  scripts: [
    {
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: SITE_NAME,
        applicationCategory: "FinanceApplication",
        operatingSystem: "Web",
        description:
          "Local-first crypto portfolio tracker with live CoinGecko prices, cost-basis P&L, allocation charts, risk metrics and CSV/JSON import & export.",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        featureList: [
          "Live CoinGecko prices (60s refresh)",
          "Average-cost-basis P&L",
          "Portfolio allocation & value charts",
          "Risk metrics (drawdown, volatility, streaks)",
          "Monthly cash-flow breakdown",
          "Multi-portfolio support",
          "CSV & JSON import / export",
          "Local-first — data stays in your browser",
        ],
      }),
    },
  ],
});