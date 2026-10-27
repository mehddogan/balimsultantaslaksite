/* Balım Sultan — site betiği.
   İçerik data/ klasöründeki dosyalardan okunur; kod bilgisi gerekmeden güncellenebilir. */

document.documentElement.lang = "tr";
const $ = (s, k = document) => k.querySelector(s);
const $$ = (s, k = document) => Array.from(k.querySelectorAll(s));
const sahne = $("#sahne");
let V = {};                 // veri
let temizlik = [];          // sayfadan çıkarken çalışacak işler

/* ---------------- yardımcılar ---------------- */
const kacis = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const kucuk = (s) => String(s).toLocaleLowerCase("tr");
const sade = (s) => kucuk(s).replace(/[âà]/g, "a").replace(/[îì]/g, "i").replace(/[ûù]/g, "u").replace(/ê/g, "e").replace(/[’'`]/g, "");
const ROMA = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
const iki = (n) => String(n).padStart(2, "0");

function csvOku(metin) {
  metin = metin.replace(/^﻿/, "");
  const ilk = metin.split(/\r?\n/)[0] || "";
  const ayrac = ilk.split(";").length >= ilk.split(",").length ? ";" : ",";
  const satirlar = []; let alan = "", satir = [], tirnak = false;
  for (let i = 0; i < metin.length; i++) {
    const c = metin[i];
    if (tirnak) { if (c === '"') { if (metin[i + 1] === '"') { alan += '"'; i++; } else tirnak = false; } else alan += c; }
    else if (c === '"') tirnak = true;
    else if (c === ayrac) { satir.push(alan); alan = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && metin[i + 1] === "\n") i++; satir.push(alan); satirlar.push(satir); satir = []; alan = ""; }
    else alan += c;
  }
  if (alan !== "" || satir.length) { satir.push(alan); satirlar.push(satir); }
  const bas = (satirlar.shift() || []).map((h) => h.trim());
  return satirlar.filter((r) => r.some((x) => x.trim())).map((r) => Object.fromEntries(bas.map((h, j) => [h, (r[j] || "").trim()])));
}
const getir = (yol, tur) => fetch(yol, { cache: "no-cache" }).then((y) => {
  if (!y.ok) throw new Error(yol);
  return tur === "json" ? y.json() : tur === "metin" ? y.text() : y.text().then(csvOku);
});

function youtubeKimlik(s) {
  if (!s) return "";
  const m = s.trim().match(/(?:youtu\.be\/|v=|embed\/|shorts\/|live\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : /^[A-Za-z0-9_-]{11}$/.test(s.trim()) ? s.trim() : "";
}

/* ---------------- yumuşak kaydırma ---------------- */
const azHareket = matchMedia("(prefers-reduced-motion: reduce)").matches;
let lenis = null;
const kaydirDinleyiciler = new Set();
if (window.Lenis && !azHareket) {
  lenis = new window.Lenis({ duration: 1.2, smoothWheel: true, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)) });
  lenis.on("scroll", (e) => kaydirDinleyiciler.forEach((f) => f(e.velocity || 0)));
  const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
  requestAnimationFrame(raf);
} else {
  let son = scrollY;
  addEventListener("scroll", () => { const v = scrollY - son; son = scrollY; kaydirDinleyiciler.forEach((f) => f(v)); }, { passive: true });
}
const basaDon = () => (lenis ? lenis.scrollTo(0, { immediate: true }) : scrollTo(0, 0));
const kaydirHedef = (y) => (lenis ? lenis.scrollTo(y, { duration: 1.6 }) : scrollTo({ top: y, behavior: "smooth" }));

/* ---------------- belirme ---------------- */
let gozcu = null;
function belirt() {
  gozcu?.disconnect();
  if (!("IntersectionObserver" in window)) { $$(".belir").forEach((e) => e.classList.add("gorundu")); return; }
  gozcu = new IntersectionObserver((g) => g.forEach((x) => { if (x.isIntersecting) { x.target.classList.add("gorundu"); gozcu.unobserve(x.target); } }), { rootMargin: "0px 0px -15% 0px" });
  $$(".belir").forEach((e) => gozcu.observe(e));
}

/* ---------------- sözlük işaretleme ---------------- */
const HARF = { a: "aâ", i: "iî", u: "uû", e: "eê" };
const harfSinifi = (c) => { const s = HARF[c] || c; let o = ""; for (const h of s) { const b = h.toLocaleUpperCase("tr"); o += h + (b !== h ? b : ""); } return o.length > 1 ? `[${o}]` : o; };
function bicimDesen(b) {
  const onek = /\*$/.test(b); b = kucuk(b.replace(/\*$/, "").trim()); let d = "";
  for (let i = 0; i < b.length; i++) {
    const c = b[i];
    if (/\s/.test(c)) { d += "\\s+"; while (/\s/.test(b[i + 1] || "")) i++; }
    else if (c === "’" || c === "'") d += "[’']";
    else if (/\p{L}/u.test(c)) d += harfSinifi(c);
    else d += c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return { desen: d + (onek ? "\\p{L}*" : "") + "(?:[’']\\p{L}+)?", uzunluk: b.length };
}
let TERIM_RE = null, TERIM_SIRA = [];
function sozlukHazirla(liste) {
  const p = [];
  liste.forEach((t, sira) => {
    let b = (t.varyantlar || "").split("|").map((x) => x.trim()).filter(Boolean);
    if (!b.length) b = [t.terim.length >= 5 ? t.terim + "*" : t.terim];
    b.forEach((x) => p.push({ ...bicimDesen(x), sira }));
  });
  p.sort((a, b) => b.uzunluk - a.uzunluk);
  TERIM_SIRA = p.map((x) => x.sira);
  try { TERIM_RE = new RegExp(`(?<![\\p{L}])(?:${p.map((x) => `(${x.desen})`).join("|")})(?![\\p{L}])`, "gu"); } catch { TERIM_RE = null; }
}
function terimIsaretle(kapsam) {
  if (!TERIM_RE || !kapsam) return;
  const gorulen = {};
  const y = document.createTreeWalker(kapsam, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => { const p = n.parentElement; if (!p || p.closest(".terim, a, button, h1, h2, h3, th, script, style, .etiket")) return NodeFilter.FILTER_REJECT; return n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT; },
  });
  const d = []; while (y.nextNode()) d.push(y.currentNode);
  d.forEach((dug) => {
    const m0 = dug.nodeValue; let son = 0, deg = false, m; const fr = document.createDocumentFragment();
    TERIM_RE.lastIndex = 0;
    while ((m = TERIM_RE.exec(m0))) {
      let g = 1; while (g < m.length && m[g] === undefined) g++;
      const s = TERIM_SIRA[g - 1];
      if (s === undefined || gorulen[s]) continue;
      gorulen[s] = deg = true;
      fr.append(m0.slice(son, m.index));
      const b = document.createElement("button");
      b.type = "button"; b.className = "terim"; b.dataset.terim = s; b.setAttribute("aria-expanded", "false"); b.textContent = m[0];
      fr.append(b); son = m.index + m[0].length;
    }
    if (deg) { fr.append(m0.slice(son)); dug.replaceWith(fr); }
  });
}
const pencere = $("#pencere"); let acikTerim = null, kapatZ = null;
function pencereAc(b) {
  const t = V.sozluk[+b.dataset.terim]; if (!t) return;
  if (acikTerim && acikTerim !== b) acikTerim.setAttribute("aria-expanded", "false");
  acikTerim = b; b.setAttribute("aria-expanded", "true");
  pencere.innerHTML = `<b>${kacis(t.terim)}</b>${kacis(t.aciklama)}${t.kaynak ? `<small>Kaynak: ${kacis(t.kaynak)}</small>` : ""}<small><a href="#t${b.dataset.terim}">Sözlükte aç</a></small>`;
  pencere.hidden = false;
  const r = b.getBoundingClientRect(), w = pencere.offsetWidth, h = pencere.offsetHeight;
  const sol = Math.min(Math.max(16, r.left + scrollX + r.width / 2 - w / 2), scrollX + document.documentElement.clientWidth - w - 16);
  let ust = r.bottom + scrollY + 10;
  if (r.bottom + h + 20 > innerHeight && r.top > h + 20) ust = r.top + scrollY - h - 10;
  Object.assign(pencere.style, { left: sol + "px", top: ust + "px" });
}
function pencereKapat() { pencere.hidden = true; acikTerim?.setAttribute("aria-expanded", "false"); acikTerim = null; }
const dokunmatik = matchMedia("(hover: none)").matches;
document.addEventListener("click", (e) => {
  const b = e.target.closest(".terim");
  if (b) { e.preventDefault(); acikTerim === b && !pencere.hidden ? pencereKapat() : pencereAc(b); return; }
  if (!e.target.closest("#pencere")) pencereKapat();
});
if (!dokunmatik) {
  document.addEventListener("mouseover", (e) => { const b = e.target.closest(".terim"); if (b) { clearTimeout(kapatZ); pencereAc(b); } else if (e.target.closest("#pencere")) clearTimeout(kapatZ); });
  document.addEventListener("mouseout", (e) => { if (e.target.closest(".terim, #pencere")) { clearTimeout(kapatZ); kapatZ = setTimeout(pencereKapat, 260); } });
}
addEventListener("resize", pencereKapat);

/* ---------------- küçük markdown ---------------- */
function satirIci(s) {
  return kacis(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\[(.+?)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}
function mdOku(md) {
  const on = {}; md = md.replace(/\r/g, "");
  const f = md.match(/^---\n([\s\S]*?)\n---\n?/);
  if (f) { f[1].split("\n").forEach((l) => { const i = l.indexOf(":"); if (i > 0) on[l.slice(0, i).trim()] = l.slice(i + 1).trim(); }); md = md.slice(f[0].length); }
  const bloklar = md.split(/\n{2,}/); let html = "";
  for (const b0 of bloklar) {
    const b = b0.trim(); if (!b) continue;
    if (/^#{1,3}\s/.test(b)) { html += `<h3>${satirIci(b.replace(/^#{1,3}\s+/, ""))}</h3>`; continue; }
    if (/^>/.test(b)) { html += `<blockquote>${b.split("\n").map((l) => satirIci(l.replace(/^>\s?/, ""))).join("<br>")}</blockquote>`; continue; }
    if (/^\|/.test(b)) {
      const s = b.split("\n").filter((l) => !/^\|\s*-/.test(l)).map((l) => l.replace(/^\||\|$/g, "").split("|").map((h) => h.trim()));
      html += `<div class="serh__tablo"><table><thead><tr>${s[0].map((h) => `<th>${satirIci(h)}</th>`).join("")}</tr></thead><tbody>${s.slice(1).map((r) => `<tr>${r.map((h) => `<td>${satirIci(h)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
      continue;
    }
    if (/^[-*]\s/.test(b)) { html += `<ul>${b.split("\n").map((l) => `<li>${satirIci(l.replace(/^[-*]\s+/, ""))}</li>`).join("")}</ul>`; continue; }
    html += `<p>${b.split("\n").map(satirIci).join("<br>")}</p>`;
  }
  return { on, html };
}

/* ---------------- ortak parçalar ---------------- */
const altbilgi = () => {
  const a = V.ayarlar || {}, l = [];
  if (a.youtube_kanal) l.push(`<a href="${kacis(a.youtube_kanal)}" target="_blank" rel="noopener"><span>YouTube</span><small>Balım Sultan Muhabbeti</small></a>`);
  if (a.facebook) l.push(`<a href="${kacis(a.facebook)}" target="_blank" rel="noopener"><span>Facebook</span><small>Zakir Film</small></a>`);
  if (a.instagram) l.push(`<a href="${kacis(a.instagram)}" target="_blank" rel="noopener"><span>Instagram</span><small>Okan Ulusoy</small></a>`);
  return `<footer class="kunye">
    <div class="kunye__ust">
      <div><p class="kunye__ad">Balım Sultan Muhabbeti</p><p class="kunye__dize">Sırr-ı Bektaşiyiz ayrı değiliz</p></div>
      <div><span class="etiket">Künye</span>
        <dl class="kunye__liste">
          <dt>Zakir Belgeseli</dt><dd>Okan Ulusoy, Melih Cevdet Tekşen</dd>
          <dt>Hazırlayanlar</dt><dd>Okan Ulusoy, Mehdi Doğan</dd>
          <dt>Nefesler</dt><dd>Balım Sultan Muhabbeti</dd>
        </dl></div>
      <div><span class="etiket">Bağlantılar</span><nav class="kunye__baglanti" aria-label="Bağlantılar">${l.join("")}</nav></div>
    </div>
    <div class="kunye__alt"><span>© ${new Date().getFullYear()} Balım Sultan Muhabbeti</span><a href="#" data-basa>Başa dön</a></div>
  </footer>`;
};
function sayfaBas({ etiket, baslik, ozet = "", zemin = "", sinif = "", figur = "", kisa = false, video = "" }) {
  return `<header class="sayfa-bas${kisa ? " sayfa-bas--kisa" : ""}">
    <div class="sayfa-bas__zemin ${sinif}">${video ? `<video src="${video}" muted loop playsinline autoplay poster="${zemin}"></video>` : zemin ? `<img src="${zemin}" alt="" class="${sinif.includes("kizil") ? "ikili" : ""}">` : ""}</div>
    ${figur ? `<img class="figur-sag" src="${figur}" alt="">` : ""}
    <div class="sayfa-bas__ic"><span class="bolum-etiket" style="margin:0">${etiket}</span><h1>${baslik}</h1>${ozet ? `<p class="ozet">${ozet}</p>` : ""}</div>
  </header>`;
}
const asikGrup = () => {
  const g = new Map();
  V.repertuar.deyisler.forEach((d) => { if (!g.has(d.asik)) g.set(d.asik, []); g.get(d.asik).push(d); });
  return g;
};

/* ---------------- büyütme perdesi ---------------- */
const perde = $("#perde");
function perdeAc(liste, i) {
  const goster = () => {
    const f = liste[i];
    perde.innerHTML = `<button class="perde__kapat" type="button">Kapat</button>
      ${liste.length > 1 ? `<button class="perde__ok geri" type="button">Önceki</button><button class="perde__ok ileri" type="button">Sonraki</button>` : ""}
      <figure><img src="${kacis(f.dosya)}" alt="${kacis(f.aciklama || "Fotoğraf")}"><figcaption>${iki(i + 1)} / ${iki(liste.length)}${f.aciklama ? " · " + kacis(f.aciklama) : ""}</figcaption></figure>`;
  };
  goster(); perde.hidden = false; lenis?.stop();
  perde.onclick = (e) => {
    if (e.target.closest(".geri")) { i = (i - 1 + liste.length) % liste.length; goster(); }
    else if (e.target.closest(".ileri")) { i = (i + 1) % liste.length; goster(); }
    else if (e.target === perde || e.target.closest(".perde__kapat")) perdeKapat();
  };
  perde.onkeydown = null;
  $(".perde__kapat", perde).focus();
  perde._tus = (e) => { if (e.key === "ArrowRight") { i = (i + 1) % liste.length; goster(); } if (e.key === "ArrowLeft") { i = (i - 1 + liste.length) % liste.length; goster(); } };
  addEventListener("keydown", perde._tus);
}
function perdeKapat() { if (perde.hidden) return; perde.hidden = true; perde.innerHTML = ""; lenis?.start(); removeEventListener("keydown", perde._tus); }

/* =========================================================
   ANA SAYFA
   ========================================================= */
const DURAKLAR = [
  { bas: 0, son: 112, baslik: "Zakir’in <em>izinde</em>", dize: "Sazda sözde söyler her an dilimiz<br>Senin için çalar tel Hacı Bektaş", asik: "Garibî", kapilar: [["Zakir Belgeseli", "zakir-belgeseli"]], yer: "sol", kisa: "Yol" },
  { bas: 138, son: 262, baslik: "Bilgi <em>ağacı</em>", dize: "Öt benim sarı tanburam<br>Senin aslın ağaçtandır", asik: "Pir Sultan Abdal", kapilar: [["Sözlük", "sozluk"]], yer: "sag", kisa: "Ağaç" },
  { bas: 318, son: 402, baslik: "Hünkâr'ın <em>huzurunda</em>", dize: "Dün gece seyrimde batın yüzünde<br>Hünkar Hacı Bektaş Velî’yi gördüm", asik: "Kalender Abdal", kapilar: [["Nefesler ve Deyişler", "nefesler"]], yer: "sag", kisa: "Hünkâr" },
  { bas: 426, son: 506, baslik: "Güvercin <em>donunda</em>", dize: "Gaipten haber getirdin<br>Mihman hoş geldin hoş geldin", asik: "Kul Himmet", kapilar: [["Yolculuğumuz", "yolculugumuz"]], yer: "sol", kisa: "Güvercin" },
  { bas: 528, son: 600, baslik: "Kızıl <em>gök</em>", dize: "Çatılmadan yerin göğün binası<br>Muallâkta iki nûr’a düş oldum", asik: "Sıdkı Baba", kapilar: [["Kayıtlar", "kayitlar"], ["Fotoğraflar", "fotograflar"], ["Albüm", "album"]], yer: "sol", kisa: "Gök" },
];
const KARE_SAYI = 600;

function anaSayfa() {
  const g = asikGrup(), asiklar = [...g.keys()];
  const secili = ["Kul Himmet", "Pir Sultan Abdal", "Hatayî", "Nesîmî", "Daimî", "Sıdkı Baba"].filter((a) => g.has(a));
  const fotolar = V.fotograflar.slice(0, 6), desen = ["b", "k", "d", "g", "g", "d"];
  const deyisSay = V.repertuar.deyisler.length;
  return `
  <section class="hero" id="hero" aria-label="Balım Sultan">
    <div class="hero__ust"><span>Hünkâr Hacı Bektaş-ı Veli · Balım Sultan</span><span>Türkiye 36°–42° K · 26°–45° D</span></div>
    <div class="hero__orta">
      <p class="hero__ust-baslik">Balım Sultan Muhabbeti · Dergâhın Aşıkları</p>
      <h1 class="hero__baslik"><span>Muhabbet bağında</span><span class="italik">bir gül</span><span>açıldı</span></h1>
      <p class="hero__kaynak">Hatayî</p>
    </div>
    <div class="hero__alt">
      <p class="hero__aciklama hero__dortluk">Sırr-ı Bektaşiyiz ayrı değiliz<br>Hem an sağ gezeriz sayrı değiliz<br>Birlikteyiz ayrı gayrı değiliz<br>Bir kimse sayılır üçümüz bizim</p>
      <span class="hero__kaydir"><i></i>Yola gir</span>
      <span class="hero__imza">Balım Sultan<br>Muhabbeti</span>
    </div>
  </section>

  <div class="yigin">
    <section class="yol" id="yol" aria-label="Yolculuk">
      <div class="yol__yapis">
        <canvas class="yol__tuval" id="yol-tuval" aria-hidden="true"></canvas>
        <div class="yol__ust"><span class="etiket">Yol</span><span class="etiket" id="yol-sayac">I / V</span></div>
        ${DURAKLAR.map((d, i) => `<div class="durak ${d.yer}" data-durak="${i}">
          <span class="durak__no">${ROMA[i + 1]}. Durak</span>
          <h3>${d.baslik}</h3>
          <blockquote>${d.dize}<cite>${kacis(d.asik)}</cite></blockquote>
          <div class="durak__git">${d.kapilar.map(([a, h]) => `<a class="kapi" href="#${h}">${a}</a>`).join("")}</div>
        </div>`).join("")}
        <div class="yol__ilerleme">${DURAKLAR.map((d, i) => `<button type="button" data-git="${i}"><i></i><span>${ROMA[i + 1]} · ${d.kisa}</span></button>`).join("")}</div>
      </div>
    </section>

    <section class="bolum">
      <p class="bolum-etiket belir">Zakir Belgeseli · Okan Ulusoy · Melih Cevdet Tekşen</p>
      <div class="one-cikan">
        <a class="one-cikan__gorsel belir" href="#zakir-belgeseli" aria-label="Zakir Belgeseli">
          <img src="gorsel/belgesel/zakir-afis.webp" alt="Zakir belgeselinin afişi: kerpiç duvar, ahşap kapı ve asılı bir saz" loading="lazy">
          <span class="one-cikan__alt"><span class="etiket" style="color:var(--kemik)">Belgesel</span><span class="etiket" style="color:var(--al-acik)">Okan Ulusoy</span></span>
        </a>
        <div>
          <h2 class="buyuk-baslik belir">Za<em>kir</em></h2>
          <p class="giris belir">Zakir, cemde sazıyla hizmet gören candır. Deyişi, düvazı, mersiyeyi o okur; dergâhın nefesini o tutar. On iki şehirde çekilen Zakir belgeseli, farklı yörelerde bu hizmeti yerine getiren zakirlerin kendi hikâyelerini anlatır.</p>
          <a class="kapi belir" href="#zakir-belgeseli">Belgesele gir</a>
        </div>
      </div>
    </section>

    <section class="bolum">
      <p class="bolum-etiket belir">Nefesler ve Deyişler</p>
      <div class="izgara-bas">
        <h2 class="belir">${asiklar.length} aşığın dilinden <em>${deyisSay} nefes</em></h2>
        <p class="belir">Muhabbette okunan nefes ve deyişler. Her birinin yanında, vezninden kafiyesine, diline ve yorumuna uzanan bir şerh sayfası açılır.</p>
      </div>
      <ol class="satirlar">
        ${secili.map((a, i) => { const d = g.get(a)[0]; return `<li><a class="satir belir" href="#d-${d.id}"><span class="satir__no">${iki(i + 1)}</span><span class="satir__ad">${kacis(a)}</span><span class="satir__dize">${kacis(d.kitalar[0][0])}<br>${kacis(d.kitalar[0][1])}</span><span class="satir__sag">${g.get(a).length} nefes</span></a></li>`; }).join("")}
      </ol>
      <p style="margin-top:40px"><a class="kapi" href="#nefesler">Bütün nefesler</a></p>
    </section>

    <section class="bolum">
      <p class="bolum-etiket belir">Fotoğraflar</p>
      <div class="izgara-bas">
        <h2 class="belir">Dergâhtan <em>kareler</em></h2>
        <p class="belir">Saz, diz, halka. Sahneden ve meydandan kalanlar.</p>
      </div>
      <div class="izgara">
        ${fotolar.map((f, i) => `<figure class="kare kare--${desen[i]} belir" data-foto="${i}"><img src="${kacis(f.dosya)}" alt="${kacis(f.aciklama || "Muhabbetten bir kare")}" loading="lazy"><figcaption><span>No. ${iki(i + 1)}</span><span>${kacis(f.aciklama)}</span></figcaption></figure>`).join("")}
      </div>
      <p style="margin-top:44px;display:flex;gap:30px;flex-wrap:wrap"><a class="kapi" href="#fotograflar">Bütün fotoğraflar</a><a class="kapi" href="#album">Albümü aç</a></p>
    </section>

    <section class="bolum kapanis">
      <blockquote class="belir">İnsan Hakk’ta Hakk insanda <em>Ne ararsan var insanda</em></blockquote>
      <cite class="belir">Daimî</cite>
    </section>
    ${altbilgi()}
  </div>`;
}

function anaSayfaKur() {
  // Sarmal
  const hero = $("#hero"), durum = { donus: 0, ilerleme: 0, hedefX: 0, hedefZ: 0, gorunur: true };
  let sarmal = null;
  const fotolar = V.fotograflar.map((f) => f.dosya.replace(/\.webp$/, "-k.webp"));
  const baslat = () => import("./spiral.js").then((m) => { if (!document.body.contains(hero)) return; sarmal = m.sarmalKur(hero, fotolar, durum); }).catch(() => {});
  "requestIdleCallback" in window ? requestIdleCallback(baslat, { timeout: 1500 }) : requestAnimationFrame(() => requestAnimationFrame(baslat));
  const kd = (v) => { sarmal?.dokun(v); durum.ilerleme = Math.min(scrollY / Math.max(document.documentElement.scrollHeight - innerHeight, 1), 1); durum.gorunur = scrollY < innerHeight * 1.2; };
  kaydirDinleyiciler.add(kd);
  const fare = (e) => { if (innerWidth < 768) return; sarmal?.egim((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1); };
  addEventListener("mousemove", fare);

  // Yol: kaydırdıkça ilerleyen illüstrasyon
  const yol = $("#yol"), tuval = $("#yol-tuval"), cx = tuval.getContext("2d");
  const kareler = new Array(KARE_SAYI); let yuklenen = 0, sonKare = -1, etkinDurak = -1;
  const kareYolu = (i) => `gorsel/yol/k${String(i + 1).padStart(3, "0")}.webp`;
  const KA = Math.max(1, +(document.documentElement.dataset.kareAdim || 1));
  const sira = []; for (let adim of [24, 8, 2, 1].map((a) => Math.max(a, KA))) for (let i = 0; i < KARE_SAYI; i += adim) if (!sira.includes(i)) sira.push(i);
  let yuklemeDur = false;
  (function yukle(n = 0) {
    if (yuklemeDur || n >= sira.length) return;
    const parti = sira.slice(n, n + 12);
    Promise.all(parti.map((i) => new Promise((ok) => { const im = new Image(); im.decoding = "async"; im.onload = () => { kareler[i] = im; yuklenen++; ok(); }; im.onerror = ok; im.src = kareYolu(i); })))
      .then(() => { if (sonKare < 0 || !kareler[sonKare]) ciz(true); yukle(n + 12); });
  })();
  function enYakin(i) { for (let d = 0; d < KARE_SAYI; d++) { if (kareler[i - d]) return kareler[i - d]; if (kareler[i + d]) return kareler[i + d]; } return null; }
  function boyutla() { const o = Math.min(devicePixelRatio, 2); tuval.width = tuval.clientWidth * o; tuval.height = tuval.clientHeight * o; ciz(true); }
  function ciz(zorla) {
    const r = yol.getBoundingClientRect(), menzil = r.height - innerHeight;
    const k = Math.min(Math.max(-r.top / Math.max(menzil, 1), 0), 1);
    const i = Math.min(KARE_SAYI - 1, Math.round(k * (KARE_SAYI - 1)));
    if (i !== sonKare || zorla) {
      const im = kareler[i] || enYakin(i);
      if (im) {
        const W = tuval.width, H = tuval.height, s = Math.max(W / im.width, H / im.height);
        const w = im.width * s, h = im.height * s;
        cx.fillStyle = "#000"; cx.fillRect(0, 0, W, H);
        cx.drawImage(im, (W - w) / 2, (H - h) / 2, w, h);
        if (kareler[i]) sonKare = i;
      }
    }
    let ed = -1; DURAKLAR.forEach((d, j) => { if (i >= d.bas && i <= d.son) ed = j; });
    if (ed !== etkinDurak) {
      etkinDurak = ed;
      $$(".durak", yol).forEach((e, j) => e.classList.toggle("etkin", j === ed));
      tuval.classList.toggle("tiklanir", ed >= 0);
      if (ed >= 0) $("#yol-sayac").textContent = `${ROMA[ed + 1]} / V`;
    }
    $$(".yol__ilerleme button", yol).forEach((b, j) => {
      const d = DURAKLAR[j], dol = Math.min(Math.max((i - d.bas) / (d.son - d.bas), 0), 1);
      b.querySelector("i").style.setProperty("--dolu", (dol * 100).toFixed(1) + "%");
      b.classList.toggle("etkin", j === ed);
    });
  }
  const yolKaydir = () => ciz(false);
  kaydirDinleyiciler.add(yolKaydir);
  addEventListener("resize", boyutla);
  boyutla();
  tuval.addEventListener("click", () => { if (etkinDurak >= 0) location.hash = DURAKLAR[etkinDurak].kapilar[0][1]; });
  $$(".yol__ilerleme button", yol).forEach((b) => b.addEventListener("click", () => {
    const d = DURAKLAR[+b.dataset.git], orta = (d.bas + d.son) / 2 / (KARE_SAYI - 1);
    kaydirHedef(yol.offsetTop + orta * (yol.offsetHeight - innerHeight));
  }));
  // Lenis yokken de çizim güncel kalsın
  const yedek = () => ciz(false); addEventListener("scroll", yedek, { passive: true });

  $$("[data-foto]").forEach((f) => f.addEventListener("click", () => perdeAc(V.fotograflar, +f.dataset.foto)));

  temizlik.push(() => {
    yuklemeDur = true; sarmal?.yoket(); kaydirDinleyiciler.delete(kd); kaydirDinleyiciler.delete(yolKaydir);
    removeEventListener("mousemove", fare); removeEventListener("resize", boyutla); removeEventListener("scroll", yedek);
  });
}

/* =========================================================
   ZAKİR BELGESELİ
   ========================================================= */
function belgesel() {
  const b = V.zakir.filter((x) => youtubeKimlik(x.youtube));
  const fragman = b[0];
  const ekran = fragman
    ? `<div class="ekran" data-yt="${youtubeKimlik(fragman.youtube)}"><img src="https://i.ytimg.com/vi/${youtubeKimlik(fragman.youtube)}/hqdefault.jpg" alt=""><button class="oynat" type="button"><span>İzle</span></button></div>`
    : `<div class="ekran"><img src="gorsel/belgesel/zakir-yol.webp" alt="Zakir belgeselinin açılış karesi: karla kaplanan bir yol"><div class="ekran__perde"><span class="etiket" style="color:var(--al-acik)">Fragman</span><p>Belgeselin fragmanı ve bölümleri YouTube'da yayımlandıkça burada izlenebilecek.</p></div></div>`;
  const kareler = [
    ["gorsel/belgesel/zakir-oda.webp", "Köy odasında bir zakir", "Belgeselden"],
    ["gorsel/belgesel/zakir-gala.webp", "Okan Ulusoy, gösterimde", "Zakir"],
  ];
  return `${sayfaBas({ etiket: "Belgesel · Okan Ulusoy · Melih Cevdet Tekşen", baslik: "Za<em>kir</em>", ozet: "12 şehirde çekilen Zakir belgeseli, birbirinden farklı yörelerde bu hizmeti yerine getiren zakirlerin kendi hikâyelerini anlatan belgesel film.", zemin: "gorsel/belgesel/zakir-kapi.webp" })}
  <div class="icerik">
    <div class="belgesel-govde">
      <div class="yazi">
        <p class="lede belir">Zakirin sazı, dergâhın hafızasıdır.</p>
        <p class="belir">Zakir, usta-çırak eliyle yüzyıllardır aktarılan bir irfanı taşır. Belgeselde zakirler yola nasıl bağlandıklarını, sazı kimden aldıklarını, cemde üstlendikleri hizmeti kendi dilleriyle anlatır.</p>
        <p class="belir">Yönetmenliğini Okan Ulusoy ve Melih Cevdet Tekşen'in üstlendiği film, 29 Eylül 2023'te Cemal Reşit Rey Konser Salonu'ndaki galayla seyirciyle buluştu.</p>
        <p class="belir">Belgeselin yanında, sazender ve zakirlerle yapılmış yetmiş saati aşkın söyleşi kurgulanıyor. Bölümler YouTube'a yüklendikçe bu sayfada sırayla yer alacak.</p>
      </div>
      <div class="belir">${ekran}</div>
    </div>
    <div class="izgara" style="margin-top:var(--bosluk)">
      ${kareler.map(([src, alt, alt2], i) => `<figure class="kare kare--${i ? "k" : "b"} belir" data-bfoto="${i}"><img src="${src}" alt="${alt}" loading="lazy"><figcaption><span>${alt}</span><span>${alt2}</span></figcaption></figure>`).join("")}
    </div>
    <section class="bolumler">
      <p class="bolum-etiket belir">Söyleşiler</p>
      ${b.length > 1 ? `<ol class="bolum-listesi">${b.slice(1).map((x, i) => `<li class="belir"><div class="ekran" data-yt="${youtubeKimlik(x.youtube)}"><img src="https://i.ytimg.com/vi/${youtubeKimlik(x.youtube)}/hqdefault.jpg" alt="" loading="lazy"><button class="oynat" type="button"><span>İzle</span></button></div><span class="etiket">${ROMA[i + 1] || i + 1}. Bölüm</span><h3>${kacis(x.baslik)}</h3>${x.aciklama ? `<p>${kacis(x.aciklama)}</p>` : ""}</li>`).join("")}</ol>`
        : `<p class="bos belir">İlk bölüm kurguda. Yayımlandığında burada olacak.</p>`}
    </section>
  </div>${altbilgi()}`;
}
function belgeselKur() {
  ytKur();
  const l = [{ dosya: "gorsel/belgesel/zakir-oda.webp", aciklama: "Köy odasında bir zakir" }, { dosya: "gorsel/belgesel/zakir-gala.webp", aciklama: "Okan Ulusoy, gösterimde" }, { dosya: "gorsel/belgesel/zakir-afis.webp", aciklama: "Zakir" }];
  $$("[data-bfoto]").forEach((f) => f.addEventListener("click", () => perdeAc(l, +f.dataset.bfoto)));
}
function ytKur() {
  $$("[data-yt]").forEach((e) => e.querySelector(".oynat")?.addEventListener("click", () => {
    e.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${e.dataset.yt}?autoplay=1" title="Video" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
  }));
}

/* =========================================================
   NEFESLER VE DEYİŞLER
   ========================================================= */
function nefesler() {
  const g = asikGrup(), a = [...g.keys()];
  return `${sayfaBas({ etiket: "Nefesler ve Deyişler", baslik: "Nefesler ve <em>Deyişler</em>", ozet: `${a.length} aşığın dilinden ${V.repertuar.deyisler.length} nefes ve deyiş. Bir dize, bir kelime ya da bir aşık adıyla arayın.`, zemin: "gorsel/doku/kizil-tepe.webp", figur: "gorsel/doku/haci-bektas.webp" })}
  <div class="icerik">
    <div class="nefes-arac">
      <input class="arama" id="ara" type="search" placeholder="Dize ya da aşık ara" autocomplete="off" aria-label="Nefeslerde ara">
      <nav class="asik-dizin" aria-label="Aşıklar">${a.map((x, i) => `<a href="#nefesler" data-hedef="asik-${i}">${kacis(x)}</a>`).join("")}</nav>
    </div>
    <div id="nefes-govde">
    ${a.map((x, i) => `<section class="asik-blok" id="asik-${i}" data-asik="${kacis(sade(x))}">
      <h2>${kacis(x)}<small>${g.get(x).length} nefes</small></h2>
      <ul class="deyis-ad">${g.get(x).map((d) => {
        const kayit = V.kayitlar.some((k) => k.deyis_id === d.id), serh = false;
        const ara = sade(d.kitalar.map((k) => k.join(" ")).join(" "));
        return `<li data-ara="${kacis(ara)}"><a href="#d-${d.id}"><span>${kacis(d.baslik)}</span><span>${[serh ? "Şerh" : "", kayit ? "Kayıt" : ""].filter(Boolean).join(" · ")}</span></a></li>`;
      }).join("")}</ul></section>`).join("")}
      <p class="bos" id="sonuc-yok" hidden>Aramaya uyan bir nefes bulunamadı.</p>
    </div>
  </div>${altbilgi()}`;
}
function nefeslerKur() {
  const ara = $("#ara");
  ara.addEventListener("input", () => {
    const q = sade(ara.value.trim()); let top = 0;
    $$(".asik-blok").forEach((b) => {
      const au = q && b.dataset.asik.includes(q); let n = 0;
      $$("li", b).forEach((li) => { const u = !q || au || li.dataset.ara.includes(q); li.hidden = !u; if (u) n++; });
      b.hidden = !n; top += n;
    });
    $("#sonuc-yok").hidden = top > 0;
  });
  $$("[data-hedef]").forEach((x) => x.addEventListener("click", (e) => { e.preventDefault(); const h = document.getElementById(x.dataset.hedef); if (h) kaydirHedef(h.getBoundingClientRect().top + scrollY - 90); }));
}

/* ---------------- deyiş ---------------- */
const ZEMINLER = [
  { src: "gorsel/doku/kizil-tepe.webp" }, { src: "gorsel/doku/gece-agac.webp" },
  { src: "gorsel/doku/haci-bektas.webp", figur: true }, { src: "gorsel/doku/kizil-tepe-ay.webp" }, { src: "gorsel/doku/seher-agac.webp" },
];
function deyis(id) {
  const dl = V.repertuar.deyisler, i = dl.findIndex((d) => d.id === id);
  if (i < 0) return `${sayfaBas({ etiket: "Nefesler", baslik: "Bulunamadı", ozet: '<a class="kapi" href="#nefesler">Nefeslere dön</a>', kisa: true })}`;
  const d = dl[i], onceki = dl[i - 1], sonraki = dl[i + 1];
  const z = ZEMINLER[i % ZEMINLER.length];
  const sonlar = {}; d.kitalar.forEach((k) => { const x = sade(k[k.length - 1]); sonlar[x] = (sonlar[x] || 0) + 1; });
  const kayit = V.kayitlar.find((k) => k.deyis_id === d.id);
  return `<div class="deyis-zemin${z.figur ? " figur" : ""}" aria-hidden="true"><img src="${z.src}" alt=""></div>
  <article class="deyis">
    <header class="deyis__bas">
      <span class="deyis__asik">${kacis(d.asik)}</span>
      <h1>${kacis(d.baslik)}</h1>
      <div class="deyis__arac"><button class="metin-dugme" type="button" id="serh-ac">Şerh</button>${kayit ? `<a class="metin-dugme soluk" href="#kayitlar">Kayıt</a>` : ""}</div>
    </header>
    <div class="kitalar" id="kitalar">${d.kitalar.map((k) => `<p class="kita belir">${k.map((s, n) => `<span${n === k.length - 1 && k.length > 2 && sonlar[sade(s)] > 1 ? ' class="nakarat"' : ""}>${kacis(s)}</span>`).join("")}</p>`).join("")}</div>
    <nav class="deyis__gezinti" aria-label="Nefesler arasında">
      ${onceki ? `<a href="#d-${onceki.id}"><span class="etiket">Önceki · ${kacis(onceki.asik)}</span><b>${kacis(onceki.baslik)}</b></a>` : "<span></span>"}
      ${sonraki ? `<a href="#d-${sonraki.id}"><span class="etiket">Sonraki · ${kacis(sonraki.asik)}</span><b>${kacis(sonraki.baslik)}</b></a>` : ""}
    </nav>
  </article>`;
}
function serhSablon(d) {
  return `---\nbaslik: ${d.baslik}\nasik: ${d.asik}\nhazirlayan: \ndurum: taslak\n---\n\n## Aşık\n\n\n## Vezin\n\n\n## Kafiye ve redif\n\n\n## Dil ve imge\n\n\n## Erkân\n\n\n## Batınî Görü\n\n\n## Notlar\n`;
}
function deyisKur(id) {
  const d = V.repertuar.deyisler.find((x) => x.id === id); if (!d) return;
  terimIsaretle($("#kitalar"));
  const panel = document.createElement("aside");
  panel.className = "serh"; panel.setAttribute("aria-label", "Şerh"); panel.setAttribute("aria-hidden", "true");
  document.body.append(panel);
  const ayar = V.ayarlar || {};
  const dosya = `data/serhler/${id}.md`;
  const ghLink = ayar.github_kullanici && ayar.github_depo ? "https://app.pagescms.org/" + ayar.github_kullanici + "/" + ayar.github_depo + "/" + (ayar.github_dal || "main") + "/collection/serhler" : "";
  let metin = "";
  const bas = (sag) => `<div class="serh__bas"><span class="etiket">Şerh · ${kacis(d.asik)}</span><div class="serh__dugmeler">${sag}<button class="metin-dugme soluk" type="button" data-kapat>Kapat</button></div></div>`;
  function oku() {
    const { on, html } = mdOku(metin);
    panel.innerHTML = bas(`<button class="metin-dugme" type="button" data-duzenle>Düzenle</button>`) +
      `<div class="serh__govde" data-lenis-prevent><h2>${kacis(on.baslik || d.baslik)}</h2>${on.durum ? `<span class="serh__durum">${kacis(on.durum)}${on.hazirlayan ? " · " + kacis(on.hazirlayan) : ""}</span>` : ""}${html}</div>`;
    terimIsaretle($(".serh__govde", panel));
  }
  function bos() {
    panel.innerHTML = bas("") + `<div class="serh__govde" data-lenis-prevent><h2>${kacis(d.baslik)}</h2>
      <p class="bos">Bu nefes için henüz şerh yazılmadı.</p>
      <p>Vezin, kafiye, dil ve imge, erkân ve felsefi yorum başlıklarıyla bir şerh yazabilirsiniz. Taslak hazır bir şablonla açılır.</p>
      <p style="margin-top:24px"><button class="metin-dugme" type="button" data-duzenle>Şerh yazmaya başla</button></p></div>`;
  }
  function duzenle() {
    const taslakAnahtar = "serh-taslak-" + id;
    let taslak = ""; try { taslak = localStorage.getItem(taslakAnahtar) || ""; } catch {}
    panel.innerHTML = bas(`<button class="metin-dugme" type="button" data-onizle>Önizle</button>`) +
      `<div class="serh__govde" data-lenis-prevent><div class="duzenleyici">
        <label class="etiket" for="serh-metin">${kacis(dosya)}</label>
        <textarea id="serh-metin" spellcheck="true">${kacis(taslak || metin || serhSablon(d))}</textarea>
        <div class="duzenleyici__dugmeler">
          <button class="metin-dugme" type="button" data-kopyala>Metni kopyala</button>
          ${ghLink ? `<a class="metin-dugme" href="${ghLink}" target="_blank" rel="noopener">Yönetici panelinde aç</a>` : ""}
          <span class="etiket" id="serh-bildirim" aria-live="polite"></span>
        </div>
        <p class="duzenleyici__not">Taslak bu tarayıcıda kendiliğinden saklanır. Kalıcı olarak yayımlamak için metni kopyalayıp sitenin deposundaki <b>${kacis(dosya)}</b> dosyasına yapıştırın${ghLink ? "; Yönetici panelinde aç bağlantısı şerhler bölümünü açar" : ""}. Başlıklar ## ile, kalın yazı **iki yıldız** ile, alıntı > ile yazılır.</p>
      </div></div>`;
    const ta = $("#serh-metin", panel);
    ta.addEventListener("input", () => { try { localStorage.setItem(taslakAnahtar, ta.value); } catch {} });
    ta.focus();
  }
  panel.addEventListener("click", async (e) => {
    if (e.target.closest("[data-kapat]")) kapat();
    else if (e.target.closest("[data-duzenle]")) duzenle();
    else if (e.target.closest("[data-onizle]")) { metin = $("#serh-metin", panel).value; oku(); }
    else if (e.target.closest("[data-kopyala]")) {
      const ta = $("#serh-metin", panel), bil = $("#serh-bildirim", panel);
      try { await navigator.clipboard.writeText(ta.value); bil.textContent = "Kopyalandı"; } catch { ta.select(); bil.textContent = "Metin seçildi, kopyalayabilirsiniz"; }
    }
  });
  function ac() {
    panel.classList.add("acik"); panel.setAttribute("aria-hidden", "false");
    if (!metin) getir(dosya, "metin").then((m) => { metin = m; oku(); }).catch(bos);
  }
  function kapat() { panel.classList.remove("acik"); panel.setAttribute("aria-hidden", "true"); }
  $("#serh-ac").addEventListener("click", ac);
  const esc = (e) => { if (e.key === "Escape") kapat(); };
  addEventListener("keydown", esc);
  temizlik.push(() => { panel.remove(); removeEventListener("keydown", esc); });
}

/* =========================================================
   SÖZLÜK
   ========================================================= */
function sozluk() {
  const s = V.sozluk.map((t, i) => ({ t, i })).sort((a, b) => a.t.terim.localeCompare(b.t.terim, "tr"));
  const harf = [...new Set(s.map((x) => x.t.terim[0].toLocaleUpperCase("tr")))];
  return `${sayfaBas({ etiket: "Sözlük", baslik: "Yolun <em>dili</em>", ozet: "Nefeslerde geçen Alevi-Bektaşi terimleri. Sözlüğe eklenen her terim, nefes sayfalarında da işaretlenir; üzerine gelince anlamı açılır.", zemin: "gorsel/doku/gece-agac.webp", sinif: "kizil" })}
  <div class="icerik icerik--dar">
    <div class="nefes-arac"><input class="arama" id="sozluk-ara" type="search" placeholder="Terim ara" autocomplete="off" aria-label="Sözlükte ara"></div>
    <nav class="sozluk-harf" aria-label="Harfler">${harf.map((h) => `<a href="#sozluk" data-harf="${kacis(h)}">${kacis(h)}</a>`).join("")}</nav>
    <div id="maddeler">${s.map((x) => `<article class="madde" id="t${x.i}" data-harf="${kacis(x.t.terim[0].toLocaleUpperCase("tr"))}" data-ara="${kacis(sade(x.t.terim + " " + x.t.aciklama))}"><h3>${kacis(x.t.terim)}</h3><div><p>${kacis(x.t.aciklama)}</p>${x.t.kaynak ? `<small>Kaynak: ${kacis(x.t.kaynak)}</small>` : ""}</div></article>`).join("")}</div>
  </div>${altbilgi()}`;
}
function sozlukKur(hedef) {
  const ara = $("#sozluk-ara");
  ara.addEventListener("input", () => { const q = sade(ara.value.trim()); $$(".madde").forEach((m) => (m.hidden = q && !m.dataset.ara.includes(q))); });
  $$(".sozluk-harf a").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); const m = $(`.madde[data-harf="${a.dataset.harf}"]`); if (m) kaydirHedef(m.getBoundingClientRect().top + scrollY - 100); }));
  if (hedef) { const m = document.getElementById(hedef); if (m) setTimeout(() => kaydirHedef(m.getBoundingClientRect().top + scrollY - 100), 60); }
}

/* =========================================================
   YOLCULUĞUMUZ
   ========================================================= */
function yolculuk() {
  return `${sayfaBas({ etiket: "Yolculuğumuz", baslik: "Yolcu<em>luğumuz</em>", ozet: "Bir belgeselle başlayan, ağacın altındaki bir çadırda kırk zakirle büyüyen ve bugün kayıtlarla, fotoğraflarla, söyleşilerle süren bir yol.", zemin: "gorsel/doku/kizil-tepe-ay.webp" })}
  <div class="icerik">
    <div class="yolculuk-giris">
      <p class="lede belir">Balım Sultan, Bektaşi yolunun ikinci pîri sayılır.</p>
      <div class="belir">
        <p>16. yüzyılın başında Hacıbektaş dergâhının postnişini olan Balım Sultan, yolun erkânını düzenleyen ulu olarak anılır. Türbesi Hacıbektaş'ta, kendi adıyla bilinen bağın içindedir. Cemden sonra sazla ve sözle sürdürülen muhabbet de geleneğe onun adıyla geçmiştir.</p>
        <p>Bu sayfa, o muhabbet dergâhının İstanbul'daki izini sürüyor. Zakir'in kayda geçtiği bir belgesel, ana sahneden uzakta kurulan bir çadır, iki günlük bir muhabbetten doğan bir albüm ve henüz kurgusu süren yüzlerce saatlik söyleşi.</p>
      </div>
    </div>
    <ol class="zaman">${V.yolculuk.map((y) => `<li class="belir"><span class="zaman__yil">${kacis(y.yil)}</span><div><h3>${kacis(y.baslik)}</h3><p>${kacis(y.metin)}</p></div>${(y.gorseller || []).length ? `<div class="zaman__gorseller">${y.gorseller.map((g) => `<figure><img src="${kacis(typeof g === "string" ? g : g.gorsel)}" alt="" loading="lazy"></figure>`).join("")}</div>` : "<span></span>"}</li>`).join("")}</ol>
  </div>${altbilgi()}`;
}

/* =========================================================
   KAYITLAR
   ========================================================= */
function kayitKart(k) {
  const yt = youtubeKimlik(k.kaynak);
  const d = V.repertuar.deyisler.find((x) => x.id === k.deyis_id);
  const ekran = yt
    ? `<div class="ekran" data-yt="${yt}"><img src="${k.kapak ? kacis(k.kapak) : `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`}" alt="" loading="lazy" onerror="this.onerror=null;this.src='gorsel/foto/foto-09.webp'"><button class="oynat" type="button"><span>İzle</span></button></div>`
    : /\.(mp3|m4a|ogg|wav)$/i.test(k.kaynak)
      ? `<audio controls preload="none" src="${kacis(k.kaynak)}" style="width:100%"></audio>`
      : `<div class="ekran" data-video="${kacis(k.kaynak)}"><img src="${kacis(k.kapak)}" alt="" loading="lazy"><button class="oynat" type="button"><span>İzle</span></button></div>`;
  return `<article class="kayit belir" data-kategori="${kacis(k.kategori)}">${ekran}
    <div class="kayit__bilgi"><h3${!k.baslik && yt ? ` data-yt-baslik="${yt}"` : ""}>${kacis(k.baslik || "Balım Sultan Muhabbeti")}</h3><span class="etiket">${kacis(k.kategori)}</span></div>
    ${k.aciklama ? `<p>${kacis(k.aciklama)}</p>` : ""}${d ? `<a class="metin-dugme soluk" href="#d-${d.id}">Sözleri</a>` : ""}</article>`;
}
function kayitlar() {
  const kat = [...new Set(V.kayitlar.map((k) => k.kategori).filter(Boolean))];
  return `${sayfaBas({ etiket: "Kayıtlar", baslik: "Ses ve <em>görüntü</em>", ozet: "Muhabbetlerden, meydanlardan ve sahnelerden kayıtlar. YouTube'a yüklenen her video ve her ses kaydı buraya eklenir.", zemin: "gorsel/foto/foto-12.webp", sinif: "kizil", kisa: true })}
  <div class="icerik">
    <div class="sekmeler" role="group" aria-label="Kayıt türü"><button type="button" aria-pressed="true" data-kat="">Tümü</button>${kat.map((k) => `<button type="button" aria-pressed="false" data-kat="${kacis(k)}">${kacis(k)}</button>`).join("")}</div>
    <div class="kayit-izgara">${V.kayitlar.map(kayitKart).join("")}</div>
  </div>${altbilgi()}`;
}
function kayitlarKur() {
  $$("[data-yt-baslik]").forEach((h) => {
    fetch(`https://noembed.com/embed?url=${encodeURIComponent("https://www.youtube.com/watch?v=" + h.dataset.ytBaslik)}`)
      .then((r) => r.json()).then((j) => { if (j && j.title) h.textContent = j.title.replace(/^Balım Sultan Muhabbeti\s*[-–]\s*/, ""); }).catch(() => {});
  });
  $$(".sekmeler button").forEach((b) => b.addEventListener("click", () => {
    $$(".sekmeler button").forEach((x) => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
    $$(".kayit").forEach((k) => (k.hidden = b.dataset.kat && k.dataset.kategori !== b.dataset.kat));
  }));
  $$("[data-video]").forEach((e) => {
    const img = e.querySelector("img");
    const yon = () => { if (img.naturalHeight > img.naturalWidth) e.classList.add("dikey"); };
    img.complete ? yon() : img.addEventListener("load", yon);
    e.querySelector(".oynat").addEventListener("click", () => {
      e.innerHTML = `<video src="${e.dataset.video}" controls autoplay playsinline poster="${img.getAttribute("src")}"></video>`;
      $("video", e).style.objectFit = "contain";
    });
  });
}

/* =========================================================
   FOTOĞRAFLAR
   ========================================================= */
function fotograflar() {
  const desen = ["b", "k", "d", "g", "g", "d", "k", "b"];
  const one = V.fotograflar[0], one_var = !!(one && one.metin);
  const geri = one_var ? V.fotograflar.slice(1) : V.fotograflar;
  const ilk = one_var ? (() => {
    const [nesir, ...siir] = one.metin.split(/\n\s*\n/);
    return `<section class="one-foto">
      <figure class="kare one-foto__kare belir" data-foto="0"><img src="${kacis(one.dosya)}" alt="${kacis(one.aciklama)}"></figure>
      <div class="one-foto__yazi belir">
        <span class="bolum-etiket" style="margin-bottom:22px">No. 01 · ${kacis(one.aciklama)}</span>
        <p class="one-foto__nesir">${kacis(nesir)}</p>
        ${siir.map((k) => `<p class="one-foto__siir">${k.split("\n").map(kacis).join("<br>")}</p>`).join("")}
        <span class="etiket" style="color:var(--al-acik)">Mehdî</span>
      </div>
    </section>`;
  })() : "";
  return `${sayfaBas({ etiket: "Fotoğraflar", baslik: "Dergâhtan <em>kareler</em>", ozet: "Sahneden ve meydandan. Fotoğrafın üzerine gelince rengi döner; tıklayınca büyür.", zemin: "gorsel/foto/foto-22.webp", sinif: "kizil", kisa: true })}
  <div class="icerik">${ilk}
    <div class="izgara">${geri.map((f, j) => {
      const i = one_var ? j + 1 : j, t = desen[j % desen.length];
      return `<figure class="kare kare--${t} belir" data-foto="${i}"><img src="${kacis(f.dosya)}" alt="${kacis(f.aciklama || "Muhabbetten bir kare")}" loading="lazy"><figcaption><span>No. ${iki(i + 1)}</span><span>${kacis([f.aciklama, f.yer, f.tarih].filter(Boolean).join(" · "))}</span></figcaption></figure>`;
    }).join("")}</div>
    <p style="margin-top:60px"><a class="kapi" href="#album">Albümü aç</a></p>
  </div>${altbilgi()}`;
}
const fotograflarKur = () => $$("[data-foto]").forEach((f) => f.addEventListener("click", () => perdeAc(V.fotograflar, +f.dataset.foto)));

/* =========================================================
   ALBÜM
   ========================================================= */
function albumYuzleri() {
  const y = [];
  y.push(`<div class="yuz kapak-gorsel"><img src="gorsel/doku/album-kapak.webp" alt="Muhabbet Albümü"></div>`);
  y.push(`<div class="yuz sol-yuz"><div class="ic-kapak"><p>Halimizi hal eyledik<br>Yolumuzu yol eyledik<br>Her çiçekten bal eyledik<br>Arıya saydılar bizi</p><span>Pir Sultan Abdal</span></div></div>`);
  V.album.forEach((a, i) => {
    const aci = [-1.4, 1.1, -0.6, 1.5, -1.0, 0.7][i % 6];
    y.push(`<div class="yuz ${y.length % 2 ? "sol-yuz" : "sag-yuz"}"><div class="sayfa-ic"><div class="yapisik" style="--aci:${aci}deg"><div class="baski"><img src="${kacis(a.dosya)}" alt="Albümden bir fotoğraf" loading="lazy"><i class="kose k1"></i><i class="kose k2"></i><i class="kose k3"></i><i class="kose k4"></i></div></div>
      ${a.dortluk ? `<p class="dortluk">${a.dortluk.split("\n").map(kacis).join("<br>")}<span>${kacis(a.asik)}</span></p>` : ""}</div></div>`);
  });
  if (y.length % 2) y.push(`<div class="yuz sol-yuz"><div class="ic-kapak"><span>Balım Sultan Muhabbeti</span></div></div>`);
  y.push(`<div class="yuz kapak-yuz"><span class="etiket">Sayfalar eklendikçe albüm büyür</span></div>`);
  if (y.length % 2) y.push(`<div class="yuz kapak-yuz"></div>`);
  return y;
}
function album() {
  return `<section class="album-sahne">
    <div class="album-bas"><span class="bolum-etiket" style="margin:0 auto">Albüm</span><h1>Sayfa <em>sayfa</em></h1></div>
    <div class="kitap-sahne"><div class="kitap" id="kitap"></div></div>
    <div class="kitap__arac"><button type="button" id="geri-sayfa">Önceki sayfa</button><span id="sayfa-no"></span><button type="button" id="ileri-sayfa">Sonraki sayfa</button></div>
    <p class="kitap__ipucu">Sayfanın köşesinden tutup çevirin</p>
  </section>${altbilgi()}`;
}
let sayfaCevirYukleme = null;
function sayfaCevirYukle() {
  if (window.St && window.St.PageFlip) return Promise.resolve();
  if (!sayfaCevirYukleme) sayfaCevirYukleme = new Promise((ok, red) => {
    const sc = document.createElement("script");
    sc.src = "https://cdn.jsdelivr.net/npm/page-flip@2.0.7/dist/js/page-flip.browser.js";
    sc.onload = ok; sc.onerror = red; document.head.append(sc);
  });
  return sayfaCevirYukleme;
}
function albumKur() {
  const kitap = $("#kitap");
  const yuzler = albumYuzleri();
  // Kapak ve arka kapak kalın, aradaki sayfalar ince kâğıt
  kitap.innerHTML = yuzler.map((h, i) => `<div class="sayfa" data-density="${i === 0 || i === yuzler.length - 1 ? "hard" : "soft"}">${h}</div>`).join("");
  const no = $("#sayfa-no"), geri = $("#geri-sayfa"), ileri = $("#ileri-sayfa");
  sayfaCevirYukle().then(() => {
    if (!document.body.contains(kitap)) return;
    const pf = new window.St.PageFlip(kitap, {
      width: 600, height: 800, size: "stretch", minWidth: 260, maxWidth: 900, minHeight: 347, maxHeight: 1200,
      showCover: true, usePortrait: true, maxShadowOpacity: 0.55, flippingTime: 1100, drawShadow: true,
      mobileScrollSupport: false, swipeDistance: 24, showPageCorners: true, startZIndex: 1, autoSize: true,
    });
    pf.loadFromHTML(kitap.querySelectorAll(".sayfa"));
    const toplam = pf.getPageCount();
    const guncelle = () => {
      const i = pf.getCurrentPageIndex();
      no.textContent = i === 0 ? "Kapak" : i >= toplam - 1 ? "Arka kapak" : `${iki(i)} / ${iki(toplam - 2)}`;
      geri.disabled = i === 0; ileri.disabled = i >= toplam - 1;
    };
    pf.on("flip", guncelle); pf.on("changeOrientation", guncelle);
    geri.onclick = () => pf.flipPrev(); ileri.onclick = () => pf.flipNext();
    const tus = (e) => { if (e.key === "ArrowRight") pf.flipNext(); if (e.key === "ArrowLeft") pf.flipPrev(); };
    addEventListener("keydown", tus);
    temizlik.push(() => { removeEventListener("keydown", tus); try { pf.destroy(); } catch {} });
    guncelle();
  }).catch(() => {
    // Kütüphane yüklenemezse sayfalar alt alta gösterilir
    kitap.classList.add("duz"); $(".kitap__arac").hidden = true; $(".kitap__ipucu").hidden = true;
  });
}

/* =========================================================
   ANILAR, HAKKIMIZDA
   ========================================================= */
function anilar() {
  return `${sayfaBas({ etiket: "Anılar", baslik: "Kalan<em>lar</em>", ozet: "Muhabbetlerden geriye kalan küçük hikâyeler.", zemin: "gorsel/doku/meydan-evi.webp", sinif: "kizil", kisa: true })}
  <div class="icerik icerik--dar"><div class="anilar">${V.anilar.map((a) => `<article class="ani belir"><div class="ani__zaman">${kacis(a.tarih)}${a.yer ? `<small>${kacis(a.yer)}</small>` : ""}</div><div><h3>${kacis(a.baslik)}</h3>${a.foto ? `<img src="${kacis(a.foto)}" alt="" loading="lazy" style="margin-bottom:20px">` : ""}${a.metin.split(/\n+/).map((p) => `<p>${kacis(p)}</p>`).join("")}</div></article>`).join("")}</div></div>${altbilgi()}`;
}
function hakkimizda() {
  return `${sayfaBas({ etiket: "Hakkımızda", baslik: "<em>Biz</em>", ozet: "Bu siteyi hazırlayan canlar. Diğer yol arkadaşlarımız eklenecek.", zemin: "gorsel/foto/foto-23.webp", sinif: "kizil", kisa: true })}
  <div class="icerik"><div class="ekip">${V.ekip.map((k) => `<article class="can belir">
    <figure><img src="${kacis(k.foto)}" alt="${kacis(k.ad)}" loading="lazy"></figure>
    <span class="etiket" style="color:var(--al-acik)">${kacis(k.rol)}</span><h2>${kacis(k.ad)}</h2>
    ${k.aciklama ? `<p>${kacis(k.aciklama)}</p>` : ""}${k.baglanti ? `<a class="metin-dugme soluk" href="${kacis(k.baglanti)}" target="_blank" rel="noopener">${/instagram/.test(k.baglanti) ? "Instagram" : "Bağlantı"}</a>` : ""}
  </article>`).join("")}</div></div>${altbilgi()}`;
}

/* =========================================================
   YÖNLENDİRME
   ========================================================= */
const SAYFALAR = {
  "": [anaSayfa, anaSayfaKur],
  "zakir-belgeseli": [belgesel, belgeselKur],
  nefesler: [nefesler, nefeslerKur],
  sozluk: [sozluk, () => sozlukKur()],
  yolculugumuz: [yolculuk, () => terimIsaretle($(".yolculuk-giris"))],
  kayitlar: [kayitlar, () => { kayitlarKur(); ytKur(); }],
  fotograflar: [fotograflar, fotograflarKur],
  album: [album, albumKur],
  anilar: [anilar, () => {}],
  hakkimizda: [hakkimizda, () => {}],
};
function goster() {
  temizlik.forEach((f) => { try { f(); } catch {} }); temizlik = [];
  pencereKapat(); perdeKapat(); menuKapat();
  const h = decodeURIComponent(location.hash.replace(/^#/, ""));
  let anahtar = h, html, kur;
  if (h.startsWith("d-")) { html = deyis(h.slice(2)); kur = () => deyisKur(h.slice(2)); anahtar = "nefesler"; }
  else if (/^t\d+$/.test(h)) { html = sozluk(); kur = () => sozlukKur(h); anahtar = "sozluk"; }
  else { const s = SAYFALAR[h] || SAYFALAR[""]; if (!SAYFALAR[h]) anahtar = ""; html = s[0](); kur = s[1]; }
  basaDon();
  sahne.innerHTML = html;
  $$(".nav__links a, .menu__liste a").forEach((a) => (a.getAttribute("href") === "#" + anahtar ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
  kur();
  belirt();
  const b = $("h1", sahne);
  document.title = anahtar && b ? `${b.textContent.trim()} · Balım Sultan Muhabbeti` : "Balım Sultan Muhabbeti";
}
document.addEventListener("click", (e) => {
  if (e.target.closest("[data-basa]")) { e.preventDefault(); kaydirHedef(0); }
});

/* ---------------- menü ---------------- */
const menu = $("#menu"), menuAc = $("#menu-ac");
function menuKapat() { if (menu.hidden) return; menu.hidden = true; menuAc.setAttribute("aria-expanded", "false"); lenis?.start(); }
menuAc.addEventListener("click", () => { menu.hidden = false; menuAc.setAttribute("aria-expanded", "true"); lenis?.stop(); $("#menu-kapat").focus(); });
$("#menu-kapat").addEventListener("click", menuKapat);
menu.addEventListener("click", (e) => { if (e.target.closest("a")) menuKapat(); });
addEventListener("keydown", (e) => { if (e.key === "Escape") { menuKapat(); perdeKapat(); pencereKapat(); } });

/* ---------------- başlat ---------------- */
const J = (yol, anahtar) => getir(yol, "json").then((o) => (anahtar ? o[anahtar] : o) || []);
Promise.all([
  J("data/nefesler.json", "deyisler"), J("data/sozluk.json", "terimler"), J("data/kayitlar.json", "kayitlar"), J("data/fotograflar.json", "fotograflar"),
  J("data/album.json", "sayfalar"), J("data/anilar.json", "anilar"), J("data/ekip.json", "ekip"), J("data/yolculuk.json", "duraklar"), J("data/zakir.json", "bolumler"),
  getir("data/ayarlar.json", "json").catch(() => ({})),
]).then(([nefesler, sozluk, kayitlar, fotograflar, album, anilar, ekip, yolculuk, zakir, ayarlar]) => {
  // Nefes sözleri panelde düz metin olarak tutulur: kıtalar boş satırla, dizeler satır sonuyla ayrılır
  const deyisler = nefesler.map((d) => ({ ...d, kitalar: String(d.sozler || "").replace(/\r/g, "").trim().split(/\n\s*\n/).map((k) => k.split("\n").map((x) => x.trim()).filter(Boolean)).filter((k) => k.length) }));
  const metinler = (l) => l.map((o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v == null ? "" : v])));
  V = { repertuar: { deyisler }, sozluk: metinler(sozluk), kayitlar: metinler(kayitlar), fotograflar: metinler(fotograflar), album: metinler(album), anilar: metinler(anilar), ekip: metinler(ekip), yolculuk, zakir: metinler(zakir), ayarlar, serhler: new Set() };
  sozlukHazirla(sozluk);
  addEventListener("hashchange", goster);
  goster();
}).catch((e) => {
  sahne.innerHTML = `<div class="icerik" style="padding-top:160px"><p class="bos">Veriler okunamadı (${kacis(e.message)}). Site, dosyaya çift tıklayarak açıldığında verileri okuyamaz; GitHub Pages'te ya da yerel bir sunucuda açın.</p></div>`;
});
