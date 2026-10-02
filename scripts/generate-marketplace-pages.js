const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const output = path.join(root, "dist");
const areas = require(path.join(root, "src/data/bangalore-areas.json"));
const site = "https://purohithconnect.com";

function loadEnvFile() {
  const filename = path.join(root, ".env");
  if (!fs.existsSync(filename)) return;
  for (const line of fs.readFileSync(filename, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
}

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function schema(value) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

function money(value) {
  return Number(value || 0).toLocaleString("en-IN");
}

function label(value) {
  return String(value || "").split("-").map((part) => part ? part[0].toUpperCase() + part.slice(1) : "").join(" ");
}

function nearby(area) {
  const same = areas.filter((item) => item.zone === area.zone && item.slug !== area.slug);
  const start = areas.findIndex((item) => item.slug === area.slug) % Math.max(same.length, 1);
  return [...same.slice(start), ...same.slice(0, start)].slice(0, 10);
}

async function fetchProfiles() {
  loadEnvFile();
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase build configuration is required for marketplace page generation.");
  const select = "id,slug,display_name,profile_headline,bio,years_experience,languages,service_areas,pooja_slugs,photo_url,portfolio_urls,verification_status,rating,review_count,tradition,starting_price_inr,max_price_inr,primary_service_area,submitted_at";
  const response = await fetch(`${url}/rest/v1/priest_profiles?select=${encodeURIComponent(select)}&verification_status=eq.verified&order=rating.desc`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!response.ok) throw new Error(`Could not load verified priests (${response.status}).`);
  const records = await response.json();
  return records.filter((profile) => profile.slug && profile.photo_url && profile.submitted_at);
}

function layout({ title, description, canonical, content, jsonLd }) {
  return `<!doctype html><html lang="en-IN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1"><link rel="canonical" href="${canonical}"><link rel="icon" href="/favicon.png"><meta property="og:type" content="website"><meta property="og:site_name" content="Purohith Connect"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${site}/seo-logo.png"><meta name="twitter:card" content="summary_large_image"><meta name="theme-color" content="#8f1d2c">${jsonLd ? `<script type="application/ld+json">${jsonLd}</script>` : ""}<style>
:root{--wine:#8f1d2c;--orange:#ed5b1a;--ink:#231c18;--muted:#71665f;--line:#e8dfd9;--soft:#fff7f2;--green:#167b55}*{box-sizing:border-box}body{margin:0;color:var(--ink);background:#fff;font:15px/1.55 Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}a{color:inherit}.wrap{width:min(1180px,calc(100% - 40px));margin:auto}.top{height:76px;border-bottom:1px solid var(--line);background:#fff;display:flex;align-items:center}.nav{display:flex;align-items:center;justify-content:space-between;gap:24px}.brand{display:flex;align-items:center;gap:10px;text-decoration:none;font-weight:900}.brand img{width:58px;height:58px;object-fit:contain}.brand span{color:var(--wine);font:800 19px Georgia,serif}.brand b{color:var(--orange)}.links{display:flex;gap:22px;align-items:center;font-size:13px;font-weight:750}.button{min-height:46px;padding:0 19px;border:0;border-radius:8px;background:var(--wine);color:#fff;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;font-weight:850;box-shadow:0 4px 0 #62131f;transition:.16s}.button:hover{transform:translateY(-2px);box-shadow:0 6px 0 #62131f}.button:active{transform:translateY(2px);box-shadow:0 2px 0 #62131f}.button.light{background:#fff;color:var(--wine);border:1px solid #dcbfc3;box-shadow:0 3px 0 #ecdcde}.hero{padding:64px 0;background:linear-gradient(180deg,#fff9f6,#fff)}.hero-grid{display:grid;grid-template-columns:1.08fr .92fr;align-items:center;gap:54px}.eyebrow{color:var(--orange);font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.12em}.crumb{font-size:12px;color:var(--muted);margin-bottom:24px}.crumb a{text-decoration:none}.hero h1,.profile-title{font:750 clamp(40px,5.4vw,70px)/1.04 Georgia,serif;letter-spacing:0;margin:10px 0 18px}.hero h1 em{font-style:normal;color:var(--wine)}.lead{max-width:690px;color:var(--muted);font-size:18px}.search{display:grid;grid-template-columns:1fr 1fr auto;gap:8px;margin-top:28px;padding:8px;border:1px solid var(--line);background:#fff;border-radius:8px;box-shadow:0 12px 35px rgba(80,35,22,.08)}.search span{min-height:48px;padding:0 14px;display:flex;align-items:center;border-right:1px solid var(--line);color:var(--muted)}.hero-art{min-height:390px;position:relative;display:flex;align-items:center;justify-content:center}.hero-art:before,.hero-art:after{content:"";position:absolute;inset:15% 8%;border:1px solid #f0cbb9;border-radius:50%}.hero-art:after{inset:4% 24%;border-color:#e8b6a0}.hero-art img{width:min(390px,90%);height:390px;object-fit:contain;position:relative;z-index:1}.section{padding:70px 0}.section.soft{background:var(--soft)}.heading-row{display:flex;justify-content:space-between;align-items:flex-end;gap:25px;margin-bottom:28px}.heading-row h2,.content-block h2{font:750 36px/1.1 Georgia,serif;margin:7px 0 0}.heading-row p{color:var(--muted);max-width:600px;margin:8px 0 0}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.profile-card{border:1px solid var(--line);background:#fff;border-radius:8px;overflow:hidden;text-decoration:none;transition:.18s;box-shadow:0 7px 24px rgba(49,31,22,.045)}.profile-card:hover{transform:translateY(-4px);box-shadow:0 16px 34px rgba(49,31,22,.1)}.profile-card img{width:100%;aspect-ratio:4/3;object-fit:cover;background:var(--soft)}.card-body{padding:17px}.card-top{display:flex;justify-content:space-between;gap:12px}.card-top strong{font-size:17px}.rating{font-weight:850;color:var(--wine);white-space:nowrap}.card-body p{color:var(--muted);font-size:13px;margin:7px 0}.tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}.tag{padding:5px 8px;border-radius:999px;background:var(--soft);font-size:10px;font-weight:750}.price{margin-top:14px;font-weight:850}.empty{padding:28px;border:1px dashed #d9c9c0;border-radius:8px;color:var(--muted);background:#fff}.steps{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid var(--line);border-radius:8px;overflow:hidden}.step{padding:28px;border-right:1px solid var(--line);background:#fff}.step:last-child{border-right:0}.step b{color:var(--orange);font-size:12px}.step h3{margin:12px 0 7px;font-size:18px}.step p{color:var(--muted);margin:0;font-size:13px}.faq details{border-top:1px solid var(--line);padding:18px 0}.faq summary{font-weight:800;cursor:pointer}.faq p{color:var(--muted)}.area-links{display:flex;flex-wrap:wrap;gap:8px}.area-links a{border:1px solid var(--line);border-radius:7px;padding:9px 12px;text-decoration:none;background:#fff;font-size:13px}.profile-shell{display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:50px;align-items:start;padding:58px 0}.profile-main{min-width:0}.profile-title{font-size:48px;max-width:760px}.profile-meta{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0}.profile-meta span{padding:7px 10px;border-radius:999px;background:var(--soft);font-size:12px;font-weight:750}.content-block{padding:32px 0;border-top:1px solid var(--line)}.content-block h2{font-size:28px}.content-block p{color:var(--muted);font-size:15px}.portfolio{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.portfolio img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:8px}.service-list{display:grid;grid-template-columns:1fr 1fr;gap:10px}.service-list span{padding:14px;border:1px solid var(--line);border-radius:7px;font-weight:750}.booking-card{position:sticky;top:24px;border:1px solid var(--line);border-radius:8px;padding:22px;background:#fff;box-shadow:0 16px 45px rgba(62,34,22,.1)}.booking-card img{width:106px;height:106px;border-radius:50%;object-fit:cover;display:block;margin:auto}.booking-card h2{text-align:center;margin:13px 0 4px}.booking-card .rating{text-align:center}.booking-card dl{margin:20px 0}.booking-card dl div{display:flex;justify-content:space-between;padding:10px 0;border-top:1px solid var(--line)}.booking-card dt{color:var(--muted)}.booking-card dd{font-weight:800;margin:0}.booking-card .button{width:100%}.footer{padding:34px 0;border-top:1px solid var(--line);color:var(--muted);font-size:12px}
@media(max-width:800px){.wrap{width:min(calc(100% - 28px),620px)}.top{height:66px}.nav{gap:8px}.brand{gap:5px}.brand img{width:44px;height:44px}.brand span{font-size:15px}.links{gap:0}.links>a:not(.button){display:none}.links .button{min-height:38px;padding:0 10px;font-size:11px}.hero{padding:42px 0}.hero h1{overflow-wrap:anywhere}.hero-grid,.profile-shell{grid-template-columns:1fr}.hero-art{min-height:280px}.hero-art img{height:280px}.search{grid-template-columns:1fr}.search span{border-right:0;border-bottom:1px solid var(--line)}.grid{grid-template-columns:1fr}.section{padding:50px 0}.heading-row{align-items:flex-start;flex-direction:column}.steps{grid-template-columns:1fr}.step{border-right:0;border-bottom:1px solid var(--line)}.profile-shell{gap:24px;padding-top:34px}.profile-title{font-size:39px;overflow-wrap:anywhere}.booking-card{position:static}.portfolio,.service-list{grid-template-columns:1fr}}
body{overflow-x:hidden}@media(prefers-reduced-motion:reduce){*{transition:none!important}}</style></head><body>${content}</body></html>`;
}

function header() {
  return `<header class="top"><div class="wrap nav"><a class="brand" href="/"><img src="/seo-logo.png" alt="Purohith Connect"><span>Purohith <b>Connect</b></span></a><nav class="links"><a href="/purohit-near-me">Bangalore areas</a><a href="/priests">Browse priests</a><a class="button" href="/request-pooja">Request proposals</a></nav></div></header>`;
}

function card(profile) {
  const areasText = (profile.service_areas || []).slice(0, 2).join(" · ");
  return `<a class="profile-card" href="/purohits/${escapeHtml(profile.slug)}"><img src="${escapeHtml(profile.photo_url)}" alt="${escapeHtml(profile.display_name)}, verified purohit in Bengaluru" loading="lazy" width="560" height="420"><div class="card-body"><div class="card-top"><strong>${escapeHtml(profile.display_name)}</strong><span class="rating">★ ${Number(profile.rating || 0).toFixed(1)}</span></div><p>${escapeHtml(profile.profile_headline || profile.tradition || `${profile.years_experience}+ years of experience`)}</p><p>${escapeHtml(areasText)}</p><div class="tags">${(profile.languages || []).slice(0, 3).map((item) => `<span class="tag">${escapeHtml(item)}</span>`).join("")}</div><div class="price">From ₹${money(profile.starting_price_inr)}</div></div></a>`;
}

function areaPage(area, profiles) {
  const matches = profiles.filter((profile) => (profile.service_areas || []).some((name) => name.toLowerCase() === area.name.toLowerCase()));
  const canonical = `${site}/purohit-near-me/${area.slug}`;
  const related = nearby(area);
  const title = `Purohit Near Me in ${area.name}, Bangalore | Purohith Connect`;
  const description = `Compare verified purohits serving ${area.name}, Bangalore by ceremony, language, experience, availability and transparent starting price.`;
  const jsonLd = schema({ "@context": "https://schema.org", "@graph": [
    { "@type": "Service", name: `Purohit booking in ${area.name}`, serviceType: "Hindu priest booking", provider: { "@type": "Organization", name: "Purohith Connect", url: site }, areaServed: { "@type": "Place", name: `${area.name}, Bengaluru` } },
    { "@type": "ItemList", name: `Verified purohits serving ${area.name}`, numberOfItems: matches.length, itemListElement: matches.map((profile, index) => ({ "@type": "ListItem", position: index + 1, name: profile.display_name, url: `${site}/purohits/${profile.slug}` })) },
    { "@type": "FAQPage", mainEntity: [
      { "@type": "Question", name: `How do I find a purohit in ${area.name}?`, acceptedAnswer: { "@type": "Answer", text: `Compare verified profiles tagged for ${area.name}, then book directly or request proposals with your date, language and ceremony address.` } },
      { "@type": "Question", name: "Can I compare prices before booking?", acceptedAnswer: { "@type": "Answer", text: "Yes. Each profile shows starting prices, and proposal requests let eligible priests provide a specific quote." } },
    ] },
  ] });
  const content = `${header()}<main><section class="hero"><div class="wrap hero-grid"><div><div class="crumb"><a href="/">Home</a> / <a href="/purohit-near-me">Bangalore</a> / ${escapeHtml(area.name)}</div><div class="eyebrow">Verified local marketplace</div><h1>Find a trusted <em>purohit near you</em> in ${escapeHtml(area.name)}</h1><p class="lead">Compare experienced priests by language, tradition, ceremony, service coverage and price before you book.</p><div class="search"><span>Any ceremony</span><span>${escapeHtml(area.name)}, Bengaluru</span><a class="button" href="/priests?area=${encodeURIComponent(area.name)}">Search profiles</a></div></div><div class="hero-art"><img src="/seo-logo.png" alt="Purohith Connect booking illustration"></div></div></section><section class="section"><div class="wrap"><div class="heading-row"><div><div class="eyebrow">Serving ${escapeHtml(area.name)}</div><h2>Available verified purohits</h2><p>Profiles appear here only when a verified priest has selected ${escapeHtml(area.name)} as a service area.</p></div><a class="button light" href="/request-pooja?area=${encodeURIComponent(area.name)}">Request proposals</a></div>${matches.length ? `<div class="grid">${matches.map(card).join("")}</div>` : `<div class="empty">No verified priest has published coverage for ${escapeHtml(area.name)} yet. Request proposals and the platform will notify eligible providers.</div>`}</div></section><section class="section soft"><div class="wrap"><div class="heading-row"><div><div class="eyebrow">Simple and accountable</div><h2>Book a ceremony in three steps</h2></div></div><div class="steps"><article class="step"><b>01</b><h3>Choose</h3><p>Select the ceremony, date, language and locality.</p></article><article class="step"><b>02</b><h3>Compare</h3><p>Review verified profiles or receive proposals from eligible priests.</p></article><article class="step"><b>03</b><h3>Confirm</h3><p>Choose your priest and keep booking details, messages and updates together.</p></article></div></div></section><section class="section"><div class="wrap faq"><div class="heading-row"><div><div class="eyebrow">Common questions</div><h2>Purohit services in ${escapeHtml(area.name)}</h2></div></div><details open><summary>How do I find a purohit in ${escapeHtml(area.name)}?</summary><p>Compare verified profiles tagged for ${escapeHtml(area.name)}, or request proposals with the ceremony date, language and exact address.</p></details><details><summary>Can I compare prices?</summary><p>Yes. Profiles show starting prices and proposals provide ceremony-specific quotations.</p></details><details><summary>Which ceremonies are supported?</summary><p>Available categories include Griha Pravesh, Satyanarayana Puja, Rudra Abhishek, Ganesh Puja, Navagraha Shanti, Namakarana and Vivaha.</p></details></div></section><section class="section soft"><div class="wrap"><div class="heading-row"><div><div class="eyebrow">Nearby</div><h2>Explore more Bangalore areas</h2></div></div><div class="area-links">${related.map((item) => `<a href="/purohit-near-me/${item.slug}">${escapeHtml(item.name)}</a>`).join("")}</div></div></section></main><footer class="footer"><div class="wrap">Purohith Connect · Book · Perform · Bless</div></footer>`;
  return layout({ title, description, canonical, content, jsonLd });
}

function profilePage(profile, profiles) {
  const canonical = `${site}/purohits/${profile.slug}`;
  const title = `${profile.display_name} | Purohit in Bangalore | Purohith Connect`;
  const description = `${profile.display_name} is a verified ${profile.tradition || "Vedic"} purohit serving ${(profile.service_areas || []).slice(0, 3).join(", ")}. View ceremonies, languages and pricing.`;
  const similar = profiles.filter((item) => item.id !== profile.id && (item.service_areas || []).some((area) => (profile.service_areas || []).includes(area))).slice(0, 3);
  const jsonLd = schema({ "@context": "https://schema.org", "@type": "Person", name: profile.display_name, image: profile.photo_url, description: profile.bio, jobTitle: "Purohit", url: canonical, knowsLanguage: profile.languages || [], areaServed: (profile.service_areas || []).map((name) => ({ "@type": "Place", name })), aggregateRating: Number(profile.review_count || 0) > 0 ? { "@type": "AggregateRating", ratingValue: Number(profile.rating || 0), reviewCount: Number(profile.review_count || 0) } : undefined });
  const content = `${header()}<main class="wrap profile-shell"><article class="profile-main"><div class="crumb"><a href="/">Home</a> / <a href="/priests">Purohits</a> / ${escapeHtml(profile.display_name)}</div><div class="eyebrow">Verified Purohith Connect professional</div><h1 class="profile-title">${escapeHtml(profile.profile_headline || `${profile.display_name}, a trusted purohit for your sacred ceremony`)}</h1><div class="profile-meta"><span>${profile.years_experience}+ years</span><span>${escapeHtml(profile.tradition || "Vedic practice")}</span>${(profile.languages || []).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div><section class="content-block"><h2>About ${escapeHtml(profile.display_name)}</h2><p>${escapeHtml(profile.bio)}</p></section><section class="content-block"><h2>Ceremonies offered</h2><div class="service-list">${(profile.pooja_slugs || []).map((item) => `<span>${escapeHtml(label(item))}</span>`).join("")}</div></section>${(profile.portfolio_urls || []).length ? `<section class="content-block"><h2>Ceremony portfolio</h2><div class="portfolio">${profile.portfolio_urls.map((url) => `<img src="${escapeHtml(url)}" alt="Ceremony conducted by ${escapeHtml(profile.display_name)}" loading="lazy">`).join("")}</div></section>` : ""}<section class="content-block"><h2>Service locations</h2><div class="area-links">${(profile.service_areas || []).map((area) => `<a href="/purohit-near-me/${areas.find((item) => item.name.toLowerCase() === area.toLowerCase())?.slug || "bangalore"}">${escapeHtml(area)}</a>`).join("")}</div></section>${similar.length ? `<section class="content-block"><h2>Similar purohits in Bengaluru</h2><div class="grid">${similar.map(card).join("")}</div></section>` : ""}</article><aside class="booking-card"><img src="${escapeHtml(profile.photo_url)}" alt="${escapeHtml(profile.display_name)}"><h2>${escapeHtml(profile.display_name)}</h2><div class="rating">★ ${Number(profile.rating || 0).toFixed(1)} (${Number(profile.review_count || 0)} reviews)</div><dl><div><dt>Starting price</dt><dd>₹${money(profile.starting_price_inr)}</dd></div><div><dt>Experience</dt><dd>${profile.years_experience}+ years</dd></div><div><dt>Serves</dt><dd>${escapeHtml(profile.primary_service_area || profile.service_areas?.[0] || "Bengaluru")}</dd></div></dl><a class="button" href="/priests/${profile.id}">View and book</a></aside></main><footer class="footer"><div class="wrap">Purohith Connect · Verified provider marketplace</div></footer>`;
  return layout({ title, description, canonical, content, jsonLd });
}

async function main() {
  if (areas.length !== 100) throw new Error(`Expected 100 areas, found ${areas.length}.`);
  const profiles = await fetchProfiles();
  fs.copyFileSync(path.join(root, "assets/images/purohithconnect-logo.png"), path.join(output, "seo-logo.png"));
  const favicon = path.join(root, "assets/favicon.png");
  if (fs.existsSync(favicon)) fs.copyFileSync(favicon, path.join(output, "favicon.png"));
  for (const area of areas) {
    const directory = path.join(output, "purohit-near-me", area.slug);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, "index.html"), areaPage(area, profiles));
  }
  for (const profile of profiles) {
    const directory = path.join(output, "purohits", profile.slug);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, "index.html"), profilePage(profile, profiles));
  }
  const locations = areas.map((area) => `purohit-near-me/${area.slug}`);
  const profileUrls = profiles.map((profile) => `purohits/${profile.slug}`);
  const urls = ["", "purohit-near-me", ...locations, ...profileUrls];
  const today = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(path.join(output, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((url) => `  <url><loc>${site}/${url}</loc><lastmod>${today}</lastmod></url>`).join("\n")}\n</urlset>\n`);
  fs.writeFileSync(path.join(output, "llms.txt"), `# Purohith Connect\n\nVerified purohit marketplace for Bengaluru ceremonies.\n\n- Service-area directory: ${site}/purohit-near-me\n- Marketplace: ${site}/priests\n- Published location pages: ${areas.length}\n- Published verified provider profiles: ${profiles.length}\n\nProfiles and area coverage are sourced from the live Purohith Connect database.\n`);
  console.log(`Generated ${areas.length} area pages and ${profiles.length} real provider profile pages.`);
}

main().catch((error) => { console.error(error); process.exit(1); });
