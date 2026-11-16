import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import BrandLogo from '../../components/common/BrandLogo';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Modal from '../../components/common/Modal';
import ConsentUpdateModal from '../../components/legal/ConsentUpdateModal';
import { hasCurrentConsent } from '../../services/legalConsentService';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login } = useAuth();
  
  // Empty default inputs so fresh launch does not prefill any credentials
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');

  // Consent gate for users with outdated or missing acceptance records
  const [pendingConsentUser, setPendingConsentUser] = useState(null);

  const routeUserAfterAuth = (user) => {
    if (user.role === 'admin') {
      navigate('/admin/dashboard');
    } else {
      navigate('/dashboard');
    }
  };

  const handleAuthSuccess = (user) => {
    // Check whether the user has accepted the current legal documents (v2026.1)
    if (!hasCurrentConsent(user.id)) {
      setPendingConsentUser(user);
    } else {
      routeUserAfterAuth(user);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!identifier.trim() || !password.trim()) {
      setError('Please provide your Email or Phone number and password.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const res = await login(identifier, password);
      setIsLoading(false);

      if (res.success) {
        toast.success(`Welcome, ${res.user.name}!`);
        handleAuthSuccess(res.user);
      } else {
        setError(res.error || 'Authentication failed');
        toast.error(res.error || 'Authentication failed');
      }
    } catch (err) {
      setIsLoading(false);
      setError(err.message || 'Authentication error');
      toast.error(err.message || 'Authentication error');
    }
  };

  const handleForgotPassword = (e) => {
    e.preventDefault();
    if (!forgotEmail) {
      toast.error('Please enter your registered email');
      return;
    }
    toast.success(`Password reset instructions sent to ${forgotEmail}`);
    setShowForgotModal(false);
    setForgotEmail('');
  };

  return (
    <div className="flex-1 flex flex-col justify-between p-6">
      <div className="pt-4">
        <BrandLogo size="md" />
        <div className="mt-5 mb-5">
          <h2 className="text-xl font-bold text-[#202B28]">{t('auth.signInTitle', 'Sign In to MedRemind')}</h2>
          <p className="text-xs text-[#7A8782] mt-0.5">{t('auth.signInSubtitle', 'Enter your credentials to access your medication routine.')}</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-3.5">
          <Input
            label={t('auth.emailOrPhone', 'Email or Phone Number')}
            icon={Mail}
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="you@email.com or +91 98765 43210"
          />

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#202B28] uppercase tracking-wider">
              {t('auth.password', 'Password')}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#7A8782]">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-white border border-[#E6ECE8] text-sm text-[#202B28] focus:outline-none focus:border-[#238B78]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#7A8782] hover:text-[#202B28]"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <label className="flex items-center gap-1.5 text-[#7A8782] cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="accent-[#238B78] rounded"
              />
              {t('auth.rememberMe', 'Remember me')}
            </label>
            <button
              type="button"
              onClick={() => setShowForgotModal(true)}
              className="text-[#238B78] hover:underline font-medium cursor-pointer"
            >
              {t('auth.forgotPassword', 'Forgot password?')}
            </button>
          </div>

          {error && <p className="text-xs text-red-600 font-medium">{error}</p>}

          <Button type="submit" fullWidth size="lg" disabled={isLoading}>
            {isLoading ? t('common.loading', 'Signing In...') : t('auth.signInButton', 'Sign In')}
          </Button>
        </form>
      </div>

      <div className="py-4 space-y-2 text-center text-xs text-[#7A8782]">
        <p>
          {t('auth.noAccount', "Don't have an account?")}{' '}
          <Link to="/register" className="text-[#238B78] font-semibold hover:underline">
            {t('auth.registerLink', 'Register')}
          </Link>
        </p>

        <p className="text-[10px] text-[#7A8782] pt-1">
          <Link to="/legal" className="hover:underline">Terms & Conditions</Link> •{' '}
          <Link to="/legal" className="hover:underline">Privacy Policy (DPDP)</Link> •{' '}
          <Link to="/legal" className="hover:underline font-semibold text-[#238B78]">Legal Centre</Link>
        </p>
      </div>

      {/* Forgot Password Modal */}
      <Modal
        isOpen={showForgotModal}
        onClose={() => setShowForgotModal(false)}
        title="Password Recovery"
      >
        <form onSubmit={handleForgotPassword} className="space-y-4">
          <p className="text-xs text-[#7A8782]">
            Enter your registered email address to receive password recovery instructions.
          </p>
          <Input
            label="Email Address"
            type="email"
            placeholder="you@email.com"
            value={forgotEmail}
            onChange={(e) => setForgotEmail(e.target.value)}
          />
          <Button type="submit" fullWidth size="md">
            Dispatch Reset Instructions
          </Button>
        </form>
      </Modal>

      {/* Outdated / Missing Consent Enforcement Gate */}
      <ConsentUpdateModal
        isOpen={!!pendingConsentUser}
        user={pendingConsentUser}
        onConsentCompleted={() => {
          const user = pendingConsentUser;
          setPendingConsentUser(null);
          routeUserAfterAuth(user);
        }}
      />
    </div>
  );
}
