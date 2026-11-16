import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import { Activity, Clock, ShieldCheck, Filter } from 'lucide-react';
import { formatShortUserId } from '../../utils/idGenerator';

export default function AdminActivityPage() {
  const { systemActivity } = useAuth();
  const [filterType, setFilterType] = useState('ALL');

  const filteredLogs = systemActivity.filter(log => {
    if (filterType === 'ALL') return true;
    return log.type.includes(filterType);
  });

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-[#202B28]">System Audit Log</h1>
        <p className="text-xs text-[#7A8782]">Real-time operational activity feed</p>
      </div>

      {/* Filter Chips */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {['ALL', 'LOGIN', 'DOSE', 'PRESCRIPTION', 'REGISTRATION'].map((type) => (
          <button
            key={type}
            onClick={() => setFilterType(type)}
            className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg whitespace-nowrap cursor-pointer transition-colors ${
              filterType === type
                ? 'bg-[#202B28] text-white'
                : 'bg-white border border-[#E6ECE8] text-[#7A8782] hover:text-[#202B28]'
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Log Feed */}
      <div className="space-y-2">
        {filteredLogs.length === 0 ? (
          <Card className="text-center py-8 bg-white">
            <Activity className="w-8 h-8 text-[#7A8782]/40 mx-auto mb-2" />
            <h4 className="font-semibold text-xs text-[#202B28]">No activity events found</h4>
            <p className="text-[11px] text-[#7A8782] mt-0.5">Events will appear here as users perform actions.</p>
          </Card>
        ) : (
          filteredLogs.map((item) => (
            <Card key={item.id} className="p-3.5 space-y-1 bg-white">
              <div className="flex items-center justify-between">
                <Badge variant="neutral" size="sm" className="font-mono text-[10px]">
                  {item.type}
                </Badge>
                <span className="text-[10px] text-[#7A8782] flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {item.timestamp}
                </span>
              </div>

              <div className="pt-1">
                <h4 className="font-bold text-xs text-[#202B28]">{item.user}</h4>
                <p className="text-xs text-[#7A8782] mt-0.5 leading-relaxed">{item.details}</p>
                {item.userId && (
                  <span className="text-[10px] text-[#238B78] font-mono block mt-1">
                    ID: {formatShortUserId(item.userId)}
                  </span>
                )}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
