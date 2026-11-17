import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMedicine } from '../../context/MedicineContext';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { Check, X, RotateCcw, Clock, CalendarDays, Sun, Sunset, Moon, Coffee, TrendingUp } from 'lucide-react';
import { format, addDays, startOfWeek } from 'date-fns';
import { toast } from 'sonner';

export default function SchedulePage() {
  const navigate = useNavigate();
  const { medicines, getDoseStatus, recordDose, resetDose } = useMedicine();
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Generate 7 days for the date selector strip
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));

  const timeSlots = [
    { name: 'Morning', time: '8:00 AM', icon: Coffee },
    { name: 'Afternoon', time: '1:00 PM', icon: Sun },
    { name: 'Evening', time: '7:00 PM', icon: Sunset },
    { name: 'Night', time: '10:00 PM', icon: Moon }
  ];

  const handleTake = (medId, slotString, medName) => {
    recordDose(medId, slotString, 'taken');
    toast.success(`Dose recorded: ${medName} taken.`);
  };

  const handleSkip = (medId, slotString, medName) => {
    recordDose(medId, slotString, 'skipped');
    toast.warning(`Dose recorded: ${medName} skipped.`);
  };

  const handleUndo = (medId, slotString, medName) => {
    resetDose(medId, slotString);
    toast.info(`Reset dose status for ${medName}.`);
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#202B28]">Daily Medication Schedule</h1>
          <p className="text-xs text-[#7A8782]">{format(selectedDate, 'EEEE, MMMM d, yyyy')}</p>
        </div>
        <button
          onClick={() => navigate('/history')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#E6ECE8] text-xs font-semibold text-[#238B78] hover:bg-[#DDEFE8]/40 transition-colors shadow-xs"
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>History & PDF</span>
        </button>
      </div>

      {/* Week Day Selector Strip */}
      <div className="flex justify-between items-center bg-white p-2 rounded-2xl border border-[#E6ECE8] shadow-xs">
        {weekDays.map((day) => {
          const isSelected = format(day, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
          const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

          return (
            <button
              key={day.toISOString()}
              onClick={() => setSelectedDate(day)}
              className={`flex flex-col items-center py-2 px-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                isSelected
                  ? 'bg-[#238B78] text-white shadow-xs'
                  : 'text-[#7A8782] hover:bg-[#F8FAF8]'
              }`}
            >
              <span className="text-[10px] font-medium opacity-80">{format(day, 'EEE')}</span>
              <span className="text-sm mt-0.5">{format(day, 'd')}</span>
              {isToday && !isSelected && (
                <span className="w-1 h-1 rounded-full bg-[#238B78] mt-1" />
              )}
            </button>
          );
        })}
      </div>

      {/* Time-based Medication Slots */}
      <div className="space-y-4">
        {timeSlots.map((slot) => {
          const SlotIcon = slot.icon;
          // Find medicines mapped to this time period
          const slotMeds = medicines.filter(m => 
            m.status === 'Active' && 
            (m.timeSlots || []).some(ts => ts.toLowerCase().includes(slot.name.toLowerCase()))
          );

          return (
            <div key={slot.name} className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-[#7A8782] uppercase tracking-wider px-1">
                <span className="flex items-center gap-1.5 text-[#202B28]">
                  <SlotIcon className="w-4 h-4 text-[#238B78]" />
                  {slot.name} ({slot.time})
                </span>
                <span>{slotMeds.length} meds</span>
              </div>

              {slotMeds.length === 0 ? (
                <div className="p-3 bg-white/60 rounded-xl border border-dashed border-[#E6ECE8] text-center text-xs text-[#7A8782]">
                  No medications scheduled for {slot.name.toLowerCase()}.
                </div>
              ) : (
                slotMeds.map((med) => {
                  const fullSlotString = `${slot.name} (${slot.time})`;
                  const matchingSlotLabel = (med.timeSlots || []).find(ts =>
                    ts.toLowerCase().includes(slot.name.toLowerCase())
                  );
                  const doseStatus = getDoseStatus(med.id, fullSlotString) ||
                    getDoseStatus(med.id, matchingSlotLabel) ||
                    getDoseStatus(med.id, med.timeSlots?.[0]);
                  const isTaken = doseStatus?.status === 'taken';
                  const isSkipped = doseStatus?.status === 'skipped';
                  const isPending = !isTaken && !isSkipped;

                  return (
                    <Card key={med.id} className="p-3.5 space-y-3 bg-white">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-sm text-[#202B28]">{med.name}</h3>
                            <span className="text-xs text-[#7A8782]">{med.dosage}</span>
                          </div>
                          <p className="text-[11px] text-[#7A8782] mt-0.5">{med.instructions}</p>
                        </div>

                        {/* Status Badge */}
                        {isTaken && <Badge variant="success" icon={Check}>Taken at {doseStatus.timestamp}</Badge>}
                        {isSkipped && <Badge variant="danger" icon={X}>Skipped</Badge>}
                        {isPending && <Badge variant="warning">Pending</Badge>}
                      </div>

                      {/* Interactive Dose Actions */}
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E6ECE8]">
                        {isPending && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              icon={X}
                              onClick={() => handleSkip(med.id, fullSlotString, med.name)}
                            >
                              Skip
                            </Button>
                            <Button
                              variant="primary"
                              size="sm"
                              icon={Check}
                              onClick={() => handleTake(med.id, fullSlotString, med.name)}
                            >
                              Take Dose
                            </Button>
                          </>
                        )}

                        {!isPending && (
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={RotateCcw}
                            onClick={() => handleUndo(med.id, fullSlotString, med.name)}
                          >
                            Undo
                          </Button>
                        )}
                      </div>
                    </Card>
                  );
                })
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
