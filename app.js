// Elements
const gallery = document.getElementById("gallery");
const searchInput = document.getElementById("searchInput");
const clearSearch = document.getElementById("clearSearch");
const chips = document.querySelectorAll("[data-chip]");

const fabUpload = document.getElementById("fabUpload");
const openUpload = document.getElementById("openUpload");
const refreshBtn = document.getElementById("refresh");
const drawer = document.getElementById("uploadDrawer");
const closeDrawer = document.getElementById("closeDrawer");
const uploadForm = document.getElementById("uploadForm");

// Viewer
const viewer = document.getElementById("viewer");
const viewerImg = document.getElementById("viewerImg");
const viewerTitle = document.getElementById("viewerTitle");
const downloadBtn = document.getElementById("downloadBtn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const closeViewer = document.getElementById("closeViewer");
const commentsList = document.getElementById("commentsList");
const commentForm = document.getElementById("commentForm");

let IMAGES = [];     // {filename, title, url, comments[]}
let filtered = [];
let currentIndex = 0;
let zoom = 1;
let pan = {x:0, y:0};
let isPanning = false; 
let panStart = {x:0,y:0};

// ===== Helpers =====
function renderPins(list){
  gallery.innerHTML = "";
  list.forEach((img, idx) => {
    const el = document.createElement("article");
    el.className = "pin";
    el.innerHTML = `
      <img class="pin__img" src="${img.url}" alt="${escapeHtml(img.title)}" loading="lazy" data-idx="${idx}">
      <div class="pin__meta">
        <div class="pin__title">${escapeHtml(img.title)}</div>
        <div class="pin__actions">
          <button class="pin__btn" data-view="${idx}">Perbesar</button>
          <a class="pin__btn pin__btn--download" href="${img.url}" download>Download</a>
          <button class="pin__btn" data-comment="${idx}">Komentar (${img.comments?.length || 0})</button>
        </div>
      </div>
    `;
    gallery.appendChild(el);
  });
}

function escapeHtml(s){ const d=document.createElement("div"); d.innerText = s ?? ""; return d.innerHTML; }

function applyFilter(){
  const q = (searchInput.value || "").toLowerCase().trim();
  // (Optional) kategori chip bisa dipakai sebagai tag filter; di demo ini hanya example
  filtered = IMAGES.filter(i => i.title.toLowerCase().includes(q));
  renderPins(filtered);
}

async function loadImages(){
  const res = await fetch("/api/images");
  IMAGES = await res.json();
  filtered = [...IMAGES];
  renderPins(filtered);
}

function openDrawer(){ drawer.classList.add("open"); }
function closeDrawerFn(){ drawer.classList.remove("open"); }

// ===== Upload =====
uploadForm.addEventListener("submit", async (e)=>{
  e.preventDefault();
  const fd = new FormData(uploadForm);
  const res = await fetch("/api/upload", { method:"POST", body: fd });
  if(!res.ok){ alert("Gagal upload"); return; }
  const item = await res.json();
  IMAGES.push(item);
  applyFilter();
  uploadForm.reset();
  closeDrawerFn();
});

[fabUpload, openUpload].forEach(btn => btn.addEventListener("click", openDrawer));
closeDrawer.addEventListener("click", closeDrawerFn);
refreshBtn.addEventListener("click", loadImages);

// ===== Search/chips =====
searchInput.addEventListener("input", applyFilter);
clearSearch.addEventListener("click", ()=>{ searchInput.value=""; applyFilter(); });
chips.forEach(chip => chip.addEventListener("click", ()=>{
  const word = chip.textContent.trim().toLowerCase();
  if(word === "semua"){ searchInput.value=""; }
  else { searchInput.value = word; }
  applyFilter();
}));

// ===== Delegate clicks for view & comments =====
gallery.addEventListener("click", (e)=>{
  const viewIdx = e.target.getAttribute("data-view");
  const comIdx = e.target.getAttribute("data-comment");
  if(viewIdx !== null){
    openViewer(+viewIdx);
  }else if(comIdx !== null){
    openViewer(+comIdx, true); // buka dan fokus ke komentar
  }else{
    const img = e.target.closest(".pin")?.querySelector(".pin__img");
    if(img){ openViewer(+img.dataset.idx); }
  }
});

// ===== Viewer =====
function openViewer(idx, focusComments=false){
  currentIndex = Math.max(0, Math.min(idx, filtered.length-1));
  const item = filtered[currentIndex];
  if(!item) return;
  viewer.classList.remove("hidden");
  viewerImg.src = item.url;
  viewerTitle.textContent = item.title || item.filename;
  downloadBtn.href = item.url;

  // Reset zoom & pan
  zoom = 1; pan = {x:0,y:0};
  updateTransform();

  // Render comments
  renderComments(item);
  if(focusComments){
    setTimeout(()=>commentsList.scrollIntoView({behavior:"smooth", block:"start"}), 100);
  }
}

function closeViewerFn(){ viewer.classList.add("hidden"); }
closeViewer.addEventListener("click", closeViewerFn);
viewer.addEventListener("click", (e)=>{ if(e.target === viewer) closeViewerFn(); });

function nav(delta){
  let next = currentIndex + delta;
  if(next < 0) next = filtered.length - 1;
  if(next >= filtered.length) next = 0;
  openViewer(next);
}
prevBtn.addEventListener("click", ()=>nav(-1));
nextBtn.addEventListener("click", ()=>nav(1));

// Zoom controls
function updateTransform(){
  viewerImg.style.transform = `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;
}
document.getElementById("zoomIn").addEventListener("click", ()=>{ zoom = Math.min(zoom*1.2, 6); updateTransform(); });
document.getElementById("zoomOut").addEventListener("click", ()=>{ zoom = Math.max(zoom/1.2, 0.3); updateTransform(); });
document.getElementById("zoomReset").addEventListener("click", ()=>{ zoom=1; pan={x:0,y:0}; updateTransform(); });

// Mouse/touch pan
const wrap = document.querySelector(".viewer__imageWrap");
wrap.addEventListener("mousedown", (e)=>{ isPanning=true; panStart={x:e.clientX - pan.x, y:e.clientY - pan.y}; wrap.style.cursor="grabbing"; });
window.addEventListener("mousemove",(e)=>{ if(!isPanning) return; pan.x = e.clientX - panStart.x; pan.y = e.clientY - panStart.y; updateTransform(); });
window.addEventListener("mouseup",()=>{ isPanning=false; wrap.style.cursor="default"; });

// Mobile touch
let touchId=null;
wrap.addEventListener("touchstart",(e)=>{ const t=e.touches[0]; touchId=t.identifier; isPanning=true; panStart={x:t.clientX - pan.x, y:t.clientY - pan.y};},{passive:true});
wrap.addEventListener("touchmove",(e)=>{ for(const t of e.touches){ if(t.identifier===touchId){ pan.x = t.clientX - panStart.x; pan.y = t.clientY - panStart.y; updateTransform(); break; } } },{passive:true});
wrap.addEventListener("touchend",()=>{ isPanning=false; touchId=null; });

// Comments
function renderComments(item){
  commentsList.innerHTML = (item.comments||[]).map(c => {
    const date = new Date((c.ts||0)*1000).toLocaleString();
    return `<div class="comment"><b>${escapeHtml(c.author||"Anon")}</b> <small>· ${date}</small><div>${escapeHtml(c.text||"")}</div></div>`;
  }).join("") || `<div class="comment" style="opacity:.7">Belum ada komentar. Jadi yang pertama!</div>`;
}

commentForm.addEventListener("submit", async (e)=>{
  e.preventDefault();
  const item = filtered[currentIndex];
  if(!item) return;
  const fd = new FormData(commentForm);
  const payload = { filename: item.filename, author: fd.get("author")||"", text: fd.get("text")||"" };
  const res = await fetch("/api/comment",{ method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(payload) });
  const out = await res.json();
  if(out.ok){
    // Update source array (IMAGES) by filename
    const idxAll = IMAGES.findIndex(x=>x.filename===item.filename);
    if(idxAll>-1){ IMAGES[idxAll].comments = out.comments; }
    // Update filtered as well
    const idxF = filtered.findIndex(x=>x.filename===item.filename);
    if(idxF>-1){ filtered[idxF].comments = out.comments; }
    commentForm.reset();
    renderComments(filtered[currentIndex]);
    // Update badge angka komentar di card (optional, simple re-render)
    renderPins(filtered);
  }else{
    alert("Gagal menambah komentar");
  }
});

// Init
loadImages();
