import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMedicine } from '../../context/MedicineContext';
import { useAuth } from '../../context/AuthContext';
import { getTimeBasedGreeting, getUserFirstName } from '../../utils/greetingUtils';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { 
  Camera, 
  Plus, 
  Check, 
  Clock, 
  ChevronRight, 
  Calendar,
  Sparkles,
  Pill,
  BellRing,
  Utensils,
  TrendingUp
} from 'lucide-react';
import WeeklyComplianceChart from '../../components/charts/WeeklyComplianceChart';
import { format } from 'date-fns';
import { parseArbitraryTime } from '../../services/notificationService';
import { toast } from 'sonner';

export default function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { medicines, getTodayMetrics, getDoseStatus, recordDose, snoozeReminder } = useMedicine();
  const { currentUser } = useAuth();
  const todayFormatted = format(new Date(), 'EEEE, MMMM d');

  // Dynamic greeting that updates as device time advances
  const [greeting, setGreeting] = useState(() => getTimeBasedGreeting());
  useEffect(() => {
    const timer = setInterval(() => {
      setGreeting(getTimeBasedGreeting());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const userName = getUserFirstName(currentUser);
  const metrics = getTodayMetrics();

  // Find next upcoming dose
  const getNextDose = () => {
    for (const med of medicines.filter(m => m.status === 'Active')) {
      for (const slot of (med.timeSlots || [])) {
        const status = getDoseStatus(med.id, slot);
        if (!status) {
          return { med, slot };
        }
      }
    }
    return null;
  };

  const nextDoseItem = getNextDose();

  const getDoseTimingInfo = (slotStr) => {
    if (!slotStr) return { isDue: true, label: 'Due Now' };
    const { hours, minutes } = parseArbitraryTime(slotStr);
    const scheduled = new Date();
    scheduled.setHours(hours, minutes, 0, 0);
    const diffMs = scheduled.getTime() - Date.now();

    if (diffMs <= 60000) {
      return { isDue: true, label: 'Due Now' };
    }

    const diffMins = Math.ceil(diffMs / 60000);
    if (diffMins >= 60) {
      const h = Math.floor(diffMins / 60);
      const m = diffMins % 60;
      return { isDue: false, label: `Due in ${h}h ${m}m`, countdown: `${h} hours ${m} minutes` };
    }
    return { isDue: false, label: `Due in ${diffMins} min`, countdown: `${diffMins} minute${diffMins === 1 ? '' : 's'}` };
  };

  const nextDoseTiming = nextDoseItem ? getDoseTimingInfo(nextDoseItem.slot) : null;

  const handleTakeDose = (medId, slot, medName) => {
    const success = recordDose(medId, slot, 'taken', slot);
    if (success) {
      toast.success(`Recorded dose: ${medName} taken.`);
    }
  };

  const handleSkipDose = (medId, slot, medName) => {
    const success = recordDose(medId, slot, 'skipped', slot);
    if (success) {
      toast.warning(`Recorded dose: ${medName} skipped.`);
    }
  };

  const handleSnoozeDose = (medId, slot, medName) => {
    snoozeReminder(medId, slot, 10);
    toast.info(`Reminder for ${medName} snoozed for 10 minutes.`);
  };

  return (
    <div className="p-4 space-y-4">
      {/* Top Greeting */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <span className="text-xs font-semibold text-[#238B78] uppercase tracking-wider flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            {todayFormatted}
          </span>
          <h1 className="text-2xl font-bold text-[#202B28] mt-0.5">{greeting}, {userName}!</h1>
          <p className="text-xs text-[#7A8782]">Let's keep your health routine on track.</p>
        </div>
      </div>

      {/* Prominent Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => navigate('/scanner')}
          className="flex flex-col items-start justify-between p-4 rounded-2xl bg-[#238B78] text-white shadow-md shadow-[#238B78]/25 hover:bg-[#1b6d5e] transition-all text-left cursor-pointer group active:scale-[0.98]"
        >
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
            <Camera className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-xs text-[#DDEFE8] font-medium flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Smart OCR
            </span>
            <span className="text-sm font-bold block leading-tight mt-0.5">{t('dashboard.scanPrescription', 'Scan Prescription')}</span>
          </div>
        </button>

        <button
          onClick={() => navigate('/medicines/add')}
          className="flex flex-col items-start justify-between p-4 rounded-2xl bg-white border border-[#E6ECE8] text-[#202B28] shadow-xs hover:border-[#238B78]/40 hover:bg-[#F8FAF8] transition-all text-left cursor-pointer group active:scale-[0.98]"
        >
          <div className="w-10 h-10 rounded-xl bg-[#DDEFE8] flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
            <Plus className="w-5 h-5 text-[#238B78]" />
          </div>
          <div>
            <span className="text-xs text-[#7A8782] font-medium">Manual Entry</span>
            <span className="text-sm font-bold block leading-tight mt-0.5">{t('medicines.addMedicine', 'Add Medicine')}</span>
          </div>
        </button>
      </div>

      {/* Food & Nutrition Tracker Card */}
      <Card 
        hoverable 
        onClick={() => navigate('/nutrition')} 
        className="p-3.5 bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-white border border-emerald-200/80 cursor-pointer shadow-xs"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <Utensils className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h4 className="text-xs font-bold text-[#202B28]">Food & Nutrition Tracker</h4>
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 uppercase tracking-wider">
                  New
                </span>
              </div>
              <p className="text-[11px] text-[#7A8782] mt-0.5">
                Log meals, daily calories, macro ratios (P/C/F) & fibre
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs font-bold text-[#238B78] shrink-0">
            <span>Open</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>
      </Card>

      {/* Today's Medication Overview Card */}
      <Card className="bg-gradient-to-br from-white to-[#F8FAF8]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm text-[#202B28]">Today's Routine Summary</h3>
          {metrics.adherencePercent !== null ? (
            <Badge variant={metrics.adherencePercent >= 80 ? 'success' : 'primary'}>
              {metrics.adherencePercent}% {t('dashboard.adherence', 'Adherence')}
            </Badge>
          ) : (
            <Badge variant="neutral">
              {t('dashboard.noDosesScheduled', 'No doses scheduled today')}
            </Badge>
          )}
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-[#E6ECE8] h-2.5 rounded-full overflow-hidden mb-4">
          <div 
            className="bg-[#238B78] h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: metrics.adherencePercent !== null ? `${metrics.adherencePercent}%` : '0%' }}
          />
        </div>

        {/* Metric Counters */}
        <div className="grid grid-cols-4 gap-2 text-center pt-1">
          <div className="bg-[#F8FAF8] p-2 rounded-xl border border-[#E6ECE8]/60">
            <span className="block text-lg font-bold text-[#202B28]">{metrics.totalDoses}</span>
            <span className="text-[10px] text-[#7A8782] font-medium uppercase tracking-tight">{t('common.all', 'Total')}</span>
          </div>
          <div className="bg-emerald-50/60 p-2 rounded-xl border border-emerald-100">
            <span className="block text-lg font-bold text-emerald-700">{metrics.takenDoses}</span>
            <span className="text-[10px] text-emerald-600 font-medium uppercase tracking-tight">{t('common.taken', 'Taken')}</span>
          </div>
          <div className="bg-amber-50/60 p-2 rounded-xl border border-amber-100">
            <span className="block text-lg font-bold text-amber-700">{metrics.pendingDoses}</span>
            <span className="text-[10px] text-amber-600 font-medium uppercase tracking-tight">{t('common.pending', 'Pending')}</span>
          </div>
          <div className="bg-rose-50/60 p-2 rounded-xl border border-rose-100">
            <span className="block text-lg font-bold text-rose-700">{metrics.skippedDoses}</span>
            <span className="text-[10px] text-rose-600 font-medium uppercase tracking-tight">{t('common.skipped', 'Skipped')}</span>
          </div>
        </div>
      </Card>

      {/* Next Upcoming Reminder */}
      {nextDoseItem ? (
        <Card highlight className="bg-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-[#238B78] uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> {t('dashboard.nextDose', 'Next Scheduled Dose')}
            </span>
            <div className="flex items-center gap-1.5">
              <Badge variant={nextDoseTiming?.isDue ? 'warning' : 'primary'}>
                {nextDoseTiming?.label || nextDoseItem.slot}
              </Badge>
            </div>
          </div>

          <div className="flex items-center justify-between mt-2">
            <div>
              <h4 className="font-bold text-base text-[#202B28]">{nextDoseItem.med.name}</h4>
              <p className="text-xs text-[#7A8782]">{nextDoseItem.med.dosage} • {nextDoseItem.med.form} • {nextDoseItem.slot}</p>
              <p className="text-[11px] text-[#7A8782] mt-1 italic">{nextDoseItem.med.instructions}</p>
            </div>
          </div>

          {/* Conditional Controls based on scheduled time */}
          {nextDoseTiming?.isDue ? (
            <div className="flex gap-2 mt-4 pt-3 border-t border-[#E6ECE8]">
              <Button
                variant="primary"
                size="sm"
                fullWidth
                icon={Check}
                onClick={() => handleTakeDose(nextDoseItem.med.id, nextDoseItem.slot, nextDoseItem.med.name)}
              >
                {t('common.take', 'Mark Taken')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                icon={BellRing}
                onClick={() => handleSnoozeDose(nextDoseItem.med.id, nextDoseItem.slot, nextDoseItem.med.name)}
              >
                Snooze 10m
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSkipDose(nextDoseItem.med.id, nextDoseItem.slot, nextDoseItem.med.name)}
              >
                {t('common.skip', 'Skip')}
              </Button>
            </div>
          ) : (
            <div className="mt-3 pt-3 border-t border-[#E6ECE8]">
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-blue-50/70 border border-blue-200 text-blue-900 text-xs">
                <Clock className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <span className="leading-snug">
                  Upcoming dose — <strong>{nextDoseTiming?.label}</strong>. Confirmation buttons unlock when the scheduled time arrives.
                </span>
              </div>
            </div>
          )}
        </Card>
      ) : (metrics.totalDoses > 0 && metrics.pendingDoses === 0) ? (
        <Card className="bg-[#DDEFE8]/40 border-[#238B78]/20 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#238B78] text-white flex items-center justify-center flex-shrink-0">
            <Check className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-semibold text-sm text-[#202B28]">All doses completed!</h4>
            <p className="text-xs text-[#7A8782]">You are fully up to date with today's medication routine.</p>
          </div>
        </Card>
      ) : medicines.filter(m => m.status === 'Active').length > 0 ? (
        <Card className="p-4 text-center bg-white space-y-2 border border-[#E6ECE8]">
          <Calendar className="w-8 h-8 text-[#238B78] mx-auto opacity-75" />
          <h4 className="font-semibold text-sm text-[#202B28]">No doses scheduled today</h4>
          <p className="text-xs text-[#7A8782] max-w-xs mx-auto">
            Your active medications have no remaining dose times scheduled for today.
          </p>
        </Card>
      ) : (
        <Card className="p-4 text-center bg-white space-y-2 border border-[#E6ECE8]">
          <Pill className="w-8 h-8 text-[#238B78] mx-auto opacity-75" />
          <h4 className="font-semibold text-sm text-[#202B28]">No active medications</h4>
          <p className="text-xs text-[#7A8782] max-w-xs mx-auto">
            Scan a paper prescription or manually add your medicines to build your daily routine.
          </p>
        </Card>
      )}

      {/* Weekly Compliance Chart Card */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-bold text-[#7A8782] uppercase tracking-wider flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-[#238B78]" /> Adherence Analytics
          </span>
          <button
            onClick={() => navigate('/history')}
            className="text-xs text-[#238B78] font-semibold flex items-center hover:underline cursor-pointer"
          >
            History & PDF Export <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <WeeklyComplianceChart compact={true} />
      </div>

      {/* Today's Schedule Preview */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold text-sm text-[#202B28]">Today's Medication List</h3>
          <button
            onClick={() => navigate('/schedule')}
            className="text-xs text-[#238B78] font-semibold flex items-center hover:underline cursor-pointer"
          >
            Full Schedule <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-2">
          {medicines.filter(m => m.status === 'Active').length === 0 ? (
            <Card className="text-center py-6 bg-white border border-[#E6ECE8]">
              <p className="text-xs text-[#7A8782]">No medications recorded for today.</p>
            </Card>
          ) : (
            medicines.filter(m => m.status === 'Active').slice(0, 3).map((med) => {
            const firstSlot = med.timeSlots?.[0] || "Routine";
            const doseStatus = getDoseStatus(med.id, firstSlot);
            const isTaken = doseStatus?.status === 'taken';
            const isSkipped = doseStatus?.status === 'skipped';

            return (
              <Card 
                key={med.id}
                hoverable
                onClick={() => navigate(`/medicines/${med.id}`)}
                className="flex items-center justify-between p-3.5"
              >
                <div className="flex items-center gap-3">
                  <div 
                    className="w-3 h-10 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: med.color || '#238B78' }}
                  />
                  <div>
                    <h4 className="font-semibold text-sm text-[#202B28]">{med.name}</h4>
                    <p className="text-xs text-[#7A8782]">{med.dosage} • {firstSlot}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  {isTaken && (
                    <Badge variant="success" icon={Check}>Taken</Badge>
                  )}
                  {isSkipped && (
                    <Badge variant="danger">Skipped</Badge>
                  )}
                  {!isTaken && !isSkipped && (
                    <button
                      onClick={() => handleTakeDose(med.id, firstSlot, med.name)}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-[#DDEFE8] text-[#1b6d5e] hover:bg-[#238B78] hover:text-white transition-colors cursor-pointer"
                    >
                      Take
                    </button>
                  )}
                </div>
              </Card>
            );
          }))}
        </div>
      </div>
    </div>
  );
}
