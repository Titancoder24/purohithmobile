const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const output = path.join(root, "dist");
const areas = require(path.join(root, "src/data/bangalore-areas.json"));
const site = "https://purohithconnect.com";
const route = "purohit-near-me";
const updated = new Date().toISOString().slice(0, 10);

const zoneCopy = {
  Central: "central Bengaluru apartments, independent homes, community halls, and traditional neighbourhoods",
  East: "east Bengaluru homes, gated communities, apartments, and technology corridor neighbourhoods",
  "North East": "north-east Bengaluru homes, new residential communities, and established neighbourhoods",
  North: "north Bengaluru homes, apartment communities, and airport-corridor neighbourhoods",
  South: "south Bengaluru homes, traditional neighbourhoods, apartments, and community halls",
  "South East": "south-east Bengaluru apartments, gated communities, and growing residential neighbourhoods",
  West: "west Bengaluru homes, established layouts, apartments, and community halls",
};

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function nearby(area) {
  const sameZone = areas.filter((item) => item.zone === area.zone && item.slug !== area.slug);
  const start = areas.findIndex((item) => item.slug === area.slug) % Math.max(1, sameZone.length);
  return [...sameZone.slice(start), ...sameZone.slice(0, start)].slice(0, 6);
}

function structuredData(area, related) {
  const canonical = `${site}/${route}/${area.slug}`;
  const faqs = [
    ["How can I find a purohit near me in " + area.name + "?", "Choose a ceremony, compare available Purohith Connect profiles serving " + area.name + ", and send a booking request with your date, language, and address."],
    ["Which poojas can I book in " + area.name + "?", "Common requests include Satyanarayana Puja, Griha Pravesh, Rudra Abhishek, Ganesh Puja, Navagraha Shanti, Namakarana, and Vivaha ceremonies."],
    ["Can I compare prices before booking?", "Yes. Review profile pricing or request proposals from suitable purohits before choosing a provider."],
  ];
  return JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        "@id": `${canonical}#service`,
        name: `Purohit booking in ${area.name}, Bangalore`,
        serviceType: "Hindu priest and pooja booking service",
        provider: { "@type": "Organization", name: "Purohith Connect", url: site },
        areaServed: { "@type": "Place", name: `${area.name}, Bengaluru, Karnataka` },
        availableChannel: { "@type": "ServiceChannel", serviceUrl: canonical },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: site },
          { "@type": "ListItem", position: 2, name: "Bangalore areas", item: `${site}/${route}` },
          { "@type": "ListItem", position: 3, name: area.name, item: canonical },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: faqs.map(([name, text]) => ({ "@type": "Question", name, acceptedAnswer: { "@type": "Answer", text } })),
      },
      {
        "@type": "ItemList",
        name: `Nearby purohit service areas around ${area.name}`,
        itemListElement: related.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.name, url: `${site}/${route}/${item.slug}` })),
      },
    ],
  }).replaceAll("<", "\\u003c");
}

function shell({ title, description, canonical, body, jsonLd = "" }) {
  return `<!doctype html>
<html lang="en-IN"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}"><meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">
<link rel="canonical" href="${canonical}"><link rel="icon" href="/favicon.png">
<meta property="og:type" content="website"><meta property="og:site_name" content="Purohith Connect"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${site}/seo-purohit.webp">
<meta name="twitter:card" content="summary_large_image"><meta name="theme-color" content="#8f1d2c">
${jsonLd ? `<script type="application/ld+json">${jsonLd}</script>` : ""}
<style>
:root{--wine:#8f1d2c;--orange:#eb5b16;--ink:#241c17;--muted:#6d625b;--line:#e7ded7;--soft:#fff7f1}*{box-sizing:border-box}body{margin:0;color:var(--ink);background:#fff;font:16px/1.6 Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}a{color:inherit}.wrap{width:min(1160px,calc(100% - 40px));margin:auto}.top{height:72px;border-bottom:1px solid var(--line);display:flex;align-items:center;background:#fff}.nav{display:flex;align-items:center;justify-content:space-between}.brand{font:800 20px Georgia,serif;color:var(--wine);text-decoration:none}.brand b{color:var(--orange)}.navlinks{display:flex;gap:24px;align-items:center;font-size:14px;font-weight:700}.button{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 20px;border-radius:8px;background:var(--wine);color:#fff;text-decoration:none;font-weight:800;box-shadow:0 5px 0 #5f111d;transition:transform .16s,box-shadow .16s}.button:hover{transform:translateY(-2px);box-shadow:0 7px 0 #5f111d}.button:active{transform:translateY(3px);box-shadow:0 2px 0 #5f111d}.button.alt{background:#fff;color:var(--wine);border:1px solid #d9b5bb;box-shadow:0 4px 0 #ead9dc}.hero{padding:70px 0 58px;background:linear-gradient(180deg,#fff 0,#fff9f5 100%)}.hero-grid{display:grid;grid-template-columns:1.1fr .9fr;gap:54px;align-items:center}.crumb{font-size:13px;color:var(--muted);margin-bottom:28px}.eyebrow{font-size:12px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;color:var(--orange)}h1{font:700 clamp(42px,6vw,76px)/1.03 Georgia,serif;letter-spacing:0;margin:12px 0 22px;max-width:780px}h1 em{font-style:normal;color:var(--wine)}.lead{font-size:19px;color:var(--muted);max-width:680px}.actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:28px}.trust{display:flex;gap:18px;flex-wrap:wrap;margin-top:26px;font-size:13px;font-weight:750}.trust span:before{content:"✓";color:var(--orange);margin-right:7px}.hero img{width:100%;aspect-ratio:4/5;object-fit:cover;border-radius:8px;box-shadow:18px 18px 0 #f2d5c4}.band{padding:72px 0}.band.soft{background:var(--soft)}h2{font:700 clamp(30px,4vw,46px)/1.12 Georgia,serif;letter-spacing:0;margin:8px 0 14px}.section-copy{color:var(--muted);max-width:720px}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:32px}.card{border:1px solid var(--line);padding:24px;border-radius:8px;background:#fff}.card strong{display:block;font-size:18px}.card p{font-size:14px;color:var(--muted);margin:7px 0 0}.steps{display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid var(--line);margin-top:30px}.step{padding:26px 28px 0 0}.step b{color:var(--orange);font-size:12px}.faq{display:grid;grid-template-columns:.75fr 1.25fr;gap:48px}.faq details{border-top:1px solid var(--line);padding:18px 0}.faq summary{font-weight:800;cursor:pointer}.faq details p{color:var(--muted);margin:10px 0 0}.nearby{display:flex;flex-wrap:wrap;gap:9px;margin-top:24px}.nearby a{padding:9px 12px;border:1px solid var(--line);border-radius:7px;text-decoration:none;background:#fff;font-size:14px}.cta{background:var(--wine);color:#fff;padding:58px 0}.cta-row{display:flex;justify-content:space-between;align-items:center;gap:30px}.cta p{color:#f0d7db;margin:8px 0 0}.cta .button{background:var(--orange);box-shadow:0 5px 0 #9f3508}.footer{padding:30px 0;color:var(--muted);font-size:13px;border-top:1px solid var(--line)}
@media(max-width:760px){.wrap{width:min(100% - 28px,620px)}.top{height:62px}.navlinks>a:not(.button){display:none}.hero{padding:42px 0}.hero-grid,.faq{grid-template-columns:1fr}.hero img{max-height:440px;box-shadow:9px 9px 0 #f2d5c4}.cards,.steps{grid-template-columns:1fr}.step{padding-right:0}.band{padding:52px 0}.cta-row{align-items:flex-start;flex-direction:column}h1{font-size:43px}.lead{font-size:17px}}
@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important}}
</style></head><body>${body}</body></html>`;
}

function areaPage(area) {
  const related = nearby(area);
  const canonical = `${site}/${route}/${area.slug}`;
  const title = `Purohit Near Me in ${area.name}, Bangalore | Purohith Connect`;
  const description = `Find and book available purohits in ${area.name}, Bangalore. Compare ceremony expertise, languages, pricing, profiles, and proposals with Purohith Connect.`;
  const zone = zoneCopy[area.zone] || "Bengaluru homes and community venues";
  const serviceCards = [
    ["Griha Pravesh", "Housewarming rituals, homa, and ceremony planning."],
    ["Satyanarayana Puja", "Profile matching for language, tradition, date, and budget."],
    ["Rudra Abhishek", "Find experienced purohits for abhisheka and related rituals."],
    ["Ganesh Puja", "Book for homes, offices, festivals, and auspicious beginnings."],
    ["Navagraha Shanti", "Compare providers for shanti pooja and homa requirements."],
    ["Namakarana and Vivaha", "Browse family ceremony profiles and request proposals."],
  ];
  const body = `<header class="top"><div class="wrap nav"><a class="brand" href="/">Purohith <b>Connect</b></a><nav class="navlinks"><a href="/${route}">Bangalore areas</a><a href="/">Open app</a><a class="button" href="/priests?area=${encodeURIComponent(area.name)}">Find a purohit</a></nav></div></header>
<main><section class="hero"><div class="wrap hero-grid"><div><div class="crumb"><a href="/">Home</a> / <a href="/${route}">Bangalore</a> / ${escapeHtml(area.name)}</div><div class="eyebrow">Serving ${escapeHtml(area.name)} and nearby</div><h1>Find a trusted <em>purohit near you</em> in ${escapeHtml(area.name)}</h1><p class="lead">Plan your ceremony with available Purohith Connect providers serving ${escapeHtml(area.name)}. Compare experience, languages, ceremony specialties, price guidance, and proposals before you decide.</p><div class="actions"><a class="button" href="/priests?area=${encodeURIComponent(area.name)}">Browse purohit profiles</a><a class="button alt" href="/request-pooja?area=${encodeURIComponent(area.name)}">Request proposals</a></div><div class="trust"><span>Profile-based matching</span><span>Clear booking details</span><span>Local service coverage</span></div></div><img src="/seo-purohit.webp" width="720" height="900" alt="Purohit preparing a traditional home ceremony in Bengaluru"></div></section>
<section class="band"><div class="wrap"><div class="eyebrow">Ceremonies in ${escapeHtml(area.name)}</div><h2>Choose the ritual. Compare the right provider.</h2><p class="section-copy">Purohith Connect helps families in ${escapeHtml(zone)} find suitable providers without relying on one-size-fits-all listings.</p><div class="cards">${serviceCards.map(([name, copy]) => `<article class="card"><strong>${name}</strong><p>${copy}</p></article>`).join("")}</div></div></section>
<section class="band soft"><div class="wrap"><div class="eyebrow">A simpler booking flow</div><h2>From ceremony details to a confirmed purohit</h2><div class="steps"><div class="step"><b>01</b><h3>Share the occasion</h3><p>Choose the pooja, date, preferred language, address in ${escapeHtml(area.name)}, and budget.</p></div><div class="step"><b>02</b><h3>Review your options</h3><p>Browse relevant profiles or compare proposals from providers serving your area.</p></div><div class="step"><b>03</b><h3>Confirm with clarity</h3><p>Select the provider and keep booking, messages, and ceremony details together.</p></div></div></div></section>
<section class="band"><div class="wrap faq"><div><div class="eyebrow">Direct answers</div><h2>Purohit booking in ${escapeHtml(area.name)}</h2><p class="section-copy">Useful answers for families searching on Google and AI assistants.</p></div><div><details open><summary>How can I find a purohit near me in ${escapeHtml(area.name)}?</summary><p>Choose a ceremony, compare available profiles serving ${escapeHtml(area.name)}, and submit your date, language, and address.</p></details><details><summary>Which poojas can I book?</summary><p>Popular requests include Satyanarayana Puja, Griha Pravesh, Rudra Abhishek, Ganesh Puja, Navagraha Shanti, Namakarana, and Vivaha.</p></details><details><summary>Can I compare prices before booking?</summary><p>Yes. Review profile pricing or request proposals from suitable purohits before selecting a provider.</p></details></div></div></section>
<section class="band soft"><div class="wrap"><div class="eyebrow">Nearby service areas</div><h2>Explore purohits across ${escapeHtml(area.zone)} Bangalore</h2><div class="nearby">${related.map((item) => `<a href="/${route}/${item.slug}">${escapeHtml(item.name)}</a>`).join("")}</div></div></section>
<section class="cta"><div class="wrap cta-row"><div><div class="eyebrow" style="color:#ffb48d">Start with your ceremony</div><h2>Find a purohit serving ${escapeHtml(area.name)}</h2><p>Browse profiles or invite proposals from the same booking flow.</p></div><a class="button" href="/priests?area=${encodeURIComponent(area.name)}">View available profiles</a></div></section></main>
<footer class="footer"><div class="wrap">Purohith Connect · Bengaluru, Karnataka · <a href="/${route}">All service areas</a></div></footer>`;
  return shell({ title, description, canonical, body, jsonLd: structuredData(area, related) });
}

function indexPage() {
  const canonical = `${site}/${route}`;
  const groups = Object.groupBy ? Object.groupBy(areas, (area) => area.zone) : areas.reduce((all, area) => ({ ...all, [area.zone]: [...(all[area.zone] || []), area] }), {});
  const body = `<header class="top"><div class="wrap nav"><a class="brand" href="/">Purohith <b>Connect</b></a><nav class="navlinks"><a href="/">Open app</a><a class="button" href="/priests">Browse profiles</a></nav></div></header><main><section class="hero"><div class="wrap"><div class="eyebrow">Bengaluru service directory</div><h1>Find a purohit <em>near you</em> in Bangalore</h1><p class="lead">Explore 100 Bengaluru neighbourhoods served by Purohith Connect. Choose your area to view booking guidance, common ceremonies, nearby coverage, and relevant provider profiles.</p></div></section><section class="band"><div class="wrap">${Object.entries(groups).map(([zone, list]) => `<div style="margin-bottom:36px"><div class="eyebrow">${escapeHtml(zone)} Bangalore</div><div class="nearby">${list.map((area) => `<a href="/${route}/${area.slug}">${escapeHtml(area.name)}</a>`).join("")}</div></div>`).join("")}</div></section></main><footer class="footer"><div class="wrap">Purohith Connect · Bengaluru, Karnataka</div></footer>`;
  return shell({ title: "Purohit Near Me in Bangalore | 100 Service Areas", description: "Find Purohith Connect service pages for 100 Bangalore neighbourhoods and compare suitable purohits for your ceremony.", canonical, body });
}

if (areas.length !== 100) throw new Error(`Expected 100 Bangalore areas, received ${areas.length}`);
fs.mkdirSync(output, { recursive: true });
const sourceImage = path.join(root, "assets/images/hero-purohit.webp");
if (fs.existsSync(sourceImage)) fs.copyFileSync(sourceImage, path.join(output, "seo-purohit.webp"));
const favicon = path.join(root, "assets/favicon.png");
if (fs.existsSync(favicon)) fs.copyFileSync(favicon, path.join(output, "favicon.png"));
for (const area of areas) {
  const directory = path.join(output, route, area.slug);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, "index.html"), areaPage(area));
}
fs.mkdirSync(path.join(output, route), { recursive: true });
fs.writeFileSync(path.join(output, route, "index.html"), indexPage());
const sitemapUrls = ["", route, ...areas.map((area) => `${route}/${area.slug}`)];
fs.writeFileSync(path.join(output, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapUrls.map((url, index) => `  <url><loc>${site}/${url}</loc><lastmod>${updated}</lastmod><changefreq>${index < 2 ? "weekly" : "monthly"}</changefreq><priority>${index === 0 ? "1.0" : index === 1 ? "0.9" : "0.7"}</priority></url>`).join("\n")}\n</urlset>\n`);
fs.writeFileSync(path.join(output, "robots.txt"), `User-agent: *\nAllow: /\nDisallow: /Profile\nDisallow: /Settings\nSitemap: ${site}/sitemap.xml\n`);
fs.writeFileSync(path.join(output, "llms.txt"), `# Purohith Connect\n\nPurohith Connect is a Bengaluru marketplace for families to find and request available Hindu priests for home ceremonies.\n\n## Canonical resources\n- Main site: ${site}/\n- Bangalore service areas: ${site}/${route}\n- Provider marketplace: ${site}/priests\n\n## Core services\nSatyanarayana Puja, Griha Pravesh, Rudra Abhishek, Ganesh Puja, Navagraha Shanti, Varamahalakshmi Vratha, Namakarana, and Vivaha.\n\nLocation pages describe service coverage and the booking process. Availability and pricing must be confirmed through current provider profiles or proposals.\n`);
console.log(`Generated ${areas.length} local landing pages, sitemap.xml, robots.txt, and llms.txt.`);
