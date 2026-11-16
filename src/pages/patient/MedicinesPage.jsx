import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMedicine } from '../../context/MedicineContext';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { Search, Plus, Pill, ChevronRight, Clock, Power, Camera, Database } from 'lucide-react';
import { toast } from 'sonner';

export default function MedicinesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { medicines, toggleMedicineActive } = useMedicine();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTab, setFilterTab] = useState('All');

  const filteredMedicines = medicines.filter(med => {
    const matchesSearch = med.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          med.dosage.toLowerCase().includes(searchTerm.toLowerCase());
    if (filterTab === 'Active') return matchesSearch && med.status === 'Active';
    if (filterTab === 'Inactive') return matchesSearch && med.status === 'Inactive';
    return matchesSearch;
  });

  const handleToggleActive = (e, med) => {
    e.stopPropagation();
    toggleMedicineActive(med.id);
    const nextState = med.status === 'Inactive' ? 'activated' : 'deactivated';
    toast.success(`${med.name} ${nextState}.`);
  };

  return (
    <div className="p-4 space-y-4">
      {/* Title & Actions */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h1 className="text-xl font-bold text-[#202B28]">{t('medicines.myMedicines', 'Your Medications')}</h1>
          <p className="text-xs text-[#7A8782]">{medicines.length} total recorded items</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            icon={Camera}
            onClick={() => navigate('/scanner')}
          >
            {t('medicines.scanPrescription', 'Scan Prescription')}
          </Button>
          <Button
            size="sm"
            icon={Plus}
            onClick={() => navigate('/medicines/add')}
          >
            {t('medicines.addMedicine', 'Add Medicine')}
          </Button>
        </div>
      </div>

      {/* Indian Medical Database Notice Banner */}
      <div className="p-2.5 rounded-xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-white border border-emerald-200/70 flex items-center justify-between text-xs text-[#202B28]">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-[#238B78] shrink-0" />
          <span className="text-[11px] text-[#202B28] font-medium">
            <strong>250,000+ Indian Medicines:</strong> Search & verify brands, generics, forms & prices.
          </span>
        </div>
        <button
          onClick={() => navigate('/medicines/add')}
          className="text-[11px] font-bold text-[#238B78] hover:underline shrink-0 cursor-pointer ml-1"
        >
          Add / Search →
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7A8782]" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by medicine or dosage..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-[#E6ECE8] text-xs text-[#202B28] placeholder-[#7A8782]/60 focus:outline-none focus:border-[#238B78] focus:ring-2 focus:ring-[#238B78]/15"
        />
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-[#E6ECE8] pb-1">
        {['All', 'Active', 'Inactive'].map((tab) => (
          <button
            key={tab}
            onClick={() => setFilterTab(tab)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              filterTab === tab
                ? 'bg-[#238B78] text-white'
                : 'text-[#7A8782] hover:bg-[#E6ECE8]/40 hover:text-[#202B28]'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Medicine List */}
      <div className="space-y-2.5">
        {filteredMedicines.length === 0 ? (
          <Card className="text-center py-8 space-y-3">
            <Pill className="w-10 h-10 text-[#7A8782]/40 mx-auto" />
            <div>
              <h4 className="font-semibold text-sm text-[#202B28]">No medicines found</h4>
              <p className="text-xs text-[#7A8782] mt-1">Scan a paper prescription or add your medicines manually.</p>
            </div>
            <div className="flex justify-center gap-2 pt-1">
              <Button
                size="sm"
                icon={Camera}
                onClick={() => navigate('/scanner')}
              >
                Scan Prescription
              </Button>
              <Button
                variant="outline"
                size="sm"
                icon={Plus}
                onClick={() => navigate('/medicines/add')}
              >
                Add Manually
              </Button>
            </div>
          </Card>
        ) : (
          filteredMedicines.map((med) => {
            const isActive = med.status === 'Active';
            return (
              <Card
                key={med.id}
                hoverable
                onClick={() => navigate(`/medicines/${med.id}`)}
                className={`flex items-center justify-between p-4 transition-all ${
                  isActive ? 'bg-white' : 'bg-gray-50/70 border-gray-200 opacity-75'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0 flex-1 mr-2">
                  <div 
                    className={`w-3.5 h-12 rounded-full flex-shrink-0 mt-0.5 ${isActive ? '' : 'grayscale opacity-50'}`}
                    style={{ backgroundColor: med.color || '#238B78' }}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className={`font-bold text-sm truncate ${isActive ? 'text-[#202B28]' : 'text-gray-500 line-through'}`}>
                        {med.name}
                      </h3>
                      <Badge variant={isActive ? 'primary' : 'neutral'} size="sm">
                        {med.status || 'Active'}
                      </Badge>
                    </div>
                    <p className="text-xs text-[#7A8782] mt-0.5">{med.dosage} • {med.form || 'Tablet'}</p>
                    <p className="text-[11px] text-[#7A8782] flex items-center gap-1 mt-1 font-medium truncate">
                      <Clock className="w-3 h-3 text-[#238B78]" />
                      {med.frequency} ({(med.timeSlots || []).join(', ')})
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                  {/* Active / Inactive Toggle Switch */}
                  <button
                    type="button"
                    onClick={(e) => handleToggleActive(e, med)}
                    title={isActive ? 'Click to deactivate medication' : 'Click to reactivate medication'}
                    className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                      isActive 
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                        : 'border-gray-200 bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <Power className="w-3.5 h-3.5" />
                    <span>{isActive ? 'Active' : 'Paused'}</span>
                  </button>

                  <ChevronRight className="w-4 h-4 text-[#7A8782]/50" />
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
