import React from 'react';
import { useMedicine } from '../../context/MedicineContext';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { Bell, CheckCircle, AlertTriangle, Info, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { notifications, markNotificationRead } = useMedicine();

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[#E6ECE8]">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-xs font-semibold text-[#7A8782] hover:text-[#202B28] cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <span className="text-xs font-bold text-[#238B78] uppercase tracking-wider">
          Notifications
        </span>
      </div>

      <div className="space-y-2.5">
        {notifications.length === 0 ? (
          <Card className="text-center py-8">
            <Bell className="w-10 h-10 text-[#7A8782]/40 mx-auto mb-2" />
            <h4 className="font-semibold text-sm text-[#202B28]">No new notifications</h4>
            <p className="text-xs text-[#7A8782] mt-1">You're all caught up!</p>
          </Card>
        ) : (
          notifications.map((notif) => (
            <Card
              key={notif.id}
              onClick={() => markNotificationRead(notif.id)}
              className={`p-3.5 space-y-1 transition-colors ${
                notif.read ? 'opacity-70 bg-white' : 'bg-emerald-50/20 border-emerald-100'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-[#202B28]">{notif.title}</span>
                <span className="text-[10px] text-[#7A8782]">{notif.time}</span>
              </div>
              <p className="text-xs text-[#7A8782] leading-relaxed">{notif.message}</p>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
