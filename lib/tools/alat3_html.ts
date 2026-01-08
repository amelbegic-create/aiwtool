export const ALAT_3_FULL_HTML = `
<!DOCTYPE html>
<html lang="bs">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Plan Produktivnosti Enterprise</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;800&display=swap" rel="stylesheet">

<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js"></script>

<style>
  :root{
    --bg:#ffffff; --txt:#1e293b; --muted:#64748b;
    --accent:#FFC72C; --danger:#ef4444; --success:#10b981; --warning:#f59e0b;
    --line:#e2e8f0; --header-bg:#1e293b;
  }
  *{box-sizing:border-box}
  body{margin:0; background:var(--bg); color:var(--txt); font:13px/1.4 'Inter', sans-serif; padding: 20px; overflow-x: hidden;}

  /* HEADER */
  .header-section { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; border-bottom: 1px solid var(--line); padding-bottom: 15px; }
  h1 { font-size: 24px; margin: 0; font-weight: 800; letter-spacing: -0.5px; color: #1e293b; }

  /* TOOLBAR GRID */
  .toolbar { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px; margin-bottom: 25px; }
  .tool-card { background: #f8fafc; border: 1px solid var(--line); border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 6px; }
  .tool-card label { font-size: 10px; font-weight: 700; color: var(--muted); text-transform: uppercase; }
  .tool-card select, .tool-card input { padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; width: 100%; font-weight: 600; background: #fff; color: #333; }

  /* ACTIONS */
  .actions { display: flex; gap: 10px; margin-bottom: 20px; }
  .btn { padding: 10px 16px; border: none; border-radius: 6px; font-weight: 700; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s; }
  .btn-primary { background: #1e293b; color: #fff; }
  .btn-primary:hover { background: #0f172a; }
  .btn-sec { background: #fff; border: 1px solid #cbd5e1; color: #334155; }
  .btn-danger { background: #fee2e2; color: #991b1b; margin-left: auto; }

  /* KPI CARDS */
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 25px; }
  .kpi-card { background: #fff; padding: 15px; border-radius: 10px; border: 1px solid var(--line); border-left-width: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
  .kpi-val { font-size: 20px; font-weight: 800; margin-top: 4px; color: #1e293b; }
  .kpi-label { font-size: 10px; font-weight: 700; color: var(--muted); text-transform: uppercase; }

  /* TABLE */
  .table-container { border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
  .table-scroll { overflow-x: auto; max-height: 600px; }
  table { width: 100%; border-collapse: collapse; min-width: 900px; }
  
  thead th { 
    position: sticky; top: 0; z-index: 20; 
    background: #1e293b; color: #fff; 
    padding: 10px; text-align: center; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;
  }
  thead th:first-child { left: 0; z-index: 21; }
  
  tbody td { border-bottom: 1px solid var(--line); padding: 0; height: 36px; }
  tbody tr:hover { background: #f1f5f9; }

  /* INPUTS IN TABLE */
  input.cell-inp { 
    width: 100%; height: 36px; border: none; background: transparent; 
    text-align: center; font-weight: 600; font-size: 13px; outline: none; color: #333;
  }
  input.cell-inp:focus { background: #fffbeb; box-shadow: inset 0 0 0 2px var(--accent); }
  
  .bg-rev { background: #fff7ed; }
  .bg-calc { background: #f8fafc; font-weight: 700; color: #334155; pointer-events: none; display: flex; align-items: center; justify-content: center; height: 100%; }

  /* FOOTER */
  tfoot td { 
    position: sticky; bottom: 0; z-index: 10;
    background: #1e293b; color: #fff; font-weight: 800; padding: 10px; text-align: center; 
  }
  tfoot td:first-child { position: sticky; left: 0; z-index: 20; }

  /* HEATMAP */
  .prod-low { background: #fecaca; color: #7f1d1d; }
  .prod-ok { background: #bbf7d0; color: #14532d; }
  .prod-high { background: #fed7aa; color: #7c2d12; }

  /* HIDDEN CHART WRAPPER */
  #chart-wrapper { position: absolute; left: -9999px; top: 0; width: 1000px; height: 500px; overflow:hidden; }

  /* MODAL */
  .modal-backdrop { 
    display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
    background: rgba(0,0,0,0.5); z-index: 9999; align-items: center; justify-content: center; 
  }
  .modal { background: #fff; padding: 20px; border-radius: 8px; width: 320px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); border-top: 4px solid var(--accent); }

  @media print {
     .toolbar, .actions, .kpis, #hoursModal { display: none; }
     body { padding: 0; }
     .table-scroll { max-height: none; overflow: visible; }
  }
</style>
</head>
<body>

  <div class="header-section">
    <h1>Plan Produktivnosti</h1>
    <div style="text-align:right">
       <span style="font-size:11px; font-weight:bold; color:#64748b;">RESTORAN</span>
       <div id="restLabel" style="font-weight:800; font-size:16px; color:#1e293b;">Restoran 1</div>
    </div>
  </div>

  <div class="toolbar">
    <div class="tool-card">
      <label>Restoran</label>
      <select id="restSel">
        <option value="1">Restoran 1</option>
        <option value="2">Restoran 2</option>
        <option value="3">Restoran 3</option>
        <option value="4">Restoran 4</option>
        <option value="5">Restoran 5</option>
      </select>
    </div>
    <div class="tool-card">
      <label>Dan</label>
      <select id="daySel">
        <option value="mo">Ponedjeljak</option>
        <option value="di">Utorak</option>
        <option value="mi">Srijeda</option>
        <option value="do">Četvrtak</option>
        <option value="fr">Petak</option>
        <option value="sa">Subota</option>
        <option value="so">Nedjelja</option>
      </select>
    </div>
    <div class="tool-card">
      <label>Cilj (KM/h)</label>
      <input type="number" id="targetProd" value="120">
    </div>
    <div class="tool-card" style="background:#1e293b; border-color:#1e293b;">
      <label style="color:#94a3b8">Radno Vrijeme</label>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
        <span id="openHours" style="color:#fff; font-weight:800;">07:00 - 23:00</span>
        <button id="editHours" style="font-size:10px; padding:3px 8px; cursor:pointer; border:none; background:#334155; color:#fff; border-radius:4px;">IZMJENI</button>
      </div>
    </div>
  </div>

  <div class="kpis">
    <div class="kpi-card" style="border-left-color:#2563eb">
      <div class="kpi-label">Promet</div>
      <div class="kpi-val" id="sumRevenue">0 KM</div>
    </div>
    <div class="kpi-card" style="border-left-color:#f59e0b">
      <div class="kpi-label">Sati</div>
      <div class="kpi-val" id="sumHours">0.0</div>
    </div>
    <div class="kpi-card" style="border-left-color:#10b981">
      <div class="kpi-label">Produktivnost</div>
      <div class="kpi-val" id="avgProd">0 KM</div>
    </div>
    <div class="kpi-card" style="border-left-color:#64748b">
      <div class="kpi-label">Status</div>
      <div class="kpi-val" id="statusLabel" style="font-size:14px; margin-top:5px; color:#64748b;">Čeka unos</div>
    </div>
  </div>

  <div class="actions">
    <button class="btn btn-primary" id="saveData">💾 Sačuvaj</button>
    <button class="btn btn-sec" id="exportPdf">🖨️ PDF Izvještaj</button>
    <button class="btn btn-danger" id="clearData">🗑️ Obriši</button>
  </div>

  <div class="table-container">
    <div class="table-scroll">
      <table id="mainTable">
        <thead>
          <tr>
            <th style="width:80px;">Sat</th>
            <th style="width:100px; background:#f59e0b; color:#000;">Promet</th>
            <th>Kuhinja</th>
            <th>Lobby</th>
            <th>McCafé</th>
            <th>Drive</th>
            <th>Kasa</th>
            <th>Pomfrit</th>
            <th>Ostalo</th>
            <th style="width:80px;">Σ Sati</th>
            <th style="width:80px;">Prod.</th>
          </tr>
        </thead>
        <tbody id="tableBody">
           <tr><td colspan="11" style="text-align:center; padding:20px;">Učitavanje...</td></tr>
        </tbody>
        <tfoot>
           <tr>
             <td>TOTAL</td>
             <td id="footRev">0</td>
             <td id="footKitch">0</td>
             <td id="footLobby">0</td>
             <td id="footCafe">0</td>
             <td id="footDrive">0</td>
             <td id="footFront">0</td>
             <td id="footFries">0</td>
             <td id="footOther">0</td>
             <td id="footTotalHours">0</td>
             <td id="footAvgProd">0</td>
           </tr>
        </tfoot>
      </table>
    </div>
  </div>

  <div id="chart-wrapper">
    <canvas id="salesChart"></canvas>
  </div>

  <div class="modal-backdrop" id="hoursModal">
    <div class="modal">
      <h3 style="margin-top:0; color:#1e293b;">⏰ Radno Vrijeme</h3>
      <div id="hoursTableContainer" style="max-height:300px; overflow-y:auto; margin:10px 0;"></div>
      <div style="text-align:right; margin-top:10px;">
        <button class="btn btn-sec" id="closeHours">Zatvori</button>
        <button class="btn btn-primary" id="saveHoursBtn">Sačuvaj</button>
      </div>
    </div>
  </div>

<script>
(function() {
  // --- SAFE STORAGE ---
  const MemoryStore = {};
  const Storage = {
    get: (k) => { try { return localStorage.getItem(k); } catch(e){ return MemoryStore[k] || null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch(e){ MemoryStore[k] = v; } },
    remove: (k) => { try { localStorage.removeItem(k); } catch(e){ delete MemoryStore[k]; } }
  };

  // --- CONFIG ---
  const STATIONS = [
    {key:"kitch", label:"Kuhinja"}, {key:"lobby", label:"Lobby"}, {key:"cafe", label:"McCafé"},
    {key:"drive", label:"Drive"}, {key:"front", label:"Kasa"}, {key:"fries", label:"Pomfrit"},
    {key:"other", label:"Ostalo"}
  ];
  const DAYS = ["mo","di","mi","do","fr","sa","so"];
  const DAY_NAMES = {mo:"Ponedjeljak", di:"Utorak", mi:"Srijeda", do:"Četvrtak", fr:"Petak", sa:"Subota", so:"Nedjelja"};
  const DEFAULT_HOURS = {from: 7, to: 23};
  
  let currentRest = "1";
  let currentDay = "mo";
  let targetProd = 120;

  // --- DOM ---
  const els = {
    tbody: document.getElementById('tableBody'),
    restSel: document.getElementById('restSel'),
    daySel: document.getElementById('daySel'),
    targetInp: document.getElementById('targetProd'),
    hoursModal: document.getElementById('hoursModal'),
    restLabel: document.getElementById('restLabel'),
    saveBtn: document.getElementById('saveData'),
    clearBtn: document.getElementById('clearData'),
    printBtn: document.getElementById('exportPdf'),
    hoursBtn: document.getElementById('editHours')
  };

  // --- HELPERS ---
  const pad = n => String(n).padStart(2,'0');
  const fmtKM = n => n.toLocaleString('bs-BA', {minimumFractionDigits:2, maximumFractionDigits:2}) + " KM";
  const getKey = () => \`mcd_pro_\${currentRest}_\${currentDay}\`;
  const getHoursKey = () => \`mcd_hours_\${currentRest}\`;

  // --- CORE LOGIC ---
  function getHoursConfig(){
    const raw = Storage.get(getHoursKey());
    const cfg = raw ? JSON.parse(raw) : {};
    return cfg[currentDay] || DEFAULT_HOURS;
  }

  function buildHoursArray(from, to){
    const arr = [];
    let h = from;
    let safety = 0;
    while(h !== to && safety < 24){
        arr.push(h);
        h = (h + 1) % 24;
        safety++;
    }
    return arr;
  }

  function renderTable(){
    if(!els.tbody) return;
    els.tbody.innerHTML = "";

    const {from, to} = getHoursConfig();
    document.getElementById('openHours').innerText = \`\${pad(from)}:00 - \${pad(to)}:00\`;
    
    const hours = buildHoursArray(from, to);
    const rawData = Storage.get(getKey());
    const data = rawData ? JSON.parse(rawData) : {};

    if(hours.length === 0) {
       els.tbody.innerHTML = "<tr><td colspan='11' style='text-align:center; padding:20px;'>Greška u konfiguraciji sati.</td></tr>";
       return;
    }

    let html = "";
    hours.forEach(h => {
      const row = data[h] || {};
      html += \`<tr data-h="\${h}">
        <td style="text-align:center; background:#f8fafc; font-weight:bold; color:#475569;">\${pad(h)}:00</td>
        <td class="bg-rev"><input type="number" class="cell-inp inp-rev" value="\${row.rev||''}" placeholder="0"></td>\`;
      
      STATIONS.forEach(s => {
        html += \`<td><input type="number" class="cell-inp inp-st" data-key="\${s.key}" value="\${row[s.key]||''}" placeholder="-"></td>\`;
      });

      html += \`<td class="bg-calc cell-sum">0</td>
               <td class="bg-calc cell-prod">0</td>
               </tr>\`;
    });
    
    els.tbody.innerHTML = html;
    
    // Re-bind events manually to ensure they attach
    const inputs = els.tbody.querySelectorAll('input');
    for(let i=0; i<inputs.length; i++){
        inputs[i].oninput = recalc;
        inputs[i].onfocus = function() { this.select(); };
    }

    recalc();
  }

  function recalc(){
    let totRev=0, totHours=0;
    const colTotals = {};
    STATIONS.forEach(s => colTotals[s.key] = 0);

    const rows = els.tbody.querySelectorAll('tr');
    rows.forEach(tr => {
      const revVal = tr.querySelector('.inp-rev').value;
      const rev = parseFloat(revVal) || 0;
      let rowH = 0;
      
      STATIONS.forEach(s => {
        const val = parseFloat(tr.querySelector(\`input[data-key="\${s.key}"]\`).value) || 0;
        rowH += val;
        colTotals[s.key] += val;
      });

      const prod = rowH > 0 ? rev / rowH : 0;

      tr.querySelector('.cell-sum').innerText = rowH > 0 ? rowH.toFixed(1) : "-";
      const pCell = tr.querySelector('.cell-prod');
      pCell.innerText = prod > 0 ? Math.round(prod) : "-";

      pCell.className = "bg-calc cell-prod";
      if(prod > 0) {
        const ratio = prod / targetProd;
        if(ratio < 0.75) pCell.classList.add('prod-low');
        else if(ratio > 1.25) pCell.classList.add('prod-high');
        else pCell.classList.add('prod-ok');
      }
      totRev += rev;
      totHours += rowH;
    });

    document.getElementById('footRev').innerText = fmtKM(totRev);
    document.getElementById('sumRevenue').innerText = fmtKM(totRev);
    document.getElementById('footTotalHours').innerText = totHours.toFixed(1);
    document.getElementById('sumHours').innerText = totHours.toFixed(1);
    
    STATIONS.forEach(s => {
       const el = document.getElementById(\`foot\${s.key.charAt(0).toUpperCase() + s.key.slice(1)}\`);
       if(el) el.innerText = colTotals[s.key].toFixed(1);
    });

    const avg = totHours > 0 ? totRev / totHours : 0;
    document.getElementById('footAvgProd').innerText = fmtKM(avg);
    document.getElementById('avgProd').innerText = fmtKM(avg);

    const stat = document.getElementById('statusLabel');
    if(totRev === 0) { stat.innerText = "Čeka unos..."; stat.style.color="#64748b"; }
    else if(avg >= targetProd) { stat.innerText = "✅ Dobar plan"; stat.style.color="#10b981"; }
    else { stat.innerText = "⚠️ Ispod cilja"; stat.style.color="#f59e0b"; }
  }

  function saveData() {
    const data = {};
    els.tbody.querySelectorAll('tr').forEach(tr => {
      const h = tr.dataset.h;
      const row = { rev: tr.querySelector('.inp-rev').value };
      STATIONS.forEach(s => row[s.key] = tr.querySelector(\`input[data-key="\${s.key}"]\`).value);
      data[h] = row;
    });
    Storage.set(getKey(), JSON.stringify(data));
    alert("✅ Podaci sačuvani.");
  }

  function clearData(){
    if(confirm("Da li ste sigurni?")){
        Storage.remove(getKey());
        renderTable();
    }
  }

  // --- HIGH RES CHART & PDF ---
  async function generateHighResChart(data) {
    return new Promise((resolve) => {
        const ctx = document.getElementById('salesChart').getContext('2d');
        if(window.myPDFChart) window.myPDFChart.destroy();
        
        window.myPDFChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.labels,
                datasets: [
                    { label: 'Promet (KM)', data: data.revenue, backgroundColor: '#FFC72C', borderRadius: 6, order: 2, yAxisID: 'y' },
                    { label: 'Sati', data: data.hours, type: 'line', borderColor: '#1E293B', borderWidth: 4, pointRadius: 0, tension: 0.4, fill: false, order: 1, yAxisID: 'y1' }
                ]
            },
            options: {
                animation: false, responsive: false, devicePixelRatio: 2,
                plugins: { legend: { labels: { font: { size: 24, weight: 'bold' } } }, title: { display: true, text: 'Distribucija', font: { size: 30 }, padding: 20 } },
                scales: {
                    x: { ticks: { font: { size: 18 } } },
                    y: { position: 'left', ticks: { font: { size: 18 } }, title: { display: true, text: 'Promet', font: { size: 20, weight: 'bold' } } },
                    y1: { position: 'right', ticks: { font: { size: 18 } }, grid: { display: false }, title: { display: true, text: 'Sati', font: { size: 20, weight: 'bold' } } }
                },
                plugins: {
                    legend: { position: 'top' }
                }
            },
            plugins: [{
                id: 'whiteBg',
                beforeDraw: (chart) => {
                    const ctx = chart.canvas.getContext('2d');
                    ctx.save(); ctx.fillStyle = 'white'; ctx.fillRect(0, 0, chart.width, chart.height); ctx.restore();
                }
            }]
        });
        setTimeout(() => { resolve(document.getElementById('salesChart').toDataURL('image/jpeg', 0.9)); }, 800);
    });
  }

  async function exportPDF() {
    if(typeof window.jspdf === 'undefined') { alert("Biblioteke se učitavaju..."); return; }
    const btn = els.printBtn;
    const originalText = btn.innerText;
    btn.innerText = "Generisanje...";

    try {
      const labels = [], revData = [], hoursData = [];
      els.tbody.querySelectorAll('tr').forEach(tr => {
          labels.push(tr.cells[0].innerText);
          revData.push(parseFloat(tr.querySelector('.inp-rev').value) || 0);
          hoursData.push(parseFloat(tr.querySelector('.cell-sum').innerText) || 0);
      });

      const chartImg = await generateHighResChart({ labels, revenue: revData, hours: hoursData });
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({orientation: 'landscape'});
      
      doc.setFillColor(30, 41, 59); doc.rect(0, 0, 297, 30, 'F');
      doc.setFillColor(255, 199, 44); doc.roundedRect(14, 5, 20, 20, 4, 4, 'F');
      doc.setTextColor(30, 41, 59); doc.setFontSize(14); doc.setFont(undefined, 'bold'); doc.text("M", 24, 18, {align: 'center'});
      
      doc.setTextColor(255, 255, 255); doc.setFontSize(18); doc.text("PLAN PRODUKTIVNOSTI", 42, 15);
      doc.setFontSize(10); doc.setFont(undefined, 'normal');
      const rName = els.restSel.options[els.restSel.selectedIndex].text;
      const dName = DAY_NAMES[currentDay];
      doc.text(\`Restoran: \${rName}   |   Dan: \${dName}   |   Cilj: \${targetProd} KM/h\`, 42, 22);

      doc.setTextColor(0,0,0);
      const drawKpi = (x, label, value) => {
          doc.setDrawColor(200); doc.setFillColor(248, 250, 252); doc.roundedRect(x, 40, 60, 18, 2, 2, 'FD');
          doc.setFontSize(8); doc.setTextColor(100); doc.text(label, x + 5, 46);
          doc.setFontSize(12); doc.setTextColor(30, 41, 59); doc.setFont(undefined, 'bold'); doc.text(value, x + 5, 55);
      };
      drawKpi(14, "PROMET", document.getElementById('sumRevenue').innerText);
      drawKpi(80, "SATI", document.getElementById('sumHours').innerText);
      drawKpi(146, "PRODUKTIVNOST", document.getElementById('avgProd').innerText);

      doc.addImage(chartImg, 'JPEG', 14, 65, 270, 80);

      const bodyRows = [];
      els.tbody.querySelectorAll('tr').forEach(tr => {
          const row = [
              tr.cells[0].innerText,
              (parseFloat(tr.querySelector('.inp-rev').value)||0).toFixed(2),
              ...STATIONS.map(s => (parseFloat(tr.querySelector(\`input[data-key="\${s.key}"]\`).value)||0)),
              tr.querySelector('.cell-sum').innerText,
              tr.querySelector('.cell-prod').innerText
          ];
          bodyRows.push(row);
      });
      
      const footRow = [
         "TOTAL", 
         document.getElementById('footRev').innerText.replace(' KM',''),
         ...STATIONS.map(s => document.getElementById(\`foot\${s.key.charAt(0).toUpperCase() + s.key.slice(1)}\`).innerText),
         document.getElementById('footTotalHours').innerText,
         document.getElementById('avgProd').innerText.replace(' KM','')
      ];
      bodyRows.push(footRow);

      doc.autoTable({
        head: [['Sat', 'Promet', ...STATIONS.map(s=>s.label), 'Sati', 'Prod.']],
        body: bodyRows,
        startY: 150,
        theme: 'grid',
        headStyles: { fillColor: [30, 41, 59], textColor: [255,255,255], fontStyle: 'bold' },
        styles: { fontSize: 8, halign: 'center', cellPadding: 1.5, lineColor: [200, 200, 200] },
        columnStyles: { 0: { fontStyle: 'bold', fillColor: [241, 245, 249] }, 1: { fontStyle: 'bold', halign: 'right' } },
        didParseCell: function(data) {
            if (data.row.index === bodyRows.length - 1) {
                data.cell.styles.fontStyle = 'bold'; data.cell.styles.fillColor = [255, 199, 44]; data.cell.styles.textColor = [30, 41, 59];
            }
        }
      });

      const fy = doc.lastAutoTable.finalY + 20;
      if(fy < 190) {
          doc.setDrawColor(100);
          doc.line(14, fy, 80, fy); doc.setFontSize(8); doc.text("Menadžer", 14, fy + 4);
          doc.line(200, fy, 270, fy); doc.text("Odobrio", 200, fy + 4);
      }

      doc.save('Izvjestaj_Produktivnosti.pdf');

    } catch(err) { alert("Greška: " + err.message); } finally { btn.innerText = originalText; }
  }

  // --- HANDLERS ---
  els.restSel.onchange = (e) => { currentRest=e.target.value; document.getElementById('restLabel').innerText = e.target.options[e.target.selectedIndex].text; renderTable(); };
  els.daySel.onchange = (e) => { currentDay=e.target.value; renderTable(); };
  els.targetInp.onchange = (e) => { targetProd=parseFloat(e.target.value)||120; recalc(); };
  els.saveBtn.onclick = saveData;
  els.clearBtn.onclick = clearData;
  els.printBtn.onclick = exportPDF;

  // Hours Modal Handlers
  els.hoursBtn.onclick = () => {
    els.hoursModal.style.display = 'flex';
    let hrs = {};
    try { hrs = JSON.parse(Storage.get(getHoursKey())) || {}; } catch(e){}
    let h = '<table style="width:100%">';
    DAYS.forEach(d => {
      const v = hrs[d] || DEFAULT_HOURS;
      h += \`<tr><td style="font-weight:bold;text-transform:uppercase">\${d}</td><td><input type="number" id="f_\${d}" value="\${v.from}"></td><td><input type="number" id="t_\${d}" value="\${v.to}"></td></tr>\`;
    });
    document.getElementById('hoursTableContainer').innerHTML = h + '</table>';
  };
  
  document.getElementById('closeHours').onclick = () => els.hoursModal.style.display = 'none';
  document.getElementById('saveHoursBtn').onclick = () => {
    const n = {};
    DAYS.forEach(d => {
       n[d] = { from: parseInt(document.getElementById(\`f_\${d}\`).value), to: parseInt(document.getElementById(\`t_\${d}\`).value) };
    });
    Storage.set(getHoursKey(), JSON.stringify(n));
    els.hoursModal.style.display = 'none';
    renderTable();
  };

  // INITIAL RENDER
  setTimeout(renderTable, 100);

})();
</script>
</body>
</html>
`;