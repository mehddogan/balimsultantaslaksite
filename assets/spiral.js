// Ana sayfa sarmalı: fotoğraflarımız eğri karolar üzerinde, kaydırdıkça dönen bir helezon.
import * as THREE from "three";

const AYAR = {
  karoTur: 15, tur: 5, basYaricap: 5, sonYaricap: 3.5, karoOran: 1.1, dilim: 24,
  aralik: 0.35, ortusme: 0.005, kameraZ: 12, yumusatma: 0.075, temelDonus: 0.0012,
  kaydirmaDonus: 0.0035, sonum: 0.9, kameraY: 0.2, egim: 0.1, sarmalY: -2.0,
};

const kose = /* glsl */ `
  varying vec2 vUv; varying vec3 vDunya;
  void main() {
    vUv = uv;
    vec4 d = modelMatrix * vec4(position, 1.0);
    vDunya = d.xyz;
    gl_Position = projectionMatrix * viewMatrix * d;
  }`;
// Uzaktaki karolar koyu kırmızıya iner: fotoğrafın kendisi değişmez, derinlik cem evinin loşluğuna karışır.
const parca = /* glsl */ `
  precision highp float;
  uniform sampler2D uHarita; uniform vec3 uKamera; uniform vec2 uOran;
  varying vec2 vUv; varying vec3 vDunya;
  void main() {
    vec2 uv = (vUv - 0.5) * uOran + 0.5;
    vec4 t = texture2D(uHarita, uv);
    float kenar = mix(0.76, 1.0, 1.0 - smoothstep(0.34, 0.86, length(vUv - 0.5)));
    float uzak = distance(vDunya, uKamera);
    float derin = mix(0.42, 1.0, 1.0 - smoothstep(8.0, 22.0, uzak));
    vec3 r = t.rgb;
    float l = dot(r, vec3(0.299, 0.587, 0.114));
    vec3 kizil = vec3(l * 0.95, l * 0.22, l * 0.2);
    r = mix(kizil, r, smoothstep(0.45, 1.0, derin));
    gl_FragColor = vec4(r * kenar * derin, 1.0);
  }`;

function egriKaro(r, yay, h, n) {
  const g = new THREE.BufferGeometry(), p = [], uv = [], ix = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = -yay / 2 + yay * t;
    p.push(Math.sin(a) * r, h / 2, Math.cos(a) * r, Math.sin(a) * r, -h / 2, Math.cos(a) * r);
    uv.push(t, 1, t, 0);
  }
  for (let i = 0; i < n; i++) { const a = i * 2; ix.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(ix);
  return g;
}

export function sarmalKur(kap, gorseller, durum) {
  const mobil = () => innerWidth < 768;
  const sahne = new THREE.Scene();
  const kamera = new THREE.PerspectiveCamera(45, kap.clientWidth / kap.clientHeight, 0.1, 100);
  kamera.position.set(0, 0, AYAR.kameraZ + (mobil() ? 3 : 0));
  const cizici = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  cizici.setPixelRatio(Math.min(devicePixelRatio, 2));
  cizici.setSize(kap.clientWidth, kap.clientHeight);
  cizici.setClearColor(0, 0);
  cizici.domElement.className = "hero__tuval";
  cizici.domElement.setAttribute("aria-hidden", "true");
  kap.prepend(cizici.domElement);

  const sarmal = new THREE.Group();
  sarmal.position.y = AYAR.sarmalY;
  sahne.add(sarmal);

  const toplam = AYAR.karoTur * AYAR.tur, adim = (Math.PI * 2) / AYAR.karoTur;
  const kiris = 2 * AYAR.basYaricap * Math.sin(adim / 2), h = kiris * AYAR.karoOran;
  const yukseklik = (toplam - 1) * AYAR.aralik;
  const yukleyici = new THREE.TextureLoader();
  const yukle = (u) => new Promise((ok) => yukleyici.load(u, (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = cizici.capabilities.getMaxAnisotropy();
    t.minFilter = THREE.LinearMipmapLinearFilter;
    ok(t);
  }, undefined, () => { const d = new THREE.DataTexture(new Uint8Array([30, 14, 15, 255]), 1, 1); d.needsUpdate = true; ok(d); }));

  Promise.all(gorseller.map(yukle)).then((dokular) => {
    for (let i = 0; i < toplam; i++) {
      const k = i / (toplam - 1), r = AYAR.basYaricap + (AYAR.sonYaricap - AYAR.basYaricap) * k;
      const doku = dokular[i % dokular.length];
      // Karonun en/boy oranına göre görseli ortadan kırp
      const gw = doku.image ? doku.image.width : 1, gh = doku.image ? doku.image.height : 1;
      const karoOran = (r * (adim + AYAR.ortusme)) / h, gOran = gw / gh;
      const oran = gOran > karoOran ? new THREE.Vector2(karoOran / gOran, 1) : new THREE.Vector2(1, gOran / karoOran);
      const m = new THREE.ShaderMaterial({
        vertexShader: kose, fragmentShader: parca, side: THREE.DoubleSide, transparent: true,
        uniforms: { uHarita: { value: doku }, uKamera: { value: kamera.position }, uOran: { value: oran } },
      });
      const karo = new THREE.Mesh(egriKaro(r, adim + AYAR.ortusme, h, AYAR.dilim), m);
      karo.position.y = yukseklik / 2 - i * AYAR.aralik;
      karo.rotation.y = i * adim;
      sarmal.add(karo);
    }
    cizici.domElement.classList.add("hazir");
  });

  let calisiyor = true, kameraY = 0, egX = 0, egZ = 0;
  function dongu() {
    if (!calisiyor) return;
    sarmal.rotation.y += AYAR.temelDonus + durum.donus;
    durum.donus *= AYAR.sonum;
    if (!mobil()) {
      egX += (durum.hedefX - egX) * AYAR.yumusatma;
      egZ += (durum.hedefZ - egZ) * AYAR.yumusatma;
      sarmal.rotation.x = egX; sarmal.rotation.z = egZ;
    }
    const hedefY = -durum.ilerleme * AYAR.kameraY * 10;
    kameraY += (hedefY - kameraY) * AYAR.yumusatma;
    kamera.position.y = kameraY;
    kamera.lookAt(0, kameraY * 0.4, 0);
    if (durum.gorunur) cizici.render(sahne, kamera);
    requestAnimationFrame(dongu);
  }
  requestAnimationFrame(dongu);

  function boyut() {
    kamera.aspect = kap.clientWidth / kap.clientHeight;
    kamera.position.z = AYAR.kameraZ + (mobil() ? 3 : 0);
    kamera.updateProjectionMatrix();
    cizici.setPixelRatio(Math.min(devicePixelRatio, 2));
    cizici.setSize(kap.clientWidth, kap.clientHeight);
  }
  addEventListener("resize", boyut);

  return {
    dokun(v) { durum.donus += v * AYAR.kaydirmaDonus * 1.25; },
    egim(x, y) { durum.hedefX = y * AYAR.egim; durum.hedefZ = x * AYAR.egim * -0.5; },
    yoket() {
      calisiyor = false;
      removeEventListener("resize", boyut);
      sarmal.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      cizici.dispose();
      cizici.domElement.remove();
    },
  };
}
