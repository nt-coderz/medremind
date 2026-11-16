import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useMedicine } from '../../context/MedicineContext';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import { ArrowLeft, Save, Clock, Plus, X, Sparkles, Camera, AlertTriangle, Database } from 'lucide-react';
import { checkDrugAllergyConflict } from '../../utils/drugKnowledgeBase';
import { searchIndianMedicines } from '../../utils/indianMedicineService';
import { toast } from 'sonner';

function format24to12(time24) {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 || 12;
  const displayM = m.toString().padStart(2, '0');
  return `${displayH.toString().padStart(2, '0')}:${displayM} ${ampm}`;
}

export default function AddEditMedicinePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const prefill = location.state?.prefill || null;
  const { medicines, addMedicine, updateMedicine, patientProfile } = useMedicine();
  const isEditing = Boolean(id);

  const existingMed = isEditing ? medicines.find(m => m.id === id) : null;

  const [name, setName] = useState(existingMed?.name || prefill?.name || '');
  const [dosage, setDosage] = useState(existingMed?.dosage || prefill?.dosage || prefill?.strength || '');
  const [form, setForm] = useState(existingMed?.form || prefill?.form || 'Tablet');
  const [frequency, setFrequency] = useState(existingMed?.frequency || prefill?.frequency || 'Once daily');
  
  const allergyConflict = checkDrugAllergyConflict(name, patientProfile?.allergies || []);
  
  // Custom Arbitrary Times List (e.g. ['07:05 AM', '01:35 PM', '11:45 PM'])
  const [timesList, setTimesList] = useState(() => {
    if (existingMed?.timeSlots && existingMed.timeSlots.length > 0) {
      return existingMed.timeSlots;
    }
    if (existingMed?.times && existingMed.times.length > 0) {
      return existingMed.times.map(t => t.includes('M') ? t : format24to12(t));
    }
    return ['08:00 AM'];
  });

  const [newTime, setNewTime] = useState('08:00');
  const [instructions, setInstructions] = useState(existingMed?.instructions || prefill?.instructions || '');
  const [prescribedBy, setPrescribedBy] = useState(existingMed?.prescribedBy || prefill?.prescribedBy || '');

  // Indian Medical Database Suggestions
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    let active = true;
    if (name.trim().length >= 2) {
      searchIndianMedicines(name).then(results => {
        if (active) {
          setSuggestions(results);
        }
      });
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
    return () => { active = false; };
  }, [name]);

  const handleSelectIndianMedicine = (med) => {
    setName(med.brand);
    if (med.strength) setDosage(med.strength);
    if (med.form) setForm(med.form);
    if (med.mfr) setPrescribedBy(med.mfr);
    if (med.class) setInstructions(`Therapeutic Class: ${med.class}. Take as directed by prescribing doctor.`);
    setShowSuggestions(false);
    toast.success(`Loaded "${med.brand}" from Indian Medicine Database`);
  };

  const handleAddTime = (timeStr) => {
    const formatted = timeStr.includes('M') ? timeStr : format24to12(timeStr);
    if (!timesList.includes(formatted)) {
      setTimesList(prev => [...prev, formatted]);
    } else {
      toast.info('This timing is already in the schedule.');
    }
  };

  const handleRemoveTime = (timeToRemove) => {
    if (timesList.length <= 1) {
      toast.warning('Medication schedule must have at least one dose timing.');
      return;
    }
    setTimesList(prev => prev.filter(t => t !== timeToRemove));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name || !dosage) {
      toast.error('Medicine name and dosage are required');
      return;
    }

    if (timesList.length === 0) {
      toast.error('Please add at least one dose timing');
      return;
    }

    const payload = {
      name,
      dosage,
      form,
      frequency,
      timeSlots: timesList,
      times: timesList,
      instructions,
      prescribedBy,
      color: existingMed?.color || '#238B78'
    };

    if (isEditing) {
      updateMedicine(id, payload);
      toast.success('Medicine updated successfully');
      navigate(`/medicines/${id}`);
    } else {
      const created = addMedicine(payload);
      toast.success(`${created.name} added to your schedule!`);
      navigate('/medicines');
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[#E6ECE8]">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-xs font-semibold text-[#7A8782] hover:text-[#202B28] cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Cancel
        </button>
        <span className="text-xs font-bold text-[#238B78] uppercase tracking-wider">
          {isEditing ? 'Edit Medicine' : 'Add New Medicine'}
        </span>
      </div>

      {!isEditing && !prefill && (
        <Card className="p-3 bg-gradient-to-r from-[#DDEFE8]/60 to-white border border-[#238B78]/20 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#238B78] text-white flex items-center justify-center shrink-0">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-[#202B28]">Have a prescription or medicine strip?</h4>
              <p className="text-[11px] text-[#7A8782]">Scan it to prefill details automatically</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate('/scanner')}
          >
            Scan Now
          </Button>
        </Card>
      )}

      {prefill && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-xs text-emerald-900">
          <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Prefilled from Medicine Strip Scan</span>
            <p className="text-[11px] text-emerald-700 mt-0.5">
              Review details below, pick dose timings, and save to your medication routine.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card className="space-y-3.5">
          <div className="relative">
            <Input
              label="Medicine Name"
              placeholder="e.g. Augmentin, Dolo 650, Azithral, Telma"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => {
                if (suggestions.length > 0) setShowSuggestions(true);
              }}
            />

            {/* Indian Medicine Database Auto-Suggest Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-white rounded-2xl shadow-xl border border-emerald-200 max-h-60 overflow-y-auto divide-y divide-gray-100 p-1">
                <div className="px-3 py-1.5 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl text-[10px] font-bold text-emerald-800 flex items-center justify-between sticky top-0">
                  <span className="flex items-center gap-1">
                    <Database className="w-3 h-3 text-emerald-600" />
                    Indian Medical Database (250,000+ Verified)
                  </span>
                  <button 
                    type="button" 
                    onClick={() => setShowSuggestions(false)} 
                    className="text-gray-400 hover:text-gray-700 cursor-pointer font-bold px-1"
                  >
                    ✕
                  </button>
                </div>
                {suggestions.map((med, idx) => (
                  <button
                    key={`${med.brand}-${idx}`}
                    type="button"
                    onClick={() => handleSelectIndianMedicine(med)}
                    className="w-full text-left p-2.5 hover:bg-emerald-50/70 rounded-xl transition-colors cursor-pointer flex items-start justify-between gap-2"
                  >
                    <div>
                      <div className="font-bold text-xs text-[#202B28]">{med.brand}</div>
                      <div className="text-[11px] text-emerald-700 font-medium">
                        {med.generic} {med.strength && `(${med.strength})`}
                      </div>
                      <div className="text-[10px] text-gray-500">
                        {med.mfr} {med.class && `• ${med.class}`}
                      </div>
                    </div>
                    {med.price && (
                      <span className="text-xs font-bold text-emerald-800 shrink-0 bg-emerald-100/70 px-2 py-0.5 rounded-lg">
                        ₹{med.price}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Dosage"
              placeholder="e.g. 500 mg, 10 ml"
              value={dosage}
              onChange={(e) => setDosage(e.target.value)}
            />
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#202B28] uppercase tracking-wider">
                Form
              </label>
              <select
                value={form}
                onChange={(e) => setForm(e.target.value)}
                className="w-full rounded-xl bg-white border border-[#E6ECE8] px-3 py-2.5 text-xs text-[#202B28] focus:outline-none focus:border-[#238B78]"
              >
                <option value="Tablet">Tablet</option>
                <option value="Capsule">Capsule</option>
                <option value="Liquid">Liquid</option>
                <option value="Injection">Injection</option>
                <option value="Inhaler">Inhaler</option>
                <option value="Topical">Topical</option>
                <option value="Drops">Drops</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Frequency"
              placeholder="e.g. Once daily, Twice daily"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
            />
            <Input
              label="Doctor / Prescriber"
              placeholder="e.g. Dr. Jane Smith"
              value={prescribedBy}
              onChange={(e) => setPrescribedBy(e.target.value)}
            />
          </div>

          {/* Arbitrary Custom Timings Selector */}
          <div className="space-y-2 pt-1">
            <label className="block text-xs font-semibold text-[#202B28] uppercase tracking-wider">
              Dose Timings & Alarms ({timesList.length})
            </label>
            <p className="text-[11px] text-[#7A8782]">
              Set exact arbitrary minutes for daily alarms (e.g. 7:05 AM, 1:35 PM, 11:45 PM).
            </p>

            {/* Selected Times Chips */}
            <div className="flex flex-wrap gap-2 pt-1 pb-2">
              {timesList.map((time, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#DDEFE8] text-[#1b6d5e] text-xs font-semibold border border-[#238B78]/30 shadow-xs"
                >
                  <Clock className="w-3.5 h-3.5" />
                  {time}
                  <button
                    type="button"
                    onClick={() => handleRemoveTime(time)}
                    className="hover:text-red-600 p-0.5 rounded cursor-pointer transition-colors"
                    title="Remove timing"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>

            {/* Time Picker & Quick Add */}
            <div className="p-3 rounded-xl bg-[#F8FAF8] border border-[#E6ECE8] space-y-2.5">
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-white border border-[#E6ECE8] text-xs font-mono font-bold text-[#202B28] focus:outline-none focus:border-[#238B78]"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  icon={Plus}
                  onClick={() => handleAddTime(newTime)}
                >
                  Add Custom Time
                </Button>
              </div>

              {/* Quick Presets */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="text-[10px] text-[#7A8782] w-full block">Quick Presets:</span>
                {[
                  { label: '08:00 AM (Morning)', time: '08:00' },
                  { label: '01:30 PM (Lunch)', time: '13:30' },
                  { label: '07:05 PM (Dinner)', time: '19:05' },
                  { label: '10:00 PM (Bedtime)', time: '22:00' }
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => handleAddTime(preset.time)}
                    className="px-2 py-1 rounded-lg bg-white border border-[#E6ECE8] text-[10px] text-[#202B28] font-medium hover:border-[#238B78] hover:bg-[#DDEFE8]/30 cursor-pointer"
                  >
                    + {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#202B28] uppercase tracking-wider">
              Instructions / Notes
            </label>
            <textarea
              rows={3}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="e.g. Take with food, drink full glass of water."
              className="w-full rounded-xl bg-white border border-[#E6ECE8] p-3 text-xs text-[#202B28] focus:outline-none focus:border-[#238B78]"
            />
          </div>
        </Card>

        {allergyConflict && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border-2 border-rose-300 text-rose-950 flex items-start gap-2.5 shadow-sm animate-in fade-in">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-xs uppercase tracking-wide text-rose-900">
                Allergy Warning Detected
              </h4>
              <p className="text-xs text-rose-800 mt-0.5 leading-relaxed">
                Your medical profile documents an allergy to <strong>{allergyConflict}</strong>. 
                Taking <strong>{name}</strong> may trigger an allergic reaction or cross-reactivity. 
                Please consult your physician before taking.
              </p>
            </div>
          </div>
        )}

        <Button type="submit" fullWidth size="lg" icon={Save}>
          {isEditing ? 'Save Changes' : 'Add to Medication Schedule'}
        </Button>
      </form>
    </div>
  );
}
