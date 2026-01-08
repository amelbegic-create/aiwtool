export const ALAT_2_FULL_HTML = `
<!DOCTYPE html>
<html lang="bs">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>EVAL_v2 – Evaluacija Enterprise</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;800&display=swap" rel="stylesheet">

<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>

<style>
  :root{
    --bg:#f0f2f5; --panel:#ffffff; --line:#e2e8f0; --txt:#1e293b; --muted:#64748b;
    --accent:#FFC72C; --danger:#ef4444; --success:#10b981; --warning:#f59e0b;
    --thead:#1e293b; --thead-txt:#ffffff;
    --input-bg:#ffffff; --input-border:#cbd5e1;
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--txt);font:13px/1.4 'Inter', sans-serif; padding: 20px; overflow-x: hidden;}

  /* HEADER */
  .header-section { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid var(--line); padding-bottom: 15px; }
  h1 { font-size: 22px; margin: 0; font-weight: 800; letter-spacing: -0.5px; color: #1e293b; }

  /* CARDS & GRID */
  .toolbar { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; }
  .tool-card { background: #f8fafc; border: 1px solid var(--line); border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 6px; }
  .tool-card label { font-size: 10px; font-weight: 700; color: var(--muted); text-transform: uppercase; }
  
  /* INPUTS */
  input, select, textarea { padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; width: 100%; font-weight: 600; background: #fff; color: #333; font-family: 'Inter', sans-serif; }
  input:focus, select:focus, textarea:focus { outline: 2px solid var(--accent); border-color: var(--accent); }
  textarea { resize: vertical; min-height: 80px; }

  /* KPI CARDS */
  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 20px; }
  .kpi-card { background: #fff; padding: 15px; border-radius: 10px; border: 1px solid var(--line); border-left-width: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
  .kpi-val { font-size: 24px; font-weight: 800; margin-top: 4px; color: #1e293b; }
  .kpi-label { font-size: 10px; font-weight: 700; color: var(--muted); text-transform: uppercase; }

  /* ACTIONS */
  .actions { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
  .btn { padding: 10px 16px; border: none; border-radius: 6px; font-weight: 700; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s; }
  .btn-primary { background: #1e293b; color: #fff; }
  .btn-primary:hover { background: #0f172a; }
  .btn-sec { background: #fff; border: 1px solid #cbd5e1; color: #334155; }
  .btn-warn { background: #fff7ed; border: 1px solid #fed7aa; color: #c2410c; }
  .btn-danger { background: #fee2e2; color: #991b1b; margin-left: auto; }

  /* TABLE */
  .table-container { border: 1px solid var(--line); border-radius: 8px; overflow: hidden; margin-bottom: 20px; background: #fff; }
  table { width: 100%; border-collapse: collapse; min-width: 600px; }
  
  thead th { 
    background: #1e293b; color: #fff; 
    padding: 10px 15px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;
  }
  
  tbody td { border-bottom: 1px solid var(--line); padding: 0; height: 44px; }
  tbody tr:hover { background: #f8fafc; }

  /* Table Inputs */
  td input { border: none; background: transparent; height: 100%; padding: 0 15px; border-radius: 0; }
  td input:focus { background: #fffbeb; box-shadow: inset 0 0 0 2px var(--accent); }
  
  .col-points { width: 100px; background: #f8fafc; border-left: 1px solid var(--line); }
  .col-points input { text-align: center; font-weight: 800; color: #1e293b; }

  /* SIGNATURES */
  .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px; }
  .sig-box { background: #fff; border: 1px solid var(--line); border-radius: 8px; padding: 15px; }
  .sig-pad { width: 100%; height: 120px; border: 2px dashed #cbd5e1; border-radius: 6px; background: #fcfcfc; cursor: crosshair; margin-top: 5px; }
  .sig-pad:hover { border-color: var(--accent); }

  /* SETTINGS MODAL */
  .modal-backdrop { 
    display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
    background: rgba(0,0,0,0.5); z-index: 9999; align-items: center; justify-content: center; 
  }
  .modal { background: #fff; padding: 20px; border-radius: 8px; width: 400px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); border-top: 4px solid var(--accent); }
  .range-row { display: flex; gap: 5px; margin-bottom: 8px; align-items: center; }

  /* PRINT HIDDEN AREA */
  #print-area { display: none; background: white; padding: 40px; width: 800px; }
  
  /* PRINT PDF STYLES */
  .pdf-header { background: #1e293b; color: white; padding: 20px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
  .pdf-sec-title { background: #f1f5f9; padding: 5px 10px; font-weight: bold; border-left: 4px solid #FFC72C; margin: 15px 0 10px 0; font-size: 12px; text-transform: uppercase; }
  .pdf-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 10px; }
  .pdf-field { border-bottom: 1px dotted #ccc; padding-bottom: 2px; font-size: 12px; }
  .pdf-label { font-size: 10px; color: #666; text-transform: uppercase; }
  .pdf-val { font-weight: bold; }
  .pdf-table { width: 100%; border-collapse: collapse; font-size: 12px; }
  .pdf-table th { background: #FFC72C; padding: 5px; text-align: left; border: 1px solid #ddd; }
  .pdf-table td { border: 1px solid #ddd; padding: 5px; }

</style>
</head>
<body>

  <div class="header-section">
    <h1>Evaluacija Učinka</h1>
    <div style="text-align:right">
       <span style="font-size:11px; font-weight:bold; color:#64748b;">OBRAZAC</span>
       <div style="font-weight:800; font-size:16px; color:#1e293b;">EVAL-2025</div>
    </div>
  </div>

  <div class="toolbar">
    <div class="tool-card">
      <label>Godina</label>
      <select id="year">
        <option>2024</option>
        <option selected>2025</option>
        <option>2026</option>
      </select>
    </div>
    <div class="tool-card">
      <label>Zaposlenik</label>
      <input type="text" id="employeeName" placeholder="Ime i prezime...">
    </div>
    <div class="tool-card">
      <label>Evaluator</label>
      <input type="text" id="managerName" placeholder="Ime menadžera...">
    </div>
  </div>

  <div class="kpis">
    <div class="kpi-card" style="border-left-color:#FFC72C">
      <div class="kpi-label">Ukupno Bodova</div>
      <div class="kpi-val" id="totalScore">0</div>
    </div>
    <div class="kpi-card" style="border-left-color:#2563eb">
      <div class="kpi-label">Status</div>
      <div class="kpi-val" id="statusLabel" style="font-size:16px; margin-top:8px; color:#64748b;">U pripremi</div>
    </div>
  </div>

  <div class="actions">
    <button class="btn btn-primary" id="saveBtn">💾 Sačuvaj</button>
    <button class="btn btn-sec" id="pdfBtn">🖨️ PDF Izvještaj</button>
    <button class="btn btn-warn" id="settingsBtn">⚙️ Postavke Bodovanja</button>
    <button class="btn btn-danger" id="clearBtn">🗑️ Reset</button>
  </div>

  <div class="table-container">
    <table id="goalsTable">
      <thead>
        <tr>
          <th style="width: 50%">Cilj / KPI</th>
          <th style="width: 35%">Rezultat / Komentar</th>
          <th style="width: 15%; text-align: center;">Bodovi</th>
        </tr>
      </thead>
      <tbody id="goalsBody"></tbody>
    </table>
  </div>

  <div class="toolbar" style="margin-top:20px;">
    <div class="tool-card">
       <label>Komentar Zaposlenika</label>
       <textarea id="commEmp" placeholder="Unesite zapažanja..."></textarea>
    </div>
    <div class="tool-card">
       <label>Zaključak Evaluatora</label>
       <textarea id="commMan" placeholder="Plan razvoja i zaključak..."></textarea>
    </div>
  </div>

  <div class="sig-grid">
    <div class="sig-box">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <label style="font-size:10px; font-weight:700; text-transform:uppercase; color:#64748b;">Potpis Zaposlenika</label>
        <button class="btn btn-sec" style="padding:2px 6px; font-size:10px;" onclick="clearSig('sigEmp')">X</button>
      </div>
      <canvas id="sigEmp" class="sig-pad"></canvas>
    </div>
    <div class="sig-box">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <label style="font-size:10px; font-weight:700; text-transform:uppercase; color:#64748b;">Potpis Evaluatora</label>
        <button class="btn btn-sec" style="padding:2px 6px; font-size:10px;" onclick="clearSig('sigMan')">X</button>
      </div>
      <canvas id="sigMan" class="sig-pad"></canvas>
    </div>
  </div>

  <div class="modal-backdrop" id="settingsModal">
    <div class="modal">
      <h3 style="margin-top:0; color:#1e293b;">Logika Bodovanja</h3>
      <div style="margin-bottom:10px;">
         <label style="font-size:11px; font-weight:bold;">Odaberi cilj:</label>
         <select id="goalSelect" style="margin-top:5px;"></select>
      </div>
      <div style="max-height:200px; overflow-y:auto; border:1px solid #eee; padding:10px; margin-bottom:10px;" id="rangesList">
          </div>
      <button class="btn btn-sec" style="width:100%; margin-bottom:10px;" id="addRangeBtn">+ Dodaj Raspon</button>
      <div style="text-align:right; margin-top:15px; padding-top:10px; border-top:1px solid #eee;">
        <button class="btn btn-sec" id="closeSettings">Zatvori</button>
        <button class="btn btn-primary" id="saveSettings">Sačuvaj Pravila</button>
      </div>
    </div>
  </div>

  <div id="print-area"></div>

<script>
(function(){
  const $ = id => document.getElementById(id);
  const LS_KEY = "mcd_eval_data";
  const GOAL_COUNT = 10;
  let ranges = {}; // { "1": [{from, to, pts}] }

  // --- INIT UI ---
  const tbody = $("goalsBody");
  for(let i=1; i<=GOAL_COUNT; i++){
     const tr = document.createElement("tr");
     tr.innerHTML = \`
       <td><input type="text" id="t_\${i}" placeholder="Naziv cilja \${i}..." style="font-weight:600;"></td>
       <td><input type="text" id="r_\${i}" placeholder="Rezultat"></td>
       <td class="col-points"><input type="number" id="p_\${i}" value="0" min="0"></td>
     \`;
     tbody.appendChild(tr);
  }

  // --- LOGIC ---
  function calcTotal(){
      let sum = 0;
      for(let i=1; i<=GOAL_COUNT; i++){
          sum += Number($("p_"+i).value) || 0;
      }
      $("totalScore").innerText = sum;
      
      const stat = $("statusLabel");
      if(sum > 0) { stat.innerText = "U toku"; stat.style.color="#eab308"; }
      else { stat.innerText = "Prazno"; stat.style.color="#64748b"; }
  }

  function checkRange(idx){
      const resVal = $("r_"+idx).value.replace(",",".");
      const num = parseFloat(resVal);
      const pInput = $("p_"+idx);
      
      if(!isNaN(num) && resVal.trim() !== "" && ranges[idx]){
          const rList = ranges[idx];
          let found = null;
          for(let r of rList){
              if(num >= parseFloat(r.from) && num <= parseFloat(r.to)){
                  found = r.pts; break;
              }
          }
          if(found !== null) {
              pInput.value = found;
              calcTotal();
              pInput.style.backgroundColor = "#dcfce7"; // Flash green
              setTimeout(()=>pInput.style.backgroundColor = "transparent", 500);
          }
      }
  }

  // Bind Events
  for(let i=1; i<=GOAL_COUNT; i++){
      $("r_"+i).addEventListener("blur", () => checkRange(i));
      $("p_"+i).addEventListener("input", calcTotal);
  }

  // --- SIGNATURES ---
  function setupSig(id){
      const c = $(id);
      const ctx = c.getContext("2d");
      c.width = c.offsetWidth; c.height = c.offsetHeight;
      ctx.lineWidth = 2; ctx.strokeStyle = "#1e293b";
      let drawing = false;
      const getPos = (e) => {
         const r = c.getBoundingClientRect();
         return { x: (e.touches?e.touches[0].clientX:e.clientX) - r.left, y: (e.touches?e.touches[0].clientY:e.clientY) - r.top };
      }
      const start = (e) => { drawing=true; ctx.beginPath(); const p=getPos(e); ctx.moveTo(p.x, p.y); e.preventDefault(); };
      const move = (e) => { if(!drawing)return; const p=getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); e.preventDefault(); };
      const end = () => drawing=false;
      c.addEventListener("mousedown", start); c.addEventListener("mousemove", move); window.addEventListener("mouseup", end);
      c.addEventListener("touchstart", start); c.addEventListener("touchmove", move); c.addEventListener("touchend", end);
  }
  setupSig("sigEmp"); setupSig("sigMan");
  window.clearSig = (id) => { const c=$(id); c.getContext("2d").clearRect(0,0,c.width,c.height); }

  // --- SAVE / LOAD ---
  $("saveBtn").onclick = () => {
      const data = {
          meta: { year: $("year").value, emp: $("employeeName").value, man: $("managerName").value, cE: $("commEmp").value, cM: $("commMan").value },
          goals: [],
          ranges: ranges,
          sigs: { emp: $("sigEmp").toDataURL(), man: $("sigMan").toDataURL() }
      };
      for(let i=1; i<=GOAL_COUNT; i++){
          data.goals.push({ t: $("t_"+i).value, r: $("r_"+i).value, p: $("p_"+i).value });
      }
      localStorage.setItem(LS_KEY, JSON.stringify(data));
      alert("✅ Sačuvano lokalno");
  };

  function load(){
      const raw = localStorage.getItem(LS_KEY);
      if(!raw) return;
      const d = JSON.parse(raw);
      if(d.meta){
          $("year").value = d.meta.year; $("employeeName").value = d.meta.emp; $("managerName").value = d.meta.man;
          $("commEmp").value = d.meta.cE; $("commMan").value = d.meta.cM;
      }
      if(d.goals) d.goals.forEach((g, i) => {
          const idx = i+1;
          if($("t_"+idx)) { $("t_"+idx).value = g.t; $("r_"+idx).value = g.r; $("p_"+idx).value = g.p; }
      });
      ranges = d.ranges || {};
      if(d.sigs){
          const i1 = new Image(); i1.onload = () => $("sigEmp").getContext("2d").drawImage(i1,0,0); i1.src = d.sigs.emp;
          const i2 = new Image(); i2.onload = () => $("sigMan").getContext("2d").drawImage(i2,0,0); i2.src = d.sigs.man;
      }
      calcTotal();
  }
  $("clearBtn").onclick = () => { if(confirm("Obriši?")) { localStorage.removeItem(LS_KEY); location.reload(); } };

  // --- SETTINGS MODAL ---
  $("settingsBtn").onclick = () => {
      $("settingsModal").style.display = "flex";
      const sel = $("goalSelect"); sel.innerHTML = "";
      for(let i=1; i<=GOAL_COUNT; i++){
          const opt = document.createElement("option"); opt.value = i; opt.text = i + ". " + ($("t_"+i).value.substring(0,20) || "Cilj "+i);
          sel.appendChild(opt);
      }
      sel.onchange = renderRanges;
      renderRanges();
  };
  $("closeSettings").onclick = () => $("settingsModal").style.display = "none";
  
  function renderRanges(){
      const gid = $("goalSelect").value;
      const list = ranges[gid] || [];
      const con = $("rangesList"); con.innerHTML = "";
      if(list.length === 0) list.push({from:"", to:"", pts:""});
      
      list.forEach(r => {
          const div = document.createElement("div"); div.className = "range-row";
          div.innerHTML = \`
            <input type="number" class="r-f" placeholder="Od" value="\${r.from}" style="width:60px">
            <input type="number" class="r-t" placeholder="Do" value="\${r.to}" style="width:60px">
            <input type="number" class="r-p" placeholder="Bod" value="\${r.pts}" style="width:50px; font-weight:bold">
            <button class="btn btn-danger" style="padding:2px 8px; margin-left:auto" onclick="this.parentElement.remove()">x</button>
          \`;
          con.appendChild(div);
      });
  }
  $("addRangeBtn").onclick = () => {
      const div = document.createElement("div"); div.className = "range-row";
      div.innerHTML = \`<input type="number" class="r-f" placeholder="Od" style="width:60px"><input type="number" class="r-t" placeholder="Do" style="width:60px"><input type="number" class="r-p" placeholder="Bod" style="width:50px; font-weight:bold"><button class="btn btn-danger" style="padding:2px 8px; margin-left:auto" onclick="this.parentElement.remove()">x</button>\`;
      $("rangesList").appendChild(div);
  };
  $("saveSettings").onclick = () => {
      const gid = $("goalSelect").value;
      const rows = $("rangesList").querySelectorAll(".range-row");
      const arr = [];
      rows.forEach(r => {
          const f = r.querySelector(".r-f").value; const t = r.querySelector(".r-t").value; const p = r.querySelector(".r-p").value;
          if(f!=="" && t!=="" && p!=="") arr.push({from:f, to:t, pts:p});
      });
      ranges[gid] = arr;
      checkRange(gid);
      $("settingsModal").style.display = "none";
  };

  // --- PDF ---
  $("pdfBtn").onclick = async () => {
      if(typeof window.jspdf === 'undefined') return alert("Sačekajte...");
      const btn = $("pdfBtn"); btn.innerText = "Generisanje...";
      const p = $("print-area");
      
      let rowsHTML = "";
      for(let i=1; i<=GOAL_COUNT; i++){
          const t = $("t_"+i).value; const r = $("r_"+i).value; const pts = $("p_"+i).value;
          if(t.trim() || r.trim() || pts != "0") {
              rowsHTML += \`<tr><td style="font-weight:bold">\${t}</td><td>\${r}</td><td style="text-align:center; font-weight:bold">\${pts}</td></tr>\`;
          }
      }

      p.innerHTML = \`
        <div class="pdf-header">
           <div><h1 style="margin:0; font-size:24px;">McDonald's</h1><p style="margin:0; font-size:10px;">INTERNA EVALUACIJA</p></div>
           <div style="text-align:right; font-size:10px;">\${new Date().toLocaleDateString()}</div>
        </div>
        <div class="pdf-sec-title">OSNOVNI PODACI</div>
        <div class="pdf-grid">
            <div class="pdf-field"><span class="pdf-label">Zaposlenik:</span> <span class="pdf-val">\${$("employeeName").value}</span></div>
            <div class="pdf-field"><span class="pdf-label">Evaluator:</span> <span class="pdf-val">\${$("managerName").value}</span></div>
        </div>
        <div class="pdf-sec-title">CILJEVI I REZULTATI</div>
        <table class="pdf-table">
            <thead><tr><th width="50%">Cilj</th><th width="35%">Rezultat</th><th width="15%">Bodovi</th></tr></thead>
            <tbody>\${rowsHTML}</tbody>
            <tfoot><tr><td colspan="2" style="text-align:right; font-weight:bold; padding:8px;">UKUPNO:</td><td style="text-align:center; font-weight:bold; background:#eee;">\${$("totalScore").innerText}</td></tr></tfoot>
        </table>
        <div class="pdf-sec-title">ZAPAŽANJA</div>
        <div class="pdf-field"><span class="pdf-label">Zaposlenik:</span><div style="margin-top:4px">\${$("commEmp").value}</div></div>
        <div class="pdf-field" style="margin-top:10px;"><span class="pdf-label">Evaluator:</span><div style="margin-top:4px">\${$("commMan").value}</div></div>
        
        <div class="pdf-grid" style="margin-top:40px; align-items:end;">
            <div><span class="pdf-label">Potpis Zaposlenika</span><br><img src="\${$("sigEmp").toDataURL()}" style="height:60px; border-bottom:1px solid #000;"></div>
            <div><span class="pdf-label">Potpis Evaluatora</span><br><img src="\${$("sigMan").toDataURL()}" style="height:60px; border-bottom:1px solid #000;"></div>
        </div>
      \`;
      p.style.display = "block";

      try {
          const canvas = await html2canvas(p, {scale: 2});
          const img = canvas.toDataURL("image/jpeg", 0.9);
          const { jsPDF } = window.jspdf;
          const doc = new jsPDF();
          const w = 210; const h = (canvas.height * w) / canvas.width;
          doc.addImage(img, 'JPEG', 0, 0, w, h);
          doc.save(\`Evaluacija_\${$("employeeName").value}.pdf\`);
      } catch(e){ alert(e); }
      finally { p.style.display = "none"; btn.innerText = "🖨️ PDF Izvještaj"; }
  };

  load();

})();
</script>
</body>
</html>
`;