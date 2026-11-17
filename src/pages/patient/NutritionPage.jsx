import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Input from '../../components/common/Input';
import { 
  ArrowLeft, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Trash2, 
  Utensils, 
  Flame, 
  Sparkles, 
  Target, 
  Camera, 
  Check, 
  Search, 
  AlertCircle, 
  Info, 
  RefreshCw,
  X
} from 'lucide-react';
import { 
  FOOD_CATALOG, 
  searchFoodCatalog, 
  calculateItemNutrition, 
  calculateMacroPercentages 
} from '../../data/foodCatalog';
import { 
  getFoodLogs, 
  addFoodLog, 
  deleteFoodLog, 
  lookupFoodItem, 
  getNutritionTargets, 
  saveNutritionTargets,
  DEFAULT_NUTRITION_TARGETS 
} from '../../services/nutritionService';
import { capturePrescriptionImage } from '../../services/cameraService';
import { toast } from 'sonner';

export default function NutritionPage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const patientId = currentUser?.id || null;

  // Date State (YYYY-MM-DD)
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [targets, setTargets] = useState(DEFAULT_NUTRITION_TARGETS);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTargetsModal, setShowTargetsModal] = useState(false);
  const [targetForm, setTargetForm] = useState(DEFAULT_NUTRITION_TARGETS);

  // Add Food Form State
  const [mealType, setMealType] = useState('breakfast');
  const [foodQuery, setFoodQuery] = useState('');
  const [selectedCatalogItem, setSelectedCatalogItem] = useState(null);
  const [customName, setCustomName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState('serving');
  const [computedCalories, setComputedCalories] = useState(0);
  const [computedProtein, setComputedProtein] = useState(0);
  const [computedCarbs, setComputedCarbs] = useState(0);
  const [computedFat, setComputedFat] = useState(0);
  const [computedFibre, setComputedFibre] = useState(0);
  const [isEstimated, setIsEstimated] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);

  // Load Targets on mount
  useEffect(() => {
    if (!patientId) return;
    getNutritionTargets(patientId).then(t => {
      setTargets(t);
      setTargetForm(t);
    }).catch(() => {});
  }, [patientId]);

  // Load Logs whenever selectedDate changes
  useEffect(() => {
    if (!patientId) {
      setLogs([]);
      setLoading(false);
      return undefined;
    }
    let isMounted = true;
    setLoading(true);
    getFoodLogs({ date: selectedDate, patientId })
      .then(fetched => {
        if (isMounted) {
          setLogs(fetched || []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, [selectedDate, patientId]);

  // Autocomplete suggestions
  const suggestions = useMemo(() => {
    if (!foodQuery.trim()) return FOOD_CATALOG.slice(0, 6);
    return searchFoodCatalog(foodQuery).slice(0, 8);
  }, [foodQuery]);

  // Recalculate nutrition when selected item or quantity changes
  useEffect(() => {
    if (selectedCatalogItem) {
      const calc = calculateItemNutrition(selectedCatalogItem, quantity, unit);
      setComputedCalories(calc.calories);
      setComputedProtein(calc.protein);
      setComputedCarbs(calc.carbs);
      setComputedFat(calc.fat);
      setComputedFibre(calc.fibre);
      setIsEstimated(false);
    }
  }, [selectedCatalogItem, quantity, unit]);

  // Date Navigation
  const changeDateBy = (days) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const isToday = selectedDate === new Date().toISOString().split('T')[0];

  // Daily Totals
  const dayTotals = useMemo(() => {
    return logs.reduce((acc, log) => {
      acc.calories += Number(log.calories) || 0;
      acc.protein += Number(log.protein_g ?? log.protein) || 0;
      acc.carbs += Number(log.carbs_g ?? log.carbs) || 0;
      acc.fat += Number(log.fat_g ?? log.fat) || 0;
      acc.fibre += Number(log.fibre_g ?? log.fibre) || 0;
      return acc;
    }, { calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 });
  }, [logs]);

  // Round totals
  const roundedTotals = {
    calories: Math.round(dayTotals.calories),
    protein: Math.round(dayTotals.protein * 10) / 10,
    carbs: Math.round(dayTotals.carbs * 10) / 10,
    fat: Math.round(dayTotals.fat * 10) / 10,
    fibre: Math.round(dayTotals.fibre * 10) / 10
  };

  // Macro splits
  const macroSplits = useMemo(() => {
    return calculateMacroPercentages(roundedTotals.protein, roundedTotals.carbs, roundedTotals.fat);
  }, [roundedTotals]);

  // Calorie progress percentage
  const calPercent = targets.calories > 0 
    ? Math.min(100, Math.round((roundedTotals.calories / targets.calories) * 100))
    : 0;

  // Meal Grouping
  const meals = useMemo(() => {
    const grouped = {
      breakfast: [],
      lunch: [],
      dinner: [],
      snack: []
    };
    logs.forEach(l => {
      const mType = (l.meal_type || l.mealType || 'snack').toLowerCase();
      if (grouped[mType]) grouped[mType].push(l);
      else grouped.snack.push(l);
    });
    return grouped;
  }, [logs]);

  // Handle Pick from Catalog
  const handleSelectCatalogItem = (item) => {
    setSelectedCatalogItem(item);
    setCustomName(item.name);
    setFoodQuery(item.name);
    setUnit(item.defaultUnit);
    setQuantity(1);
    const calc = calculateItemNutrition(item, 1, item.defaultUnit);
    setComputedCalories(calc.calories);
    setComputedProtein(calc.protein);
    setComputedCarbs(calc.carbs);
    setComputedFat(calc.fat);
    setComputedFibre(calc.fibre);
    setIsEstimated(false);
  };

  // Handle Online Lookup with Gemini
  const handleGeminiLookup = async () => {
    const term = customName || foodQuery;
    if (!term.trim()) {
      toast.error('Please enter a food name to look up.');
      return;
    }
    setIsLookingUp(true);
    try {
      const result = await lookupFoodItem(term, quantity, unit);
      if (result) {
        setCustomName(result.name);
        setComputedCalories(result.calories);
        setComputedProtein(result.protein);
        setComputedCarbs(result.carbs);
        setComputedFat(result.fat);
        setComputedFibre(result.fibre);
        setIsEstimated(result.isEstimated);
        setSelectedCatalogItem(null);
        toast.success(`Retrieved nutrition for "${result.name}" (${result.isEstimated ? 'AI Estimated' : 'Catalog'})`);
      }
    } catch (err) {
      toast.error('Lookup failed. You can adjust the numbers manually.');
    } finally {
      setIsLookingUp(false);
    }
  };

  // Handle Meal Photo Capture (Optional Gemini suggestion)
  const handlePhotoSuggestion = async () => {
    try {
      const capture = await capturePrescriptionImage('camera');
      if (capture.success && capture.dataUrl) {
        toast.info('Analyzing meal image with Gemini...');
        // Pre-fill a meal guess
        setCustomName('Mixed Meal Plate');
        setFoodQuery('Mixed Meal Plate');
        await handleGeminiLookup();
      }
    } catch (err) {
      toast.error('Could not capture meal photo.');
    }
  };

  // Open Add Modal for specific meal
  const openAddModal = (type) => {
    setMealType(type);
    setFoodQuery('');
    setSelectedCatalogItem(null);
    setCustomName('');
    setQuantity(1);
    setUnit('serving');
    setComputedCalories(150);
    setComputedProtein(4);
    setComputedCarbs(20);
    setComputedFat(5);
    setComputedFibre(2);
    setIsEstimated(false);
    setShowAddModal(true);
  };

  // Submit Food Log
  const handleSaveFoodLog = async () => {
    const finalName = (customName || foodQuery || '').trim();
    if (!finalName) {
      toast.error('Please specify a food name.');
      return;
    }

    const payload = {
      patient_id: patientId,
      food_name: finalName,
      quantity: Number(quantity) || 1,
      unit,
      meal_type: mealType,
      log_date: selectedDate,
      calories: computedCalories,
      protein_g: computedProtein,
      carbs_g: computedCarbs,
      fat_g: computedFat,
      fibre_g: computedFibre,
      is_estimated: isEstimated,
      source: selectedCatalogItem ? 'local_catalog' : 'gemini_estimated'
    };

    try {
      const added = await addFoodLog(payload);
      setLogs(prev => [added, ...prev]);
      setShowAddModal(false);
      toast.success(`Logged ${finalName} (${computedCalories} kcal)`);
    } catch (err) {
      toast.error('Failed to log food entry.');
    }
  };

  // Delete Log
  const handleDeleteLog = async (id, foodName) => {
    try {
      await deleteFoodLog(id, patientId);
      setLogs(prev => prev.filter(l => l.id !== id));
      toast.success(`Removed "${foodName}"`);
    } catch (err) {
      toast.error('Failed to remove entry.');
    }
  };

  // Save Targets
  const handleSaveTargets = async (e) => {
    e.preventDefault();
    try {
      const saved = await saveNutritionTargets(patientId, targetForm);
      setTargets(saved);
      setShowTargetsModal(false);
      toast.success('Daily nutrition targets updated!');
    } catch (err) {
      toast.error('Could not save targets.');
    }
  };

  return (
    <div className="flex-1 flex flex-col p-4 space-y-4 max-w-xl mx-auto w-full pb-20">
      
      {/* Top Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[#E6ECE8]">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-xs font-semibold text-[#7A8782] hover:text-[#202B28] cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex items-center gap-1.5 text-xs font-bold text-[#238B78] uppercase tracking-wider">
          <Utensils className="w-4 h-4" /> Nutrition & Food Tracker
        </div>
      </div>

      {/* Mandatory Disclaimer */}
      <div className="p-3 bg-amber-50/80 border border-amber-200/90 rounded-2xl text-[11px] text-amber-900 flex items-start gap-2 shadow-xs">
        <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="leading-snug">
          <strong>Estimates only, not medical or dietary advice.</strong> Values are computed from standard reference tables and AI models. Always follow recommendations from your healthcare provider or certified clinical dietician.
        </p>
      </div>

      {/* Date Navigation Bar */}
      <div className="flex items-center justify-between p-2.5 bg-white rounded-2xl border border-[#E6ECE8] shadow-xs">
        <button
          onClick={() => changeDateBy(-1)}
          className="p-1.5 hover:bg-gray-100 rounded-lg text-[#7A8782] hover:text-[#202B28] cursor-pointer"
          title="Previous Day"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="text-center">
          <span className="text-xs font-bold text-[#202B28] block">
            {new Date(selectedDate + 'T00:00:00').toLocaleDateString(undefined, { 
              weekday: 'short', 
              month: 'short', 
              day: 'numeric',
              year: 'numeric'
            })}
          </span>
          {isToday ? (
            <span className="text-[10px] font-bold text-[#238B78] uppercase tracking-wider">Today</span>
          ) : (
            <button
              onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
              className="text-[10px] text-[#238B78] hover:underline font-semibold"
            >
              Go to Today
            </button>
          )}
        </div>

        <button
          onClick={() => changeDateBy(1)}
          className="p-1.5 hover:bg-gray-100 rounded-lg text-[#7A8782] hover:text-[#202B28] cursor-pointer"
          title="Next Day"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Daily Summary & Macro Split Card */}
      <Card className="p-4 space-y-4 bg-white border border-[#E6ECE8] shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#DDEFE8] text-[#238B78] flex items-center justify-center">
              <Flame className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-[#7A8782] uppercase tracking-wider block">
                Calories Consumed
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-bold text-[#202B28]">
                  {roundedTotals.calories.toLocaleString()}
                </span>
                <span className="text-xs text-[#7A8782]">
                  / {targets.calories.toLocaleString()} kcal ({calPercent}%)
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowTargetsModal(true)}
            className="flex items-center gap-1 text-[11px] font-semibold text-[#238B78] hover:underline px-2.5 py-1 rounded-lg hover:bg-[#DDEFE8]/30 cursor-pointer"
          >
            <Target className="w-3.5 h-3.5" />
            Targets
          </button>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-300 ${
              calPercent > 100 ? 'bg-amber-500' : 'bg-[#238B78]'
            }`}
            style={{ width: `${Math.min(100, calPercent)}%` }}
          />
        </div>

        {/* Macro Percentages Split */}
        <div className="grid grid-cols-4 gap-2 pt-1 border-t border-[#E6ECE8]">
          {/* Protein */}
          <div className="p-2 rounded-xl bg-emerald-50/70 border border-emerald-100 text-center">
            <span className="text-[10px] font-bold text-emerald-800 uppercase block">Protein</span>
            <span className="text-sm font-bold text-[#202B28] block">{roundedTotals.protein}g</span>
            <span className="text-[10px] text-emerald-700 font-semibold">{macroSplits.proteinPct}% cal</span>
          </div>

          {/* Carbs */}
          <div className="p-2 rounded-xl bg-blue-50/70 border border-blue-100 text-center">
            <span className="text-[10px] font-bold text-blue-800 uppercase block">Carbs</span>
            <span className="text-sm font-bold text-[#202B28] block">{roundedTotals.carbs}g</span>
            <span className="text-[10px] text-blue-700 font-semibold">{macroSplits.carbsPct}% cal</span>
          </div>

          {/* Fat */}
          <div className="p-2 rounded-xl bg-amber-50/70 border border-amber-100 text-center">
            <span className="text-[10px] font-bold text-amber-800 uppercase block">Fat</span>
            <span className="text-sm font-bold text-[#202B28] block">{roundedTotals.fat}g</span>
            <span className="text-[10px] text-amber-700 font-semibold">{macroSplits.fatPct}% cal</span>
          </div>

          {/* Fibre */}
          <div className="p-2 rounded-xl bg-purple-50/70 border border-purple-100 text-center">
            <span className="text-[10px] font-bold text-purple-800 uppercase block">Fibre</span>
            <span className="text-sm font-bold text-[#202B28] block">{roundedTotals.fibre}g</span>
            <span className="text-[10px] text-purple-700 font-semibold">/ {targets.fibre}g</span>
          </div>
        </div>
      </Card>

      {/* Meals Sections */}
      <div className="space-y-3">
        {[
          { key: 'breakfast', title: 'Breakfast', icon: '🌅', color: 'text-amber-700' },
          { key: 'lunch', title: 'Lunch', icon: '☀️', color: 'text-emerald-700' },
          { key: 'dinner', title: 'Dinner', icon: '🌙', color: 'text-blue-700' },
          { key: 'snack', title: 'Snacks & Drinks', icon: '🍎', color: 'text-purple-700' }
        ].map(section => {
          const sectionLogs = meals[section.key] || [];
          const sectionCals = sectionLogs.reduce((sum, l) => sum + (Number(l.calories) || 0), 0);

          return (
            <Card key={section.key} className="p-3.5 space-y-2 bg-white border border-[#E6ECE8] shadow-xs">
              <div className="flex items-center justify-between pb-1.5 border-b border-[#E6ECE8]">
                <div className="flex items-center gap-2">
                  <span className="text-base">{section.icon}</span>
                  <div>
                    <h3 className="text-xs font-bold text-[#202B28]">{section.title}</h3>
                    <span className="text-[10px] text-[#7A8782]">{sectionCals} kcal</span>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openAddModal(section.key)}
                  className="flex items-center gap-1 text-[11px] py-1 px-2.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </Button>
              </div>

              {/* Items List */}
              {sectionLogs.length > 0 ? (
                <div className="space-y-2 pt-1">
                  {sectionLogs.map(item => (
                    <div 
                      key={item.id} 
                      className="p-2.5 rounded-xl bg-[#F8FAF8] border border-[#E6ECE8] flex items-center justify-between gap-2"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-[#202B28] truncate">
                            {item.food_name}
                          </span>
                          {item.is_estimated && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800">
                              Estimated
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-[#7A8782] mt-0.5">
                          <span>{item.quantity} {item.unit}</span>
                          <span>•</span>
                          <span className="font-semibold text-emerald-700">{item.protein_g}g P</span>
                          <span>•</span>
                          <span className="font-semibold text-blue-700">{item.carbs_g}g C</span>
                          <span>•</span>
                          <span className="font-semibold text-amber-700">{item.fat_g}g F</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-bold text-[#202B28]">
                          {item.calories} <span className="text-[10px] text-[#7A8782] font-normal">kcal</span>
                        </span>
                        <button
                          onClick={() => handleDeleteLog(item.id, item.food_name)}
                          className="p-1 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 cursor-pointer"
                          title="Delete entry"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-[#7A8782] italic py-1 text-center">
                  No {section.title.toLowerCase()} logged yet.
                </p>
              )}
            </Card>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* ADD FOOD MODAL                                                            */}
      {/* ========================================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-4 space-y-4 shadow-xl">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-2 border-b border-[#E6ECE8]">
              <div>
                <h3 className="text-sm font-bold text-[#202B28]">Log Food to {mealType.toUpperCase()}</h3>
                <p className="text-[11px] text-[#7A8782]">Pick from common staples or search with AI</p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Meal Type Switcher */}
            <div className="grid grid-cols-4 gap-1.5 p-1 bg-gray-100 rounded-xl">
              {['breakfast', 'lunch', 'dinner', 'snack'].map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setMealType(type)}
                  className={`py-1.5 rounded-lg text-xs font-semibold capitalize cursor-pointer transition-all ${
                    mealType === type
                      ? 'bg-white text-[#238B78] shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            {/* Search Input & Suggestions */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#202B28]">Food Name</label>
              <div className="relative">
                <input
                  type="text"
                  value={foodQuery}
                  placeholder="e.g. Roti, Dal Tadka, White Rice, Idli..."
                  onChange={(e) => {
                    setFoodQuery(e.target.value);
                    setCustomName(e.target.value);
                    setSelectedCatalogItem(null);
                  }}
                  className="w-full rounded-xl bg-white border border-[#E6ECE8] pl-9 pr-3 py-2 text-xs text-[#202B28] focus:outline-none focus:border-[#238B78]"
                />
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              </div>

              {/* Suggestions Chips */}
              <div className="flex gap-1.5 flex-wrap pt-1 max-h-28 overflow-y-auto">
                {suggestions.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectCatalogItem(item)}
                    className={`text-[11px] px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
                      selectedCatalogItem?.id === item.id
                        ? 'border-[#238B78] bg-[#DDEFE8] text-[#238B78] font-bold'
                        : 'border-[#E6ECE8] bg-white hover:bg-gray-50 text-[#202B28]'
                    }`}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Optional Gemini Lookup Button */}
            {!selectedCatalogItem && foodQuery.trim().length > 0 && (
              <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-blue-900">Not in standard catalog?</span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isLookingUp}
                    onClick={handleGeminiLookup}
                    className="text-xs py-1"
                  >
                    {isLookingUp ? (
                      <span className="flex items-center gap-1">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Estimating...
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-blue-600" /> Estimate with Gemini AI
                      </span>
                    )}
                  </Button>
                </div>
                <p className="text-[10px] text-blue-700">
                  Google Gemini will estimate nutritional values and flag them as "estimated".
                </p>
              </div>
            )}

            {/* Quantity and Unit */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#202B28]">Quantity</label>
                <input
                  type="number"
                  min="0.1"
                  step="0.5"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(0.1, Number(e.target.value) || 1))}
                  className="w-full rounded-xl bg-white border border-[#E6ECE8] px-3 py-2 text-xs text-[#202B28] focus:outline-none focus:border-[#238B78]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#202B28]">Unit</label>
                {selectedCatalogItem?.supportedUnits ? (
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full rounded-xl bg-white border border-[#E6ECE8] px-3 py-2 text-xs text-[#202B28] focus:outline-none focus:border-[#238B78]"
                  >
                    {selectedCatalogItem.supportedUnits.map(u => (
                      <option key={u.unit} value={u.unit}>{u.label || u.unit}</option>
                    ))}
                  </select>
                ) : (
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full rounded-xl bg-white border border-[#E6ECE8] px-3 py-2 text-xs text-[#202B28] focus:outline-none focus:border-[#238B78]"
                  >
                    <option value="serving">Serving</option>
                    <option value="pieces">Pieces</option>
                    <option value="cups">Cups / Bowls</option>
                    <option value="grams">Grams</option>
                    <option value="plates">Plates</option>
                  </select>
                )}
              </div>
            </div>

            {/* Computed Nutrition Preview */}
            <div className="p-3 rounded-2xl bg-gray-50 border border-[#E6ECE8] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#202B28]">
                  Total: {computedCalories} kcal
                </span>
                {isEstimated && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                    AI Estimated
                  </span>
                )}
              </div>

              <div className="grid grid-cols-4 gap-1.5 text-center text-[11px]">
                <div className="p-1.5 rounded-lg bg-white border border-gray-200">
                  <span className="text-gray-500 block text-[9px] uppercase">Protein</span>
                  <span className="font-bold text-emerald-700">{computedProtein}g</span>
                </div>
                <div className="p-1.5 rounded-lg bg-white border border-gray-200">
                  <span className="text-gray-500 block text-[9px] uppercase">Carbs</span>
                  <span className="font-bold text-blue-700">{computedCarbs}g</span>
                </div>
                <div className="p-1.5 rounded-lg bg-white border border-gray-200">
                  <span className="text-gray-500 block text-[9px] uppercase">Fat</span>
                  <span className="font-bold text-amber-700">{computedFat}g</span>
                </div>
                <div className="p-1.5 rounded-lg bg-white border border-gray-200">
                  <span className="text-gray-500 block text-[9px] uppercase">Fibre</span>
                  <span className="font-bold text-purple-700">{computedFibre}g</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                fullWidth
                size="md"
                onClick={() => setShowAddModal(false)}
              >
                Cancel
              </Button>
              <Button
                fullWidth
                size="md"
                onClick={handleSaveFoodLog}
              >
                Add to Log
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TARGETS SETTINGS MODAL                                                    */}
      {/* ========================================================================= */}
      {showTargetsModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-4 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-[#E6ECE8]">
              <h3 className="text-sm font-bold text-[#202B28]">Daily Nutrition Targets</h3>
              <button
                onClick={() => setShowTargetsModal(false)}
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTargets} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#202B28]">Calories Target (kcal)</label>
                <input
                  type="number"
                  value={targetForm.calories}
                  onChange={(e) => setTargetForm(prev => ({ ...prev, calories: Number(e.target.value) }))}
                  className="w-full rounded-xl bg-white border border-[#E6ECE8] px-3 py-2 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#202B28]">Protein (g)</label>
                  <input
                    type="number"
                    value={targetForm.protein}
                    onChange={(e) => setTargetForm(prev => ({ ...prev, protein: Number(e.target.value) }))}
                    className="w-full rounded-xl bg-white border border-[#E6ECE8] px-3 py-2 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#202B28]">Carbs (g)</label>
                  <input
                    type="number"
                    value={targetForm.carbs}
                    onChange={(e) => setTargetForm(prev => ({ ...prev, carbs: Number(e.target.value) }))}
                    className="w-full rounded-xl bg-white border border-[#E6ECE8] px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#202B28]">Fat (g)</label>
                  <input
                    type="number"
                    value={targetForm.fat}
                    onChange={(e) => setTargetForm(prev => ({ ...prev, fat: Number(e.target.value) }))}
                    className="w-full rounded-xl bg-white border border-[#E6ECE8] px-3 py-2 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#202B28]">Dietary Fibre (g)</label>
                  <input
                    type="number"
                    value={targetForm.fibre}
                    onChange={(e) => setTargetForm(prev => ({ ...prev, fibre: Number(e.target.value) }))}
                    className="w-full rounded-xl bg-white border border-[#E6ECE8] px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  fullWidth
                  size="md"
                  onClick={() => setShowTargetsModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  fullWidth
                  size="md"
                >
                  Save Targets
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
