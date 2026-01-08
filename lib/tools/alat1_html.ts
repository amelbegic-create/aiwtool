export const ALAT_1_FULL_HTML = `
<!DOCTYPE html>
<html lang="bs">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Crew Labor Mjesečni Plan</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;800&display=swap" rel="stylesheet">

<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js"></script>

<style>
  :root{
    --bg:#f8fafc; --panel:#ffffff; --line:#e2e8f0; --txt:#0f172a; --muted:#64748b;
    --accent:#3b82f6; /* Finance Blue */
    --danger:#ef4444; --success:#10b981; --warning:#f59e0b;
    --header-bg:#1e293b;
  }
  *{box-sizing:border-box}
  body{margin:0; background:var(--bg); color:var(--txt); font:13px/1.4 'Inter', sans-serif; padding: 24px; overflow-x: hidden;}

  /* HEADER */
  .header-section { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; border-bottom: 1px solid var(--line); padding-bottom: 16px; }
  h1 { font-size: 24px; margin: 0; font-weight: 800; letter-spacing: -0.5px; color: #1e293b; }

  /* TOOLBAR / CARDS */
  .dashboard { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin-bottom: 24px; }
  
  .card { 
    background: #fff; padding: 20px; border-radius: 12px; 
    border: 1px solid var(--line); box-shadow: 0 2px 8px rgba(0,0,0,0.04); 
    display: flex; flex-direction: column; gap: 12px;
  }
  .card h3 { 
    margin: 0 0 4px 0; font-size: 11px; font-weight: 700; 
    text-transform: uppercase; color: var(--muted); letter-spacing: 0.5px; 
    display: flex; align-items: center; gap: 6px; border-bottom: 1px solid var(--line); padding-bottom: 8px;
  }

  .card-row { display: flex; justify-content: space-between; align-items: center; }
  .card-row label { font-size: 13px; font-weight: 500; color: #334155; }
  
  .card-input { 
    width: 100px; padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 6px; 
    text-align: right; font-weight: 600; font-size: 14px; color: #1e293b; background: #f8fafc; transition: all 0.2s;
  }
  .card-input:focus { border-color: var(--accent); background: #fff; outline: none; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }

  /* KPI BIG NUMBERS */
  .result-box { background: #f0f9ff; border: 1px solid #bae6fd; }
  .big-val { font-size: 20px; font-weight: 800; color: #0369a1; }
  .big-label { font-size: 11px; color: #0c4a6e; font-weight: 600; }
  
  /* TABLE CONTAINER */
  .table-container { 
    border: 1px solid var(--line); border-radius: 12px; overflow: hidden; 
    background: #fff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); 
  }
  .table-scroll { overflow-x: auto; max-height: calc(100vh - 400px); }
  
  table { width: 100%; border-collapse: separate; border-spacing: 0; min-width: 1100px; }
  
  thead th { 
    position: sticky; top: 0; z-index: 20; 
    background: #1e293b; color: #fff; 
    padding: 12px 8px; text-align: right; font-size: 11px; font-weight: 600; text-transform: uppercase; 
    border-bottom: 1px solid #334155;
  }
  thead th:first-child { text-align: center; width: 40px; left: 0; z-index: 21; }
  thead th:nth-child(2) { text-align: left; width: 120px; left: 40px; z-index: 21; }
  
  tbody td { border-bottom: 1px solid var(--line); padding: 0; height: 38px; vertical-align: middle; }
  tbody tr:hover { background: #f1f5f9; }
  tbody tr.weekend td { background: #fffbeb; } /* Light yellow for weekend */

  /* TABLE INPUTS */
  td input { 
    width: 100%; height: 38px; border: none; background: transparent; 
    text-align: right; font-weight: 500; font-size: 13px; outline: none; padding: 0 8px; color: #333; 
  }
  td input:focus { background: #fff; box-shadow: inset 0 0 0 2px var(--accent); font-weight: 700; }
  
  .col-calc input { background: #f1f5f9; color: #64748b; pointer-events: none; font-weight: 700; }
  .col-day { padding-left: 12px; font-weight: 600; color: #334155; display: flex; align-items: center; height: 38px; }

  /* FOOTER */
  tfoot td { 
    position: sticky; bottom: 0; z-index: 20;
    background: #f1f5f9; color: #1e293b; font-weight: 800; padding: 12px 8px; 
    text-align: right; font-size: 13px; border-top: 2px solid #cbd5e1;
  }
  tfoot td:first-child { left: 0; z-index: 22; text-align: center; background: #f1f5f9; }
  tfoot td:nth-child(2) { left: 40px; z-index: 22; text-align: left; background: #f1f5f9; }

  /* BUTTONS */
  .actions { display: flex; gap: 10px; }
  .btn { padding: 10px 16px; border: none; border-radius: 6px; font-weight: 700; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s; }
  .btn-primary { background: #1e293b; color: #fff; } .btn-primary:hover { background: #0f172a; }
  .btn-danger { background: #fee2e2; color: #b91c1c; } .btn-danger:hover { background: #fecaca; }

  @media print {
    .actions, .dashboard { display: none; }
    body { background: #fff; padding: 0; }
    .table-container { box-shadow: none; border: 1px solid #000; }
    .table-scroll { overflow: visible; max-height: none; }
    thead th { background: #eee; color: #000; border-bottom: 1px solid #000; }
  }
</style>
</head>
<body>

  <div class="header-section">
    <h1>Crew Labor Mjesečni Plan</h1>
    <div class="actions">
        <button class="btn btn-danger" onclick="clearTable()">🗑️ Obriši</button>
        <button class="btn btn-primary" id="exportBtn" onclick="exportPDF()">🖨️ PDF Izvještaj</button>
    </div>
  </div>

  <div class="dashboard">
      <div class="card" style="border-left-color: #64748b;">
          <h3>⚙️ Postavke</h3>
          <div class="card-row">
              <label>Satnica (€):</label>
              <input type="number" id="hourlyWage" class="card-input" value="11.80" oninput="calculateAll()">
          </div>
          <div class="card-row">
              <label>Godišnji (h):</label>
              <input type="number" id="vacationHours" class="card-input" value="0" oninput="calculateAll()">
          </div>
          <div class="card-row">
              <label>Bolovanje (h):</label>
              <input type="number" id="sickHours" class="card-input" value="0" oninput="calculateAll()">
          </div>
      </div>

      <div class="card" style="border-left-color: #3b82f6;">
          <h3>🎯 Budžet</h3>
          <div class="card-row">
              <label>Plan Promet (€):</label>
              <input type="number" id="budgetSales" class="card-input" value="" placeholder="0" oninput="calculateAll()">
          </div>
          <div class="card-row">
              <label>Plan CL Trošak (€):</label>
              <input type="number" id="budgetCL" class="card-input" value="" placeholder="0" oninput="calculateAll()">
          </div>
          <div style="text-align: right; margin-top: 5px; font-size: 11px; color: #64748b;">
              Limit CL%: <strong id="budgetPercent" style="color:#1e293b;">0.00%</strong>
          </div>
      </div>

      <div class="card result-box" style="border: 1px solid #bbf7d0; background: #f0fdf4; border-left: 4px solid #10b981;">
          <h3 style="color: #166534; border-color: #bbf7d0;">📈 Rezultat Mjeseca</h3>
          <div style="display:flex; justify-content:space-between; margin-top:5px;">
             <div>
                 <span class="big-label" style="color: #166534;">Ukupno Sati</span>
                 <span class="big-val" id="resTotalHours" style="color: #14532d;">0</span>
             </div>
             <div style="text-align:right;">
                 <span class="big-label" style="color: #166534;">Trošak</span>
                 <span class="big-val" id="resTotalCost" style="color: #14532d;">0 €</span>
             </div>
          </div>
          <div style="border-top: 1px solid #bbf7d0; margin-top:10px; padding-top:10px; display:flex; justify-content:space-between; align-items:center;">
             <span class="big-label" style="color: #166534;">LABOR %</span>
             <span class="big-val" id="resPercent" style="color: #14532d;">0.00%</span>
          </div>
      </div>
  </div>

  <div class="table-container">
    <div class="table-scroll">
      <table id="dataTable">
          <thead>
              <tr>
                  <th style="width:40px; text-align:center;">#</th>
                  <th style="width:130px; text-align:left;">Dan</th>
                  <th>Promet</th>
                  <th>Cilj Prod.</th>
                  <th>Prod. Std.*</th>
                  <th>SF Sati</th>
                  <th>HM Sati</th>
                  <th>NZ (€)</th>
                  <th>Extra Sati</th>
              </tr>
          </thead>
          <tbody id="tableBody"></tbody>
          <tfoot>
              <tr>
                  <td colspan="2" style="text-align: left; padding-left: 15px;">UKUPNO</td>
                  <td id="sumUmsatz">0</td>
                  <td>-</td>
                  <td id="sumProd">0</td>
                  <td id="sumSF">0</td>
                  <td id="sumHM">0</td>
                  <td id="sumNZ">0</td>
                  <td id="sumExtra">0</td>
              </tr>
          </tfoot>
      </table>
    </div>
  </div>

<script>
(function() {
    const daysOfWeek = ["Ponedjeljak", "Utorak", "Srijeda", "Četvrtak", "Petak", "Subota", "Nedjelja"];
    
    function val(input) {
        if (!input || input.value === "") return 0;
        return parseFloat(input.value) || 0;
    }

    // --- INIT TABLE ---
    function initTable() {
        const tbody = document.getElementById('tableBody');
        let html = '';
        
        for (let i = 1; i <= 31; i++) {
            let dayName = daysOfWeek[(i - 1) % 7];
            let isWeekend = dayName === "Subota" || dayName === "Nedjelja";
            
            html += \`
                <tr class="\${isWeekend ? 'weekend' : ''}">
                    <td style="text-align:center; color:#94a3b8; font-weight:bold;">\${i}</td>
                    <td><div class="col-day">\${dayName}</div></td>
                    <td><input type="number" class="inp-umsatz" placeholder="-" oninput="calcRow(this)" style="font-weight:700;"></td>
                    <td><input type="number" class="inp-ziel" value="100" oninput="calcRow(this)"></td>
                    <td class="col-calc"><input type="text" class="inp-prod" readonly tabindex="-1"></td>
                    <td><input type="number" class="inp-sf" placeholder="-" oninput="calcRow(this)"></td>
                    <td><input type="number" class="inp-hm" placeholder="-" oninput="calcRow(this)"></td>
                    <td><input type="number" class="inp-nz" placeholder="-" oninput="calcRow(this)"></td>
                    <td><input type="number" class="inp-extra" placeholder="-" oninput="calcRow(this)"></td>
                </tr>
            \`;
        }
        tbody.innerHTML = html;
        
        // Load Data if exists
        try {
            const saved = localStorage.getItem('mcd_alat1_monthly');
            if(saved) {
                const data = JSON.parse(saved);
                const inputs = document.querySelectorAll('input');
                inputs.forEach((inp, idx) => { if(data[idx] !== undefined) inp.value = data[idx]; });
                calculateAll();
            }
        } catch(e){}
    }

    // --- ROW CALCULATION ---
    window.calcRow = function(el) {
        const row = el.closest('tr');
        const umsatz = val(row.querySelector('.inp-umsatz'));
        const ziel = val(row.querySelector('.inp-ziel'));
        const sf = val(row.querySelector('.inp-sf'));

        if (umsatz === 0 && sf === 0) {
            row.querySelector('.inp-prod').value = "";
        } else {
            let prod = 0;
            if (ziel > 0) prod = (umsatz / ziel) - sf;
            row.querySelector('.inp-prod').value = prod.toFixed(2);
        }
        calculateAll();
    }

    // --- GLOBAL CALCULATION ---
    window.calculateAll = function() {
        let sUmsatz = 0, sProd = 0, sSF = 0, sHM = 0, sNZ = 0, sExtra = 0;

        const allValues = [];
        document.querySelectorAll('input').forEach(inp => allValues.push(inp.value));
        try { localStorage.setItem('mcd_alat1_monthly', JSON.stringify(allValues)); } catch(e){}

        document.querySelectorAll('#tableBody tr').forEach(row => {
            sUmsatz += val(row.querySelector('.inp-umsatz'));
            sProd += val(row.querySelector('.inp-prod'));
            sSF += val(row.querySelector('.inp-sf'));
            sHM += val(row.querySelector('.inp-hm'));
            sNZ += val(row.querySelector('.inp-nz'));
            sExtra += val(row.querySelector('.inp-extra'));
        });

        // Update footer
        const fmt = (n) => n.toLocaleString('de-DE', {minimumFractionDigits: 2});
        document.getElementById('sumUmsatz').textContent = fmt(sUmsatz);
        document.getElementById('sumProd').textContent = sProd.toFixed(1);
        document.getElementById('sumSF').textContent = sSF;
        document.getElementById('sumHM').textContent = sHM;
        document.getElementById('sumNZ').textContent = sNZ;
        document.getElementById('sumExtra').textContent = sExtra;

        // Global settings
        const wage = val(document.getElementById('hourlyWage'));
        const vacation = val(document.getElementById('vacationHours'));
        const sick = val(document.getElementById('sickHours'));
        
        // Financials
        const totalHoursPaid = sProd + sHM + sExtra + vacation + sick;
        const totalCost = (totalHoursPaid * wage) + sNZ;
        let percent = 0;
        if (sUmsatz > 0) percent = (totalCost / sUmsatz) * 100;

        // Display
        document.getElementById('resTotalHours').innerText = fmt(totalHoursPaid);
        document.getElementById('resTotalCost').innerText = fmt(totalCost) + " €";
        
        const elPercent = document.getElementById('resPercent');
        elPercent.innerText = percent.toFixed(2) + "%";

        // Color Logic
        const budgetSales = val(document.getElementById('budgetSales'));
        const budgetCost = val(document.getElementById('budgetCL'));
        let budgetMaxPercent = 0;

        if (budgetSales > 0 && budgetCost > 0) {
            budgetMaxPercent = (budgetCost / budgetSales) * 100;
            document.getElementById('budgetPercent').innerText = budgetMaxPercent.toFixed(2) + "%";
        } else {
            document.getElementById('budgetPercent').innerText = "-";
        }
    }

    // --- ACTIONS ---
    window.clearTable = function() {
        if(confirm("Da li ste sigurni?")) {
            try { localStorage.removeItem('mcd_alat1_monthly'); } catch(e){}
            const inputs = document.querySelectorAll('#tableBody input');
            inputs.forEach(inp => {
                if(!inp.classList.contains('inp-ziel')) inp.value = "";
                if(inp.classList.contains('inp-ziel')) inp.value = "100";
            });
            calculateAll();
        }
    }

    // --- PDF EXPORT (Enterprise Style) ---
    window.exportPDF = function() {
        if(typeof window.jspdf === 'undefined') { alert("Učitavanje biblioteke..."); return; }
        const btn = document.getElementById('exportBtn');
        btn.innerText = "Generisanje...";

        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ orientation: 'landscape' });
            
            // Header (Blue Strip)
            doc.setFillColor(30, 41, 59); doc.rect(0, 0, 297, 25, 'F');
            doc.setTextColor(255, 255, 255); doc.setFontSize(18); doc.text("MJESEČNI CREW LABOR PLAN", 14, 16);
            doc.setFontSize(10); doc.text("Generisano: " + new Date().toLocaleDateString(), 220, 16);

            // Executive Summary (KPIs on top)
            doc.setTextColor(0,0,0);
            const drawKpi = (x, title, val) => {
                doc.setDrawColor(200); doc.setFillColor(248, 250, 252);
                doc.roundedRect(x, 35, 50, 18, 2, 2, 'FD');
                doc.setFontSize(8); doc.setTextColor(100); doc.text(title, x+5, 41);
                doc.setFontSize(12); doc.setTextColor(30, 41, 59); doc.setFont(undefined, 'bold'); doc.text(val, x+5, 50);
                doc.setFont(undefined, 'normal');
            };
            
            drawKpi(14, "UKUPNI PROMET", document.getElementById('sumUmsatz').textContent);
            drawKpi(70, "UKUPNO SATI", document.getElementById('resTotalHours').textContent);
            drawKpi(126, "TROŠAK RADA", document.getElementById('resTotalCost').textContent);
            drawKpi(182, "LABOR %", document.getElementById('resPercent').textContent);

            // Data Preparation
            const rows = [];
            document.querySelectorAll('#tableBody tr').forEach((tr, idx) => {
                const tds = tr.querySelectorAll('td');
                const inputs = tr.querySelectorAll('input');
                const rowData = [
                    (idx + 1).toString(),
                    tds[1].innerText, // Dan
                    inputs[0].value,  // Promet
                    inputs[1].value,  // Cilj
                    inputs[2].value,  // Prod Std
                    inputs[3].value,  // SF
                    inputs[4].value,  // HM
                    inputs[5].value,  // NZ
                    inputs[6].value   // Extra
                ];
                rows.push(rowData);
            });

            // Footer Row
            rows.push([
                "", "TOTAL",
                document.getElementById('sumUmsatz').textContent,
                "-",
                document.getElementById('sumProd').textContent,
                document.getElementById('sumSF').textContent,
                document.getElementById('sumHM').textContent,
                document.getElementById('sumNZ').textContent,
                document.getElementById('sumExtra').textContent
            ]);

            // Generate Table
            doc.autoTable({
                head: [['#', 'Dan', 'Promet', 'Cilj', 'Prod. Std.', 'SF Sati', 'HM Sati', 'NZ', 'Extra']],
                body: rows,
                startY: 65,
                theme: 'grid',
                styles: { fontSize: 8, halign: 'right' },
                headStyles: { fillColor: [30, 41, 59], textColor: [255,255,255], fontStyle:'bold' },
                columnStyles: { 
                    0: { halign: 'center' },
                    1: { halign: 'left', fontStyle: 'bold' } 
                },
                didParseCell: (d) => {
                    // Highlight footer
                    if (d.row.index === rows.length - 1) {
                        d.cell.styles.fontStyle = 'bold';
                        d.cell.styles.fillColor = [255, 199, 44]; // Yellow
                        d.cell.styles.textColor = [0,0,0];
                    }
                }
            });

            // Signature Section
            const fy = doc.lastAutoTable.finalY + 20;
            if(fy < 190) {
                doc.setDrawColor(100);
                doc.line(14, fy, 80, fy);
                doc.setFontSize(8);
                doc.text("Odobrio (Menadžer)", 14, fy + 4);
            }

            doc.save('LaborPlan.pdf');
        } catch(e) {
            alert("Greška: " + e.message);
        } finally {
            btn.innerText = "🖨️ Štampaj / PDF";
        }
    }

    initTable();
})();
</script>
</body>
</html>
`;