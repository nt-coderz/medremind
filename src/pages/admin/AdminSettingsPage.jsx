import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { ShieldCheck, LogOut, Lock, Server, FileText, Database, Activity, RefreshCw } from 'lucide-react';
import { getBackendBaseUrl, apiFetch } from '../../config/apiConfig';
import { toast } from 'sonner';

export default function AdminSettingsPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [healthData, setHealthData] = useState(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [customUrl, setCustomUrl] = useState(() => localStorage.getItem('medremind_backend_url') || '');
  const [showUrlEditor, setShowUrlEditor] = useState(false);

  const handleLogout = () => {
    logout();
    toast.info('Signed out of Administrator session');
    navigate('/welcome');
  };

  const handleCheckHealth = async () => {
    setIsCheckingHealth(true);
    try {
      const res = await apiFetch('/health');
      if (res.ok) {
        const data = await res.json();
        setHealthData(data);
        toast.success(`Backend Online! DB: ${data.database?.type || 'Connected'}`);
      } else {
        toast.error(`Backend returned status ${res.status}`);
      }
    } catch (err) {
      toast.error(err.message || 'Unable to connect to backend');
    } finally {
      setIsCheckingHealth(false);
    }
  };

  const handleTriggerBackup = async () => {
    setIsBackingUp(true);
    try {
      const res = await apiFetch('/admin/backup', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        toast.success(`Backup saved: ${data.backupFile}`);
      } else {
        toast.error('Backup request failed');
      }
    } catch (err) {
      toast.error(err.message || 'Backup failed');
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleSaveCustomUrl = () => {
    if (customUrl.trim()) {
      localStorage.setItem('medremind_backend_url', customUrl.trim());
      toast.success('Backend endpoint updated');
    } else {
      localStorage.removeItem('medremind_backend_url');
      toast.info('Reset to default production endpoint');
    }
    setShowUrlEditor(false);
  };

  return (
    <div className="p-4 space-y-4">
      {/* Administrator Profile Card */}
      <Card className="flex items-center gap-4 bg-gray-900 text-white p-4">
        <div className="w-14 h-14 rounded-2xl bg-[#238B78] text-white flex items-center justify-center text-xl font-bold shadow-md">
          AD
        </div>
        <div>
          <h2 className="text-lg font-bold">System Administrator</h2>
          <p className="text-xs text-gray-300">User ID: ADMIN</p>
          <Badge variant="neutral" size="sm" className="mt-1.5 bg-gray-800 text-emerald-400 border-gray-700">
            ROOT PRODUCTION ACCESS
          </Badge>
        </div>
      </Card>

      {/* Cloud Backend & Database Management */}
      <Card className="space-y-3 bg-white">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-xs uppercase tracking-wider text-[#202B28] flex items-center gap-1.5">
            <Server className="w-4 h-4 text-[#238B78]" /> Cloud Backend & Database
          </h3>
          <Badge variant="success" size="sm">LIVE</Badge>
        </div>
        <div className="text-xs text-[#7A8782] space-y-1 bg-[#F8FAF8] p-2.5 rounded-xl border border-[#E6ECE8]">
          <p className="truncate"><strong>Endpoint:</strong> <code className="text-[#238B78] font-mono text-[11px]">{getBackendBaseUrl()}</code></p>
          {healthData && (
            <div className="pt-1.5 border-t border-[#E6ECE8] text-[11px] space-y-0.5">
              <p><strong>DB Engine:</strong> {healthData.database?.type} ({healthData.database?.status})</p>
              <p><strong>Gemini Model:</strong> {healthData.geminiModel} ({healthData.geminiConfigured ? 'Key Configured' : 'Missing Key'})</p>
              <p><strong>Records:</strong> {healthData.database?.recordCounts?.users} Users, {healthData.database?.recordCounts?.medications} Meds</p>
              <p><strong>Server Uptime:</strong> {healthData.uptime}s</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            icon={Activity}
            loading={isCheckingHealth}
            onClick={handleCheckHealth}
          >
            Check Health
          </Button>
          <Button
            variant="outline"
            size="sm"
            icon={Database}
            loading={isBackingUp}
            onClick={handleTriggerBackup}
          >
            Create Backup
          </Button>
        </div>

        {showUrlEditor ? (
          <div className="space-y-2 pt-1 border-t border-gray-100">
            <input
              type="text"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              placeholder="https://your-backend.onrender.com"
              className="w-full text-xs p-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-1 focus:ring-[#238B78]"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveCustomUrl} className="flex-1">
                Save Endpoint
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowUrlEditor(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowUrlEditor(true)}
            className="text-[11px] text-[#238B78] hover:underline font-semibold block pt-0.5"
          >
            Configure Custom Backend URL
          </button>
        )}
      </Card>

      {/* Security Architecture & Role Isolation */}
      <Card className="space-y-2 bg-[#F8FAF8] border-[#E6ECE8]">
        <h3 className="font-bold text-xs uppercase tracking-wider text-[#202B28] flex items-center gap-1.5">
          <Lock className="w-4 h-4 text-[#238B78]" /> Security & Role Isolation
        </h3>
        <p className="text-xs text-[#7A8782] leading-relaxed">
          Server-side authentication enforced via signed HMAC tokens. Rate limiting (600 req/15min general, 40 req/15min auth), Helmet HTTP security headers, and password verification protect cloud API endpoints.
        </p>
      </Card>

      {/* Legal & Compliance Register */}
      <Card className="space-y-2 bg-white">
        <h3 className="font-bold text-xs uppercase tracking-wider text-[#202B28] flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-[#238B78]" /> Legal & Compliance Register
        </h3>
        <p className="text-xs text-[#7A8782]">
          Review statutory terms (v2026.1), DPDP Act policy, Gemini AI disclosure, and third-party license register.
        </p>
        <Button
          variant="outline"
          size="sm"
          fullWidth
          icon={FileText}
          onClick={() => navigate('/legal')}
        >
          Open Legal Centre
        </Button>
      </Card>

      {/* Team Sanjeevani Attribution */}
      <Card className="space-y-2 bg-gradient-to-br from-white to-emerald-50/40 border-[#E6ECE8]">
        <div className="p-3 rounded-2xl bg-gradient-to-br from-[#238B78] to-[#1b6d5e] text-white shadow-xs space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 block">
            Team Sanjeevani · Author Attribution
          </span>
          <p className="text-xs font-semibold text-white leading-relaxed">
            3 Class 11 boys from The Newtown School, Kolkata — Aryan Singhania, Tanishq Ghosh, and Naman Thard
          </p>
        </div>
      </Card>

      {/* Sign Out Action */}
      <div className="pt-2">
        <Button
          variant="outline"
          fullWidth
          icon={LogOut}
          onClick={handleLogout}
        >
          Sign Out of Admin Console
        </Button>
      </div>
    </div>
  );
}
