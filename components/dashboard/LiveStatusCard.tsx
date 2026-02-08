"use client";

import React, { useState, useEffect } from "react";
import { Clock, Users, Store } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateDDMMGGGG } from "@/lib/dateUtils";

export default function LiveStatusCard() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const timeStr = now.toLocaleTimeString("bs-BA", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const dateStr = formatDateDDMMGGGG(now);

  return (
    <Card className="border-border bg-card shadow-sm rounded-xl overflow-hidden">
      <CardHeader className="pb-2 px-6">
        <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
          <Clock size={18} className="text-[#1a3826]" />
          Status smjene / dan
        </CardTitle>
      </CardHeader>
      <CardContent className="px-6 pb-6 pt-0 space-y-4">
        <div className="flex items-center justify-between gap-4 p-3 rounded-xl bg-slate-50 border border-slate-100">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Datum i vrijeme</span>
          <div className="text-right">
            <p className="text-lg font-bold text-foreground tabular-nums">{timeStr}</p>
            <p className="text-xs font-medium text-slate-600">{dateStr}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50/80 border border-emerald-100">
          <Users size={20} className="text-[#1a3826] shrink-0" />
          <div>
            <p className="text-xs font-semibold text-slate-600">Trenutno u smjeni</p>
            <p className="text-xl font-bold text-[#1a3826]">8 zaposlenika</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
          <Store size={20} className="text-slate-600 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-slate-600">Status restorana</p>
            <p className="text-sm font-bold text-foreground">Otvoreno</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
