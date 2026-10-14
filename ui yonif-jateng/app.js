// ====== Konfigurasi ======
const API_URL = "http://127.0.0.1:5000/api/batalyon";
const PAGE_SIZE = 12;

// ====== State ======
let all = [];
let filtered = [];
let view = "grid";
let page = 1;

const $ = (id) => document.getElementById(id);
const els = {
  q: $("q"), city: $("city"), category: $("category"), rating: $("rating"), sort: $("sort"),
  stats: $("stats"), info: $("resultInfo"), state: $("state"), results: $("results"),
  pager: $("pager"), drawer: $("drawer"), drawerBody: $("drawerBody"), scrim: $("scrim"),
};
$("endpointLabel").textContent = API_URL;

// ====== Helper ======
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const nf = new Intl.NumberFormat("id-ID");
const title = (d) => d.title || d.name || d.categoryName || "Tanpa nama";
const cityOf = (d) => d.city || d.state || "";
const score = (d) => Number(d.totalScore ?? d.rating ?? 0) || 0;
const reviews = (d) => Number(d.reviewsCount ?? 0) || 0;
const photos = (d) => Number(d.imagesCount ?? 0) || 0;
const mapsLink = (d) => d.url || (d.location ? `https://www.google.com/maps/search/?api=1&query=${d.location.lat},${d.location.lng}` : "");

function ratingHtml(d) {
  const s = score(d);
  if (!s) return `<span class="meta">Belum ada rating</span>`;
  return `<span class="rating">★ ${s.toString().replace(".", ",")} <small>(${nf.format(reviews(d))} ulasan)</small></span>`;
}
function thumbHtml(d) {
  const img = d.imageUrl
    ? `<img src="${esc(d.imageUrl)}" alt="${esc(title(d))}" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">`
    : "Tidak ada foto";
  const count = photos(d) ? `<span class="count">${nf.format(photos(d))} foto</span>` : "";
  return `<div class="thumb">${img}${count}</div>`;
}

// ====== Ambil data ======
async function loadData() {
  els.results.innerHTML = "";
  els.pager.innerHTML = "";
  els.stats.innerHTML = "";
  els.info.textContent = "";
  els.state.innerHTML = `<div class="grid">${'<div class="skeleton"></div>'.repeat(6)}</div>`;
  try {
    const res = await fetch(API_URL, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`Server membalas status ${res.status}`);
    const json = await res.json();
    all = Array.isArray(json) ? json : Array.isArray(json.data) ? json.data : [];
    els.state.innerHTML = "";
    buildFilterOptions();
    applyFilters();
  } catch (err) {
    all = [];
    els.state.innerHTML = `
      <div class="notice error">
        <h2>Data belum bisa dimuat</h2>
        <p>${esc(err.message)}. Pastikan server Flask berjalan di <code>${esc(API_URL)}</code> dan CORS sudah aktif (<code>flask-cors</code>).</p>
        <button class="btn" type="button" id="retryBtn">Coba lagi</button>
      </div>`;
    $("retryBtn").addEventListener("click", loadData);
  }
}

// ====== Filter ======
function buildFilterOptions() {
  const fill = (select, values, placeholder) => {
    const current = select.value;
    select.innerHTML = `<option value="">${placeholder}</option>` +
      [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "id"))
        .map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join("");
    select.value = current;
  };
  fill(els.city, all.map(cityOf), "Semua kota");
  fill(els.category, all.map((d) => d.categoryName), "Semua kategori");
}

function applyFilters() {
  const q = els.q.value.trim().toLowerCase();
  const minRating = Number(els.rating.value);
  filtered = all.filter((d) => {
    if (els.city.value && cityOf(d) !== els.city.value) return false;
    if (els.category.value && d.categoryName !== els.category.value) return false;
    if (minRating && score(d) < minRating) return false;
    if (q) {
      const hay = `${title(d)} ${d.address || ""} ${cityOf(d)} ${d.categoryName || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const sorters = {
    name: (a, b) => title(a).localeCompare(title(b), "id"),
    rating: (a, b) => score(b) - score(a),
    reviews: (a, b) => reviews(b) - reviews(a),
    images: (a, b) => photos(b) - photos(a),
    city: (a, b) => cityOf(a).localeCompare(cityOf(b), "id"),
  };
  filtered.sort(sorters[els.sort.value]);
  page = 1;
  render();
}

// ====== Render ======
function renderStats() {
  const rated = all.filter((d) => score(d));
  const avg = rated.length ? rated.reduce((s, d) => s + score(d), 0) / rated.length : 0;
  const cities = new Set(all.map(cityOf).filter(Boolean)).size;
  const totalPhotos = all.reduce((s, d) => s + photos(d), 0);
  const items = [
    [nf.format(all.length), "Total batalyon"],
    [nf.format(cities), "Kota / kabupaten"],
    [avg ? avg.toFixed(1).replace(".", ",") : "–", "Rata-rata rating"],
    [nf.format(totalPhotos), "Total foto"],
  ];
  els.stats.innerHTML = items.map(([n, l]) => `<div class="stat"><b>${n}</b><span>${l}</span></div>`).join("");
}

function render() {
  renderStats();
  els.info.textContent = `Menampilkan ${nf.format(filtered.length)} dari ${nf.format(all.length)} data`;

  if (!filtered.length) {
    els.results.innerHTML = `
      <div class="notice">
        <h2>Tidak ada data yang cocok</h2>
        <p>Ubah kata kunci atau longgarkan filter untuk melihat hasil.</p>
        <button class="btn ghost" type="button" id="emptyReset">Reset filter</button>
      </div>`;
    $("emptyReset").addEventListener("click", resetFilters);
    els.pager.innerHTML = "";
    return;
  }

  const pages = Math.ceil(filtered.length / PAGE_SIZE);
  const slice = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const offset = (page - 1) * PAGE_SIZE;

  if (view === "grid") {
    els.results.innerHTML = `<div class="grid">${slice.map((d, i) => `
      <button class="card" type="button" data-i="${offset + i}">
        ${thumbHtml(d)}
        <div class="card-body">
          ${d.categoryName ? `<span class="tag">${esc(d.categoryName)}</span>` : ""}
          <h3>${esc(title(d))}</h3>
          <p class="meta">${esc(cityOf(d))}</p>
          <p class="addr">${esc(d.address)}</p>
          <div class="card-foot">${ratingHtml(d)}</div>
        </div>
      </button>`).join("")}</div>`;
  } else {
    els.results.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>Nama</th><th>Kategori</th><th>Kota</th><th>Alamat</th><th>Rating</th><th>Foto</th></tr></thead>
      <tbody>${slice.map((d, i) => `
        <tr data-i="${offset + i}" tabindex="0">
          <td><strong>${esc(title(d))}</strong></td>
          <td>${esc(d.categoryName)}</td>
          <td>${esc(cityOf(d))}</td>
          <td>${esc(d.address)}</td>
          <td>${score(d) ? score(d).toString().replace(".", ",") : "–"}</td>
          <td>${nf.format(photos(d))}</td>
        </tr>`).join("")}</tbody></table></div>`;
  }

  els.pager.innerHTML = pages > 1 ? `
    <button class="btn ghost" type="button" id="prev" ${page === 1 ? "disabled" : ""}>Sebelumnya</button>
    <span>Halaman ${page} dari ${pages}</span>
    <button class="btn ghost" type="button" id="next" ${page === pages ? "disabled" : ""}>Berikutnya</button>` : "";
  const prev = $("prev"), next = $("next");
  if (prev) prev.addEventListener("click", () => { page--; render(); window.scrollTo({ top: 0 }); });
  if (next) next.addEventListener("click", () => { page++; render(); window.scrollTo({ top: 0 }); });
}

// ====== Detail ======
function formatValue(v) {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "object") return `<code>${esc(JSON.stringify(v))}</code>`;
  if (typeof v === "string" && /^https?:\/\//.test(v)) return `<a href="${esc(v)}" target="_blank" rel="noopener">${esc(v)}</a>`;
  return esc(v);
}

function openDetail(d) {
  const loc = d.location;
  const cats = (d.categories || []).map((c) => `<span class="tag">${esc(c)}</span>`).join("");
  let mapHtml = "";
  if (loc && loc.lat != null && loc.lng != null) {
    const dx = 0.006;
    const bbox = [loc.lng - dx, loc.lat - dx, loc.lng + dx, loc.lat + dx].join("%2C");
    mapHtml = `<iframe class="map" title="Peta lokasi" loading="lazy"
      src="https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${loc.lat}%2C${loc.lng}"></iframe>`;
  }

  const rows = [
    ["Alamat", d.address],
    ["Kota", cityOf(d)],
    ["Telepon", d.phone ? `<a href="tel:${esc(d.phone)}">${esc(d.phone)}</a>` : null],
    ["Situs web", d.website ? `<a href="${esc(d.website)}" target="_blank" rel="noopener">${esc(d.website)}</a>` : null],
    ["Rating", score(d) ? `${score(d)} (${nf.format(reviews(d))} ulasan)` : null],
    ["Koordinat", loc ? `${loc.lat}, ${loc.lng}` : null],
    ["Jumlah foto", photos(d) ? nf.format(photos(d)) : null],
    ["Bahasa", d.language],
    ["Negara", d.countryCode],
  ].filter(([, v]) => v);

  const hours = Array.isArray(d.openingHours) && d.openingHours.length
    ? `<h3>Jam operasional</h3><table class="hours">${d.openingHours.map((h) =>
        `<tr><td>${esc(h.day)}</td><td>${esc(h.hours)}</td></tr>`).join("")}</table>` : "";

  const link = mapsLink(d);
  const raw = Object.entries(d).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${formatValue(v)}</td></tr>`).join("");

  els.drawerBody.innerHTML = `
    ${d.imageUrl ? `<div class="hero"><img src="${esc(d.imageUrl)}" alt="${esc(title(d))}" referrerpolicy="no-referrer" onerror="this.parentElement.remove()"></div>` : ""}
    <div class="d-body">
      <h2>${esc(title(d))}</h2>
      <div class="tags">${cats}</div>
      ${d.description ? `<p>${esc(d.description)}</p>` : ""}
      <dl class="info">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v.toString().startsWith("<a") ? v : esc(v)}</dd>`).join("")}</dl>
      <div class="actions">
        ${link ? `<a class="btn" href="${esc(link)}" target="_blank" rel="noopener">Buka di Google Maps</a>` : ""}
        ${d.website ? `<a class="btn ghost" href="${esc(d.website)}" target="_blank" rel="noopener">Kunjungi situs</a>` : ""}
      </div>
      ${mapHtml}
      ${hours}
      <details><summary>Semua data dari API</summary><table class="raw">${raw}</table></details>
    </div>`;

  els.drawer.classList.add("open");
  els.drawer.setAttribute("aria-hidden", "false");
  els.scrim.hidden = false;
  els.drawer.scrollTop = 0;
  $("closeBtn").focus();
}

function closeDetail() {
  els.drawer.classList.remove("open");
  els.drawer.setAttribute("aria-hidden", "true");
  els.scrim.hidden = true;
}

// ====== Event ======
function resetFilters() {
  els.q.value = ""; els.city.value = ""; els.category.value = "";
  els.rating.value = "0"; els.sort.value = "name";
  applyFilters();
}

let timer;
els.q.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(applyFilters, 200); });
[els.city, els.category, els.rating, els.sort].forEach((el) => el.addEventListener("change", applyFilters));
$("resetBtn").addEventListener("click", resetFilters);
$("reloadBtn").addEventListener("click", loadData);
$("closeBtn").addEventListener("click", closeDetail);
els.scrim.addEventListener("click", closeDetail);
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDetail(); });

document.querySelectorAll(".seg button").forEach((b) => b.addEventListener("click", () => {
  view = b.dataset.view;
  document.querySelectorAll(".seg button").forEach((x) => x.classList.toggle("active", x === b));
  render();
}));

els.results.addEventListener("click", (e) => {
  const el = e.target.closest("[data-i]");
  if (el) openDetail(filtered[Number(el.dataset.i)]);
});
els.results.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const el = e.target.closest("tr[data-i]");
    if (el) openDetail(filtered[Number(el.dataset.i)]);
  }
});

loadData();
