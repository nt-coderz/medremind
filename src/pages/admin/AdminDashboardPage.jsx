import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useMedicine } from '../../context/MedicineContext';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import { 
  Users, 
  UserCheck, 
  Stethoscope, 
  Pill, 
  Activity, 
  ShieldCheck, 
  Server, 
  ChevronRight,
  Clock
} from 'lucide-react';
import { formatShortUserId } from '../../utils/idGenerator';

export default function AdminDashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { registeredUsers, systemActivity } = useAuth();
  const { medicines } = useMedicine();

  const totalUsers = registeredUsers.length;
  const patientsCount = registeredUsers.filter(u => u.role === 'patient').length;
  const activeCount = registeredUsers.filter(u => u.status === 'Active').length;

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[#238B78]" /> {t('admin.title', 'MedRemind Admin Console')}
          </span>
          <h1 className="text-xl font-bold text-[#202B28] mt-0.5">{t('admin.systemOverview', 'System Overview')}</h1>
          <p className="text-xs text-[#7A8782]">{t('admin.metricsDescription', 'Platform metrics and user management')}</p>
        </div>
      </div>

      {/* Security Disclaimer Banner */}
      <div className="p-3 rounded-2xl bg-gray-50 border border-gray-200 text-xs text-gray-700 leading-relaxed">
        <strong className="font-semibold block text-gray-900">{t('admin.demoEnvironment', 'Frontend Demonstration Environment')}</strong>
        {t('admin.demoNotice', 'Administrative controls and synthetic data are for interface demonstration. Backend API authorization will enforce confidential data boundaries in production.')}
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 gap-2.5">
        <Card className="p-3.5 bg-white space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#7A8782]">{t('admin.totalUsers', 'Total Users')}</span>
            <Users className="w-4 h-4 text-[#238B78]" />
          </div>
          <span className="text-2xl font-bold text-[#202B28] block">{totalUsers}</span>
          <span className="text-[10px] text-emerald-600 font-medium">● {activeCount} {t('common.active', 'Active')}</span>
        </Card>

        <Card className="p-3.5 bg-white space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#7A8782]">{t('admin.patients', 'Patients')}</span>
            <UserCheck className="w-4 h-4 text-blue-600" />
          </div>
          <span className="text-2xl font-bold text-[#202B28] block">{patientsCount}</span>
          <span className="text-[10px] text-[#7A8782]">{t('admin.registeredPatients', 'Registered Patients')}</span>
        </Card>

        <Card className="p-3.5 bg-white space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#7A8782]">{t('admin.activeAccounts', 'Active Accounts')}</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <span className="text-2xl font-bold text-[#202B28] block">{activeCount}</span>
          <span className="text-[10px] text-emerald-600">{t('admin.activeStatus', 'Active Status')}</span>
        </Card>

        <Card className="p-3.5 bg-white space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#7A8782]">{t('admin.medications', 'Medications')}</span>
            <Pill className="w-4 h-4 text-amber-600" />
          </div>
          <span className="text-2xl font-bold text-[#202B28] block">{medicines.length}</span>
          <span className="text-[10px] text-[#7A8782]">{t('admin.activePrescriptions', 'Active Prescriptions')}</span>
        </Card>
      </div>

      {/* System Status Card */}
      <Card className="p-3.5 bg-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Server className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold text-[#202B28] block">Capacitor Native Engine</span>
            <span className="text-[11px] text-emerald-600 font-medium">Android Platform Ready</span>
          </div>
        </div>
        <Badge variant="success" size="sm">Online</Badge>
      </Card>

      {/* Recent User Registrations */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-[#202B28]">{t('admin.users', 'User Accounts')}</h3>
          <button
            onClick={() => navigate('/admin/users')}
            className="text-xs text-[#238B78] font-semibold flex items-center hover:underline cursor-pointer"
          >
            Manage Users <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-2">
          {registeredUsers.length === 0 ? (
            <Card className="text-center py-6 text-xs text-[#7A8782] bg-white">
              No registered user accounts found.
            </Card>
          ) : (
            registeredUsers.slice(0, 3).map((u) => (
              <Card key={u.id} className="p-3 flex items-center justify-between bg-white">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs text-white ${
                    u.role === 'admin' ? 'bg-gray-800' : 'bg-[#238B78]'
                  }`}>
                    {u.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div>
                    <h4 className="font-semibold text-xs text-[#202B28]">{u.name}</h4>
                    <p className="text-[10px] text-[#7A8782]">{formatShortUserId(u.id)} • {u.role}</p>
                  </div>
                </div>
                <Badge variant={u.status === 'Active' ? 'success' : 'neutral'} size="sm">
                  {u.status}
                </Badge>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Recent Audit Log */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-[#202B28]">{t('admin.auditLog', 'Recent Audit Events')}</h3>
          <button
            onClick={() => navigate('/admin/activity')}
            className="text-xs text-[#238B78] font-semibold flex items-center hover:underline cursor-pointer"
          >
            Full Log <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-1.5">
          {systemActivity.length === 0 ? (
            <div className="p-4 rounded-xl bg-white border border-[#E6ECE8] text-center text-xs text-[#7A8782]">
              No audit events logged yet.
            </div>
          ) : (
            systemActivity.slice(0, 3).map((act) => (
              <div key={act.id} className="p-2.5 rounded-xl bg-white border border-[#E6ECE8] text-xs space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#202B28]">{act.user}</span>
                  <span className="text-[10px] text-[#7A8782]">{act.timestamp}</span>
                </div>
                <p className="text-[11px] text-[#7A8782]">{act.details}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
