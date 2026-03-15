import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  getDay,
  isSameMonth,
  isSameDay,
} from "date-fns";
import { de } from "date-fns/locale";

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

type Props = {
  vacationDates: string[];
};

export default function VacationMiniCalendar({ vacationDates }: Props) {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startWeekday = (getDay(monthStart) + 6) % 7;
  const padding = Array(startWeekday).fill(null);
  const gridDays = [...padding, ...days];
  const totalCells = Math.ceil(gridDays.length / 7) * 7;
  const filledGrid = [...gridDays, ...Array(totalCells - gridDays.length).fill(null)];
  const vacSet = new Set(vacationDates);

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-1.5">
      <p className="text-[9px] font-bold text-white/60 uppercase tracking-wider text-center mb-1">
        {format(monthStart, "MMMM yyyy", { locale: de })}
      </p>
      <div className="grid grid-cols-7 gap-px text-center">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-[8px] font-bold text-white/50">
            {d}
          </div>
        ))}
        {filledGrid.slice(0, 7 * 6).map((day, i) => {
          if (!day) {
            return <div key={`e-${i}`} className="min-h-[18px] rounded bg-white/5" />;
          }
          const key = format(day, "yyyy-MM-dd");
          const isVacation = vacSet.has(key);
          const isCurrentMonth = isSameMonth(day, monthStart);
          const isToday = isSameDay(day, now);
          const cellStyle = !isCurrentMonth
            ? "text-white/30"
            : isToday
              ? "bg-[#FFC72C] text-[#1a3826]"
              : isVacation
                ? "bg-[#FFC72C]/50 text-[#1a3826]"
                : "text-white/90";
          return (
            <div
              key={key}
              className={`min-h-[18px] rounded flex items-center justify-center text-[9px] font-bold ${cellStyle}`}
            >
              {format(day, "d")}
            </div>
          );
        })}
      </div>
    </div>
  );
}
