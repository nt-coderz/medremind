import React from 'react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend 
} from 'recharts';
import { format, addDays } from 'date-fns';
import { ChevronLeft, ChevronRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { useMedicine } from '../../context/MedicineContext';
import Card from '../common/Card';
import Badge from '../common/Badge';

export default function WeeklyComplianceChart({ 
  weekStartDate = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), 
  onPrevWeek, 
  onNextWeek, 
  compact = false 
}) {
  const { getWeeklyCompliance } = useMedicine();
  const compliance = getWeeklyCompliance(weekStartDate);

  const startDate = weekStartDate instanceof Date ? weekStartDate : new Date(weekStartDate);
  const endDate = addDays(startDate, 6);
  const rangeLabel = `${format(startDate, 'MMM d')} – ${format(endDate, 'MMM d, yyyy')}`;

  const hasScheduledDoses = compliance.weekScheduled > 0;

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-2.5 rounded-xl border border-gray-200 shadow-md text-xs space-y-1">
          <div className="font-bold text-gray-800">{data.dayLabel}, {data.date}</div>
          <div className="flex items-center justify-between gap-3 text-emerald-700">
            <span>Taken:</span>
            <span className="font-bold">{data.taken}</span>
          </div>
          <div className="flex items-center justify-between gap-3 text-amber-700">
            <span>Skipped:</span>
            <span className="font-bold">{data.skipped}</span>
          </div>
          <div className="flex items-center justify-between gap-3 text-rose-700">
            <span>Missed:</span>
            <span className="font-bold">{data.missed}</span>
          </div>
          {data.adherencePercent !== null && (
            <div className="pt-1 mt-1 border-t border-gray-100 flex items-center justify-between font-bold text-gray-900">
              <span>Adherence:</span>
              <span>{data.adherencePercent}%</span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="p-4 space-y-3 bg-white">
      {/* Header & Week Nav */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800">
            {compact ? "Weekly Compliance" : "7-Day Adherence Breakdown"}
          </h3>
          <span className="text-[11px] text-gray-500 font-medium">{rangeLabel}</span>
        </div>

        <div className="flex items-center gap-2">
          {compliance.overallAdherence !== null ? (
            <Badge 
              variant={compliance.overallAdherence >= 80 ? "primary" : compliance.overallAdherence >= 50 ? "warning" : "danger"} 
              size="sm"
            >
              {compliance.overallAdherence}% Adherence
            </Badge>
          ) : (
            <Badge variant="neutral" size="sm">No Doses</Badge>
          )}

          {(onPrevWeek || onNextWeek) && (
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
              <button
                type="button"
                onClick={onPrevWeek}
                className="p-1 text-gray-600 hover:text-gray-900 hover:bg-white rounded transition-colors"
                aria-label="Previous Week"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={onNextWeek}
                className="p-1 text-gray-600 hover:text-gray-900 hover:bg-white rounded transition-colors"
                aria-label="Next Week"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stacked Bar Chart */}
      {!hasScheduledDoses ? (
        <div className="py-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
          <AlertCircle className="w-6 h-6 text-gray-400 mx-auto mb-1.5 opacity-60" />
          <p className="text-xs font-medium text-gray-500">No doses scheduled for this period.</p>
          <p className="text-[10px] text-gray-400 mt-0.5">Add medicines to view adherence trends.</p>
        </div>
      ) : (
        <div>
          <div className={compact ? "h-44 w-full" : "h-56 w-full"}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={compliance.days} 
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                barSize={compact ? 14 : 20}
              >
                <XAxis 
                  dataKey="dayLabel" 
                  stroke="#9CA3AF" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={{ stroke: '#E5E7EB' }} 
                />
                <YAxis 
                  stroke="#9CA3AF" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={{ stroke: '#E5E7EB' }}
                  allowDecimals={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend 
                  verticalAlign="top" 
                  align="right" 
                  iconSize={8}
                  wrapperStyle={{ fontSize: '10px', paddingBottom: '6px' }}
                />
                <Bar dataKey="taken" stackId="a" fill="#238B78" radius={[0, 0, 0, 0]} name="Taken" />
                <Bar dataKey="skipped" stackId="a" fill="#F59E0B" radius={[0, 0, 0, 0]} name="Skipped" />
                <Bar dataKey="missed" stackId="a" fill="#F43F5E" radius={[3, 3, 0, 0]} name="Missed" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Compliance Summary Statistics Bar */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100 text-center">
            <div className="bg-emerald-50/60 p-1.5 rounded-xl border border-emerald-100">
              <span className="text-[10px] text-emerald-800 block font-medium">Taken</span>
              <span className="font-bold text-xs text-emerald-700">{compliance.weekTaken}</span>
            </div>
            <div className="bg-amber-50/60 p-1.5 rounded-xl border border-amber-100">
              <span className="text-[10px] text-amber-800 block font-medium">Skipped</span>
              <span className="font-bold text-xs text-amber-700">{compliance.weekSkipped}</span>
            </div>
            <div className="bg-rose-50/60 p-1.5 rounded-xl border border-rose-100">
              <span className="text-[10px] text-rose-800 block font-medium">Missed</span>
              <span className="font-bold text-xs text-rose-700">{compliance.weekMissed}</span>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
