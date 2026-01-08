"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, FileText, Ban, X, CheckCircle, XCircle, Clock, Printer, RefreshCw 
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getRestaurantUsers } from "@/app/actions/getRestaurantUsers";
// NOVI IMPORT ZA PRAZNIKE
import { getBlockedDays, addBlockedDay, removeBlockedDay } from "@/app/actions/vacationActions";

// --- TIPOVI ---
type UserRole = 'ADMIN' | 'WORKER' | 'MANAGER' | 'CREW' | 'SUPER_ADMIN';

interface Vacation {
  id: string;
  start: string;
  end: string;
  days: number;
  realDays: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

interface Employee {
  id: string;
  dept: string;
  name: string;
  email?: string; 
  carryover: number; 
  entitlement: number; 
  vacations: Vacation[];
  exitDate: string;
  deleted: boolean;
  role: UserRole; 
  isDbUser?: boolean; 
}

const DEPARTMENTS = [
  { id: 'RL', name: 'Odjel RL (Radnici)', color: 'blue' },
  { id: 'Office', name: 'Odjel Office (Mng)', color: 'purple' },
  { id: 'HM', name: 'Odjel HM', color: 'orange' }
];

const BASE_DATA_KEY = "mcd_vacation_data_v9_final"; 

export default function VacationPlannerPage() {
  const router = useRouter();

  // --- STATE ---
  const [currentRestaurantId, setCurrentRestaurantId] = useState<string | null>(null);
  const [currentRestaurantName, setCurrentRestaurantName] = useState<string>("");
  const [year, setYear] = useState<number>(new Date().getFullYear());
  
  const [employees, setEmployees] = useState<Record<string, Employee>>({});
  const [blockedDays, setBlockedDays] = useState<Record<string, string>>({}); // SADA IZ BAZE
  const [isLoading, setIsLoading] = useState(false);

  // AUTH STATE
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>('CREW'); 
  const [currentWorkerId, setCurrentWorkerId] = useState<string>(""); 

  const [isEmpModalOpen, setIsEmpModalOpen] = useState(false);
  const [empDraft, setEmpDraft] = useState<Employee | null>(null);
  const [isBlockedModalOpen, setIsBlockedModalOpen] = useState(false);

  const [newVacStart, setNewVacStart] = useState("");
  const [newVacEnd, setNewVacEnd] = useState("");
  const [newBlockDate, setNewBlockDate] = useState("");
  const [newBlockReason, setNewBlockReason] = useState("");

  // INIT
  useEffect(() => {
    const restId = localStorage.getItem("selected_restaurant_id");
    if (!restId) { router.push("/select-restaurant"); return; }
    
    const storedRole = localStorage.getItem("user_role") as UserRole;
    const storedUserId = localStorage.getItem("user_id");

    setCurrentRestaurantId(restId);
    setCurrentRestaurantName(localStorage.getItem("selected_restaurant_name") || "");
    
    if (storedRole) setCurrentUserRole(storedRole);
    if (storedUserId) setCurrentWorkerId(storedUserId);

  }, [router]);

  useEffect(() => {
    if (currentRestaurantId) {
      loadDataAndSync();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, currentRestaurantId]);

  const getDataKey = () => `${BASE_DATA_KEY}_${currentRestaurantId}_${year}`;

  const loadDataAndSync = async () => {
    if (!currentRestaurantId) return;
    setIsLoading(true);
    
    // 1. Učitaj Godišnje (Lokalno za sada, dok ne prebacimo i njih u bazu)
    const rawData = localStorage.getItem(getDataKey());
    let localEmps: Record<string, Employee> = rawData ? JSON.parse(rawData) : {};
    
    // 2. Učitaj Praznike IZ BAZE
    const dbBlockedDays = await getBlockedDays(currentRestaurantId);
    setBlockedDays(dbBlockedDays);

    // 3. Sync Korisnika
    try {
        const dbUsers = await getRestaurantUsers(currentRestaurantId);
        const mergedEmps = { ...localEmps };
        let hasChanges = false;

        dbUsers.forEach((dbUser: any) => {
            if (mergedEmps[dbUser.id]) {
                if (mergedEmps[dbUser.id].name !== dbUser.name || mergedEmps[dbUser.id].role !== dbUser.role || mergedEmps[dbUser.id].dept !== dbUser.department) {
                    mergedEmps[dbUser.id].name = dbUser.name;
                    mergedEmps[dbUser.id].role = dbUser.role as UserRole;
                    mergedEmps[dbUser.id].email = dbUser.email || "";
                    if(dbUser.department) mergedEmps[dbUser.id].dept = dbUser.department;
                    mergedEmps[dbUser.id].isDbUser = true;
                    hasChanges = true;
                }
            } else {
                mergedEmps[dbUser.id] = {
                    id: dbUser.id,
                    name: dbUser.name,
                    email: dbUser.email || "",
                    dept: dbUser.department || 'RL',
                    role: dbUser.role as UserRole,
                    carryover: 0,
                    entitlement: 20,
                    vacations: [],
                    exitDate: "",
                    deleted: false,
                    isDbUser: true
                };
                hasChanges = true;
            }
        });

        setEmployees(mergedEmps);
        if (hasChanges) localStorage.setItem(getDataKey(), JSON.stringify(mergedEmps));

    } catch (error) {
        console.error("Sync error:", error);
        setEmployees(localEmps);
    } finally {
        setIsLoading(false);
    }
  };

  const saveData = (newEmps: Record<string, Employee>) => {
    setEmployees(newEmps);
    localStorage.setItem(getDataKey(), JSON.stringify(newEmps));
  };

  // --- NOVE FUNKCIJE ZA PRAZNIKE ---
  const handleAddBlockedDay = async () => {
    if (newBlockDate && currentRestaurantId) {
       const reason = newBlockReason || "Praznik";
       // 1. Spasi u bazu
       await addBlockedDay(currentRestaurantId, newBlockDate, reason);
       // 2. Ažuriraj UI
       setBlockedDays(prev => ({ ...prev, [newBlockDate]: reason }));
       setNewBlockDate(""); setNewBlockReason("");
    }
  };

  const handleRemoveBlockedDay = async (date: string) => {
    if (currentRestaurantId) {
        // 1. Obriši iz baze
        await removeBlockedDay(currentRestaurantId, date);
        // 2. Ažuriraj UI
        const newB = { ...blockedDays };
        delete newB[date];
        setBlockedDays(newB);
    }
  };
  // --------------------------------

  const calculateVacationDays = (startStr: string, endStr: string) => {
    const start = new Date(startStr);
    const end = new Date(endStr);
    let chargeableDays = 0; 
    let blockedCount = 0;   
    let curr = new Date(start);
    while (curr <= end) {
      const dateStr = curr.toISOString().split('T')[0];
      const dayOfWeek = curr.getDay();
      const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
      const isBlocked = blockedDays[dateStr] !== undefined;
      if (!isWeekend) {
        if (isBlocked) blockedCount++; 
        else chargeableDays++; 
      }
      curr.setDate(curr.getDate() + 1);
    }
    return { chargeableDays, blockedCount };
  };

  const handleAddVacation = () => {
    const isWorkerMode = currentUserRole === 'WORKER' || currentUserRole === 'CREW';
    const targetEmp = isWorkerMode && currentWorkerId ? employees[currentWorkerId] : empDraft;

    if (!targetEmp || !newVacStart || !newVacEnd) return;
    if (newVacStart > newVacEnd) { alert("Greška: Datum početka je nakon datuma završetka."); return; }

    const { chargeableDays, blockedCount } = calculateVacationDays(newVacStart, newVacEnd);
    if (chargeableDays === 0 && blockedCount === 0) { alert("Nema radnih dana."); return; }

    const newVac: Vacation = {
      id: Date.now().toString(),
      start: newVacStart,
      end: newVacEnd,
      days: chargeableDays, 
      realDays: chargeableDays + blockedCount, 
      status: (currentUserRole === 'ADMIN' || currentUserRole === 'SUPER_ADMIN') ? 'APPROVED' : 'PENDING' 
    };

    const updatedEmp = { ...targetEmp, vacations: [...targetEmp.vacations, newVac] };
    const newEmps = { ...employees, [updatedEmp.id]: updatedEmp };
    saveData(newEmps);
    
    if (currentUserRole === 'ADMIN' || currentUserRole === 'SUPER_ADMIN') {
        setEmpDraft(updatedEmp);
    }

    setNewVacStart("");
    setNewVacEnd("");
    
    if (isWorkerMode) {
      alert(`Zahtjev poslan adminu! Status: NA ČEKANJU.`);
    }
  };

  const handleUpdateStatus = (empId: string, vacId: string, newStatus: 'APPROVED' | 'REJECTED') => {
    const emp = employees[empId];
    if (!emp) return;
    const updatedVacations = emp.vacations.map(v => v.id === vacId ? { ...v, status: newStatus } : v);
    const newEmps = { ...employees, [empId]: { ...emp, vacations: updatedVacations } };
    saveData(newEmps);
  };

  const exportPDF = (type: 'departments' | 'timeline') => {
    const doc = new jsPDF(type === 'timeline' ? 'p' : 'p'); 
    const title = `PLAN GODISNJIH ODMORA ${year} - ${currentRestaurantName}`;
    doc.setFillColor(26, 56, 38); doc.rect(0, 0, 297, 20, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(14); doc.text(title, 14, 13);

    if (type === 'departments') {
      let startY = 30;
      DEPARTMENTS.forEach(dept => {
        const deptEmps = Object.values(employees).filter(e => e.dept === dept.id && !e.deleted);
        if (deptEmps.length === 0) return;
        const bodyData = deptEmps.map(e => {
          const used = e.vacations.filter(v => v.status === 'APPROVED').reduce((acc, v) => acc + v.days, 0);
          const total = e.carryover + e.entitlement;
          return [e.name, total, used, total - used];
        });
        autoTable(doc, {
          startY: startY,
          head: [[`${dept.name.toUpperCase()}`, 'Pravo', 'Iskorišteno', 'Ostalo']],
          body: bodyData,
          theme: 'grid',
          headStyles: { fillColor: [200, 200, 200], textColor: 0 },
          styles: { fontSize: 8 },
          margin: { bottom: 10 }
        });
        // @ts-ignore
        startY = doc.lastAutoTable.finalY + 10;
      });
    } else {
      const allVacations: any[] = [];
      Object.values(employees).forEach(emp => {
        if (emp.deleted) return;
        emp.vacations.forEach(vac => {
          allVacations.push({
            dept: DEPARTMENTS.find(d => d.id === emp.dept)?.name || emp.dept,
            name: emp.name, start: vac.start, end: vac.end, days: vac.days, status: vac.status
          });
        });
      });
      allVacations.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
      autoTable(doc, {
        startY: 30,
        head: [['Datum Od', 'Datum Do', 'Radnik', 'Odjel', 'Dana', 'Status']],
        body: allVacations.map(v => [v.start, v.end, v.name, v.dept, v.days, v.status]),
        theme: 'striped',
        headStyles: { fillColor: [26, 56, 38] },
        styles: { fontSize: 8 }
      });
    }
    doc.save(`Izvjestaj_${type}_${year}.pdf`);
  };

  const getStats = (emp: Employee) => {
    const approved = emp.vacations.filter(v => v.status === 'APPROVED').reduce((acc, v) => acc + v.days, 0);
    const pending = emp.vacations.filter(v => v.status === 'PENDING').reduce((acc, v) => acc + v.days, 0);
    const total = emp.carryover + emp.entitlement;
    return { approved, pending, remaining: total - approved };
  };

  const getAllVacationsFlat = () => {
    const list: any[] = [];
    Object.values(employees).forEach(emp => {
      if(emp.deleted) return;
      emp.vacations.forEach(vac => list.push({ ...vac, empName: emp.name, empId: emp.id, deptName: DEPARTMENTS.find(d => d.id === emp.dept)?.name || emp.dept }));
    });
    return list.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  };

  if (!currentRestaurantId) return null;

  const isWorker = currentUserRole === 'WORKER' || currentUserRole === 'CREW';

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8 text-[#0F172A]">
      <div className="max-w-[1600px] mx-auto">
        
        {/* HEADER */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
           <div>
             <button onClick={() => router.back()} className="flex items-center gap-2 text-slate-500 font-bold hover:text-[#1a3826] mb-1 text-xs">
                 <ArrowLeft className="w-3 h-3" /> Nazad
             </button>
             <h1 className="text-xl font-black text-[#1a3826] uppercase flex items-center gap-2">
                AIWTool Planer <span className="text-orange-500 text-sm">v9.0</span>
                {isLoading && <RefreshCw className="animate-spin w-4 h-4 text-slate-400"/>}
             </h1>
             <p className="text-xs text-slate-400 font-bold">{currentRestaurantName} • {year}</p>
           </div>
        </div>

        {/* --- ADMIN VIEW --- */}
        {!isWorker && (
          <>
            <div className="flex justify-between items-center mb-6">
                <div className="flex gap-2">
                    <button onClick={() => setIsBlockedModalOpen(true)} className="px-4 py-2 bg-white border border-orange-200 text-orange-600 rounded-lg font-bold hover:bg-orange-50 text-xs flex items-center gap-2">
                        <Ban className="w-4 h-4" /> Upravljanje Praznicima
                    </button>
                    <button onClick={loadDataAndSync} className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg font-bold text-xs flex items-center gap-2 hover:bg-blue-100">
                        <RefreshCw className="w-3 h-3"/> Osvježi iz Baze
                    </button>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => exportPDF('departments')} className="px-4 py-2 bg-slate-700 text-white rounded-lg font-bold text-xs flex items-center gap-2"><Printer className="w-3 h-3"/> Export Odjeli</button>
                    <button onClick={() => exportPDF('timeline')} className="px-4 py-2 bg-slate-800 text-white rounded-lg font-bold text-xs flex items-center gap-2"><Printer className="w-3 h-3"/> Export Lista</button>
                </div>
            </div>

            <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 mb-8">
               <h3 className="text-sm font-bold text-orange-800 mb-3 flex items-center gap-2"><Clock className="w-4 h-4"/> Zahtjevi na čekanju</h3>
               <div className="space-y-2">
                 {getAllVacationsFlat().filter((v: any) => v.status === 'PENDING').length === 0 ? (
                    <p className="text-xs text-orange-400 italic">Nema novih zahtjeva.</p>
                 ) : (
                    getAllVacationsFlat().filter((v: any) => v.status === 'PENDING').map((vac: any) => (
                        <div key={vac.id} className="bg-white p-3 rounded-lg border border-orange-200 flex justify-between items-center shadow-sm">
                            <div>
                                <span className="font-bold text-slate-700 text-sm">{vac.empName}</span>
                                <span className="text-xs text-slate-500 mx-2">|</span>
                                <span className="text-xs font-mono">{vac.start} do {vac.end}</span>
                                <span className="text-xs font-bold text-blue-600 ml-2">({vac.days} dana)</span>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => handleUpdateStatus(vac.empId, vac.id, 'APPROVED')} className="p-1 bg-emerald-100 text-emerald-600 rounded hover:bg-emerald-200"><CheckCircle size={16}/></button>
                                <button onClick={() => handleUpdateStatus(vac.empId, vac.id, 'REJECTED')} className="p-1 bg-red-100 text-red-600 rounded hover:bg-red-200"><XCircle size={16}/></button>
                            </div>
                        </div>
                    ))
                 )}
               </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                {DEPARTMENTS.map(dept => (
                    <div key={dept.id} className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-[500px]">
                        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                            <h3 className="font-bold text-slate-700">{dept.name}</h3>
                        </div>
                        <div className="overflow-y-auto flex-1 p-2 space-y-2">
                            {Object.values(employees).filter(e => e.dept === dept.id && !e.deleted).map(emp => {
                                const stats = getStats(emp);
                                return (
                                    <div key={emp.id} onClick={() => { setEmpDraft(emp); setIsEmpModalOpen(true); }} className="p-3 rounded-lg border border-slate-100 hover:border-blue-300 hover:shadow-md cursor-pointer transition-all bg-white group">
                                        <div className="flex justify-between items-center mb-1">
                                            <div className="font-bold text-sm text-slate-800">
                                                {emp.name}
                                                {emp.isDbUser && <span className="ml-2 text-[8px] bg-blue-100 text-blue-600 px-1 rounded">DB</span>}
                                            </div>
                                            {stats.pending > 0 && <span className="bg-orange-100 text-orange-600 text-[10px] px-1.5 py-0.5 rounded-full animate-pulse">!</span>}
                                        </div>
                                        <div className="flex justify-between text-[10px] uppercase font-bold text-slate-400">
                                            <span>Iskorišteno: {stats.approved}</span>
                                            <span className={stats.remaining < 0 ? 'text-red-500' : 'text-emerald-600'}>Ostalo: {stats.remaining}</span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                ))}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-200">
                    <h3 className="font-bold text-slate-700">Pregled Svih Godišnjih Odmora</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-white border-b border-slate-100">
                            <tr>
                                <th className="p-4 text-xs uppercase text-slate-400 font-bold">Radnik</th>
                                <th className="p-4 text-xs uppercase text-slate-400 font-bold">Period</th>
                                <th className="p-4 text-xs uppercase text-slate-400 font-bold">Dana</th>
                                <th className="p-4 text-xs uppercase text-slate-400 font-bold">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {getAllVacationsFlat().map((vac: any, idx) => (
                                <tr key={`${vac.id}-${idx}`} className="hover:bg-slate-50">
                                    <td className="p-4 font-bold text-slate-800">{vac.empName}</td>
                                    <td className="p-4 font-mono text-xs">{vac.start} - {vac.end}</td>
                                    <td className="p-4 font-bold text-blue-600">{vac.days}</td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded text-[10px] font-bold ${vac.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : vac.status === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>{vac.status}</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
          </>
        )}

        {/* --- WORKER VIEW --- */}
        {isWorker && employees[currentWorkerId] && (
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                 {/* Profil Kartica */}
                 <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-6">
                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-2xl font-black text-slate-300">
                       {employees[currentWorkerId].name.charAt(0)}
                    </div>
                    <div className="flex-1">
                       <h2 className="text-2xl font-bold text-slate-800">{employees[currentWorkerId].name}</h2>
                       <div className="mt-4 flex gap-6">
                          <div><span className="block text-[10px] uppercase text-slate-400 font-bold">Ukupno Pravo</span><span className="text-xl font-bold text-slate-800">{employees[currentWorkerId].entitlement + employees[currentWorkerId].carryover}</span></div>
                          <div><span className="block text-[10px] uppercase text-slate-400 font-bold">Iskorišteno</span><span className="text-xl font-bold text-blue-600">{getStats(employees[currentWorkerId]).approved}</span></div>
                          <div><span className="block text-[10px] uppercase text-slate-400 font-bold">Preostalo</span><span className={`text-xl font-bold ${getStats(employees[currentWorkerId]).remaining < 0 ? 'text-red-500' : 'text-emerald-500'}`}>{getStats(employees[currentWorkerId]).remaining}</span></div>
                       </div>
                    </div>
                 </div>

                 {/* Forma za Zahtjev */}
                 <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><FileText className="w-5 h-5 text-[#1a3826]"/> Podnesi Zahtjev</h3>
                    <div className="flex gap-4 items-end bg-slate-50 p-4 rounded-lg border border-slate-100">
                        <div className="flex-1"><label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Od</label><input type="date" value={newVacStart} onChange={e => setNewVacStart(e.target.value)} className="w-full border rounded-lg p-2 text-sm" /></div>
                        <div className="flex-1"><label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Do</label><input type="date" value={newVacEnd} onChange={e => setNewVacEnd(e.target.value)} className="w-full border rounded-lg p-2 text-sm" /></div>
                        <button onClick={handleAddVacation} className="bg-[#1a3826] text-white px-6 py-2.5 rounded-lg font-bold text-sm hover:opacity-90">Pošalji Zahtjev</button>
                    </div>
                 </div>

                 {/* Lista Zahtjeva */}
                 <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-4 bg-slate-50 border-b border-slate-200 font-bold text-sm text-slate-600">Moji Zahtjevi</div>
                    <table className="w-full text-sm text-left"><thead className="bg-white border-b border-slate-100"><tr><th className="p-4">Period</th><th className="p-4">Dani</th><th className="p-4">Status</th></tr></thead>
                       <tbody className="divide-y divide-slate-100">
                          {employees[currentWorkerId].vacations.map(vac => (
                             <tr key={vac.id}>
                                <td className="p-4 font-mono text-slate-600">{vac.start} - {vac.end}</td>
                                <td className="p-4 font-bold text-slate-800">{vac.days}</td>
                                <td className="p-4"><span className={`px-2 py-1 rounded text-[10px] font-bold ${vac.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : vac.status === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>{vac.status}</span></td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
              </div>
              
              {/* Desni Sidebar - Praznici IZ BAZE */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 h-fit">
                 <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Ban className="w-5 h-5 text-red-500"/> Neradni Dani</h3>
                 <p className="text-xs text-slate-500 mb-4">Ovi dani se ne računaju u godišnji odmor.</p>
                 <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                    {Object.entries(blockedDays).sort().map(([date, reason]) => (
                       <div key={date} className="flex gap-3 items-start p-2 rounded-lg bg-red-50 border border-red-100">
                          <div className="bg-white px-2 py-1 rounded border border-red-100 text-xs font-mono font-bold text-red-600">{new Date(date).toLocaleDateString()}</div>
                          <div className="text-sm text-red-800 font-medium leading-tight pt-1">{reason}</div>
                       </div>
                    ))}
                    {Object.keys(blockedDays).length === 0 && <p className="text-slate-400 text-xs italic">Nema unesenih praznika.</p>}
                 </div>
              </div>
           </div>
        )}
      </div>

      {/* MODAL ZA UREĐIVANJE RADNIKA (ADMIN) */}
      {isEmpModalOpen && empDraft && !isWorker && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
           <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden">
              <div className="p-6 border-b flex justify-between items-center bg-slate-50"><h3 className="font-bold text-lg">Uredi: {empDraft.name}</h3><button onClick={() => setIsEmpModalOpen(false)}><X/></button></div>
              <div className="p-6 max-h-[70vh] overflow-y-auto">
                 <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="col-span-2"><label className="text-xs font-bold text-slate-400">Ime</label><input type="text" value={empDraft.name} disabled className="w-full border p-2 rounded bg-slate-100"/></div>
                    <div><label className="text-xs font-bold text-slate-400">Stari GO</label><input type="number" value={empDraft.carryover} onChange={e => setEmpDraft({...empDraft, carryover: Number(e.target.value)})} className="w-full border p-2 rounded"/></div>
                    <div><label className="text-xs font-bold text-slate-400">Novi GO</label><input type="number" value={empDraft.entitlement} onChange={e => setEmpDraft({...empDraft, entitlement: Number(e.target.value)})} className="w-full border p-2 rounded"/></div>
                 </div>
                 <div className="p-4 bg-slate-50 border-t text-right">
                     <button onClick={() => {
                         const newEmps = {...employees, [empDraft.id]: empDraft};
                         saveData(newEmps);
                         setIsEmpModalOpen(false);
                     }} className="bg-[#1a3826] text-white px-6 py-2 rounded font-bold text-sm">Sačuvaj</button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* MODAL ZA BLOKIRANE DANE */}
      {isBlockedModalOpen && (
         <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
               <div className="p-4 border-b flex justify-between items-center bg-slate-50"><h3 className="font-bold text-lg flex items-center gap-2"><Ban className="text-red-500"/> Praznici (Baza)</h3><button onClick={() => setIsBlockedModalOpen(false)}><X/></button></div>
               <div className="p-4">
                  <div className="flex gap-2 mb-4">
                     <input type="date" value={newBlockDate} onChange={e => setNewBlockDate(e.target.value)} className="border p-2 rounded flex-1 text-sm"/>
                     <input type="text" placeholder="Naziv..." value={newBlockReason} onChange={e => setNewBlockReason(e.target.value)} className="border p-2 rounded flex-1 text-sm"/>
                     <button onClick={handleAddBlockedDay} className="bg-red-50 text-red-600 px-3 rounded font-bold text-sm">Dodaj</button>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto border rounded bg-slate-50 p-2 space-y-2">
                     {Object.entries(blockedDays).sort().map(([date, reason]) => (
                        <div key={date} className="flex justify-between items-center bg-white p-2 rounded border border-slate-200">
                           <div><span className="font-mono font-bold text-xs">{date}</span> <span className="text-sm ml-2">{reason}</span></div>
                           <button onClick={() => handleRemoveBlockedDay(date)} className="text-red-400 hover:text-red-600"><X size={14}/></button>
                        </div>
                     ))}
                  </div>
               </div>
            </div>
         </div>
      )}
    </div>
  );
}