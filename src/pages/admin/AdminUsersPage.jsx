import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import { 
  Search, 
  Copy, 
  Check, 
  User, 
  Trash2
} from 'lucide-react';
import { formatShortUserId } from '../../utils/idGenerator';
import { apiFetch, isOnline } from '../../config/apiConfig';
import { toast } from 'sonner';

export default function AdminUsersPage() {
  const { registeredUsers, updateUserStatus, refreshUsers } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [selectedUser, setSelectedUser] = useState(null);
  const [copiedId, setCopiedId] = useState('');
  const [deletionReason, setDeletionReason] = useState('');
  const [isProcessingDeletion, setIsProcessingDeletion] = useState(false);

  const filteredUsers = registeredUsers.filter(u => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = u.name.toLowerCase().includes(term) ||
                          u.email.toLowerCase().includes(term) ||
                          u.id.toLowerCase().includes(term);
    if (roleFilter === 'Patients') return matchesSearch && u.role === 'patient';
    if (roleFilter === 'Admins') return matchesSearch && u.role === 'admin';
    return matchesSearch;
  });

  const handleCopyId = (id) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    toast.success('Unique User ID copied to clipboard');
    setTimeout(() => setCopiedId(''), 2000);
  };

  const handleToggleStatus = async (user) => {
    const newStatus = user.status === 'Active' ? 'Suspended' : 'Active';
    const result = await updateUserStatus(user.id, newStatus);
    if (!result?.success) {
      toast.error(result?.error || 'Could not update account status.');
      return;
    }
    await refreshUsers();
    toast.success(`User ${user.name} status updated to ${newStatus}`);
    setSelectedUser(null);
  };

  // Administrator Schedule Deletion for User Account
  const handleScheduleUserDeletion = async (user) => {
    if (user.role === 'admin') {
      toast.error('Administrators cannot schedule deletion of administrator accounts.');
      return;
    }
    setIsProcessingDeletion(true);
    try {
      if (!isOnline()) throw new Error('An internet connection is required for administrator account changes.');
      const token = localStorage.getItem('medremind_auth_token');
      const res = await apiFetch(`/admin/users/${user.id}/schedule-deletion`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ reason: deletionReason || 'Admin scheduled account closure' })
        });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to schedule deletion on server');
      }
      await refreshUsers();
      toast.warning(`Account for ${user.name} scheduled for deletion in 24 hours.`);
      setSelectedUser(null);
      setDeletionReason('');
    } catch (err) {
      toast.error(err.message || 'Error scheduling deletion');
    } finally {
      setIsProcessingDeletion(false);
    }
  };

  // Administrator Cancel Deletion
  const handleCancelUserDeletion = async (user) => {
    setIsProcessingDeletion(true);
    try {
      if (!isOnline()) throw new Error('An internet connection is required for administrator account changes.');
      const token = localStorage.getItem('medremind_auth_token');
      const res = await apiFetch(`/admin/users/${user.id}/cancel-deletion`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          }
        });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to cancel deletion on server');
      }
      await refreshUsers();
      toast.success(`Scheduled deletion cancelled for ${user.name}. Account is Active.`);
      setSelectedUser(null);
    } catch (err) {
      toast.error(err.message || 'Error cancelling deletion');
    } finally {
      setIsProcessingDeletion(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-[#202B28]">User Management</h1>
        <p className="text-xs text-[#7A8782]">Manage patient and administrator accounts</p>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7A8782]" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by name, email, or USR-UUID..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-[#E6ECE8] text-xs text-[#202B28] placeholder-[#7A8782]/60 focus:outline-none focus:border-[#238B78]"
        />
      </div>

      {/* Role Tabs */}
      <div className="flex gap-1.5 border-b border-[#E6ECE8] pb-1">
        {['All', 'Patients', 'Admins'].map((tab) => (
          <button
            key={tab}
            onClick={() => setRoleFilter(tab)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              roleFilter === tab
                ? 'bg-[#202B28] text-white'
                : 'text-[#7A8782] hover:bg-[#E6ECE8]/50 hover:text-[#202B28]'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Users List */}
      <div className="space-y-2.5">
        {filteredUsers.length === 0 ? (
          <Card className="text-center py-8">
            <User className="w-10 h-10 text-[#7A8782]/40 mx-auto mb-2" />
            <h4 className="font-semibold text-sm text-[#202B28]">No accounts found</h4>
            <p className="text-xs text-[#7A8782] mt-1">Try broadening your search term or filter.</p>
          </Card>
        ) : (
          filteredUsers.map((u) => (
            <Card key={u.id} className="p-3.5 space-y-2 bg-white">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-sm text-[#202B28]">{u.name}</h4>
                    <Badge 
                      variant={u.role === 'admin' ? 'neutral' : 'success'} 
                      size="sm"
                    >
                      {u.role.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-xs text-[#7A8782]">{u.email}</p>
                </div>
                <Badge 
                  variant={
                    u.status === 'Active' ? 'success' : 
                    u.status === 'Pending_Deletion' ? 'warning' : 'danger'
                  } 
                  size="sm"
                >
                  {u.status === 'Pending_Deletion' ? 'Pending Deletion' : u.status}
                </Badge>
              </div>

              {/* Unique User ID Display */}
              <div className="flex items-center justify-between bg-[#F8FAF8] px-2.5 py-1.5 rounded-lg border border-[#E6ECE8] text-[11px]">
                <code className="text-[#238B78] font-mono">{formatShortUserId(u.id)}</code>
                <button
                  onClick={() => handleCopyId(u.id)}
                  className="flex items-center gap-1 text-[#7A8782] hover:text-[#202B28] font-medium cursor-pointer"
                >
                  {copiedId === u.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>Copy ID</span>
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-1 border-t border-[#E6ECE8]/60">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedUser(u)}
                >
                  Manage Account
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Account Details & Status Modal */}
      {selectedUser && (
        <Modal
          isOpen={Boolean(selectedUser)}
          onClose={() => setSelectedUser(null)}
          title="Account Administration"
        >
          <div className="space-y-4 text-xs">
            <div className="space-y-2 bg-[#F8FAF8] p-3 rounded-xl border border-[#E6ECE8]">
              <p><strong>Name:</strong> {selectedUser.name}</p>
              <p><strong>Email:</strong> {selectedUser.email}</p>
              <p><strong>Role:</strong> {selectedUser.role}</p>
              <p><strong>Registered Date:</strong> {selectedUser.registeredAt}</p>
              <p><strong>Status:</strong> {selectedUser.status}</p>
              <p className="break-all"><strong>Full Unique ID:</strong> <code className="font-mono text-[#238B78]">{selectedUser.id}</code></p>
            </div>

            {selectedUser.role !== 'admin' ? (
              <div className="pt-2 space-y-3">
                <div className="flex gap-2">
                  <Button
                    variant={selectedUser.status === 'Active' ? 'danger' : 'success'}
                    fullWidth
                    onClick={() => handleToggleStatus(selectedUser)}
                  >
                    {selectedUser.status === 'Active' ? 'Suspend Account' : 'Activate Account'}
                  </Button>
                </div>

                {/* 24-Hour Account Deletion Administration */}
                <div className="p-3 rounded-xl bg-red-50/50 border border-red-200 space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-red-950">
                    <Trash2 className="w-4 h-4 text-red-600" />
                    Account Closure (24-Hour Grace Period)
                  </div>

                  {selectedUser.status === 'Pending_Deletion' ? (
                    <div className="space-y-2">
                      <p className="text-[11px] text-amber-900 leading-relaxed">
                        This account is currently scheduled for permanent deletion.
                        {selectedUser.scheduledDeletionAt && (
                          <span className="block font-mono text-[10px] mt-0.5">
                            Target: {new Date(selectedUser.scheduledDeletionAt).toLocaleString()}
                          </span>
                        )}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        fullWidth
                        disabled={isProcessingDeletion}
                        onClick={() => handleCancelUserDeletion(selectedUser)}
                        className="border-amber-400 text-amber-900 bg-amber-50"
                      >
                        {isProcessingDeletion ? 'Cancelling...' : 'Cancel Scheduled Deletion'}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="Reason for deletion (optional)"
                        value={deletionReason}
                        onChange={(e) => setDeletionReason(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-[#E6ECE8] text-[11px] bg-white focus:outline-none focus:border-red-500"
                      />
                      <Button
                        variant="danger"
                        size="sm"
                        fullWidth
                        disabled={isProcessingDeletion}
                        onClick={() => handleScheduleUserDeletion(selectedUser)}
                      >
                        {isProcessingDeletion ? 'Scheduling...' : 'Schedule 24h Grace Deletion'}
                      </Button>
                    </div>
                  )}
                </div>

                <div className="pt-1">
                  <Button
                    variant="outline"
                    fullWidth
                    onClick={() => setSelectedUser(null)}
                  >
                    Close
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-[#7A8782] italic text-center">
                The primary System Administrator account cannot be suspended or deleted.
              </p>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
