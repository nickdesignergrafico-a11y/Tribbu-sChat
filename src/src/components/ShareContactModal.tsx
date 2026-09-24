import React, { useState } from 'react';
import { X, Smartphone, User, Send, Check, PhoneCall, MessageCircle } from 'lucide-react';
import { UserSession } from '../types';

interface ShareContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserSession | null;
  onSendContact: (contact: { name: string; phone: string }) => void;
}

export function formatPhoneNumber(val: string): string {
  // Extract numbers only
  const digits = val.replace(/\D/g, '').slice(0, 11);
  if (!digits) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

export default function ShareContactModal({
  isOpen,
  onClose,
  currentUser,
  onSendContact
}: ShareContactModalProps) {
  const [mode, setMode] = useState<'me' | 'other'>('me');
  const [contactName, setContactName] = useState(currentUser?.displayName || currentUser?.phoneNumber || '');
  const [contactPhone, setContactPhone] = useState(currentUser?.phoneNumber || '');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleModeChange = (newMode: 'me' | 'other') => {
    setMode(newMode);
    setError('');
    if (newMode === 'me') {
      setContactName(currentUser?.displayName || currentUser?.phoneNumber || 'Meu Contato');
      setContactPhone(currentUser?.phoneNumber || '');
    } else {
      setContactName('');
      setContactPhone('');
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const formatted = formatPhoneNumber(raw);
    setContactPhone(formatted);
    if (error) setError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = contactName.trim();
    const cleanPhone = contactPhone.trim();

    if (!cleanName) {
      setError('Por favor, informe o nome do contato.');
      return;
    }

    const digits = cleanPhone.replace(/\D/g, '');
    if (digits.length < 8) {
      setError('Informe um número de celular válido com DDD (ex: (11) 98765-4321).');
      return;
    }

    onSendContact({
      name: cleanName,
      phone: cleanPhone
    });
    onClose();
  };

  const initial = contactName.trim().charAt(0).toUpperCase() || 'C';

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col text-white animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Smartphone className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-white">Compartilhar Contato</h3>
              <p className="text-[11px] text-white/50">Envie o número de celular em vez de e-mail</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection: Meu Contato vs Outro Contato */}
        <div className="px-5 pt-4">
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-white/5 rounded-xl border border-white/10 text-xs font-semibold">
            <button
              type="button"
              onClick={() => handleModeChange('me')}
              className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                mode === 'me' 
                  ? 'bg-gradient-to-r from-cyan-400 to-emerald-400 text-slate-950 shadow-md font-bold' 
                  : 'text-white/70 hover:text-white hover:bg-white/5'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              Meu Celular
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('other')}
              className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                mode === 'other' 
                  ? 'bg-gradient-to-r from-cyan-400 to-emerald-400 text-slate-950 shadow-md font-bold' 
                  : 'text-white/70 hover:text-white hover:bg-white/5'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              Outro Contato
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              {error}
            </div>
          )}

          {/* Contact Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-white/70 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-cyan-400" />
              Nome do Contato
            </label>
            <input
              type="text"
              required
              value={contactName}
              onChange={(e) => {
                setContactName(e.target.value);
                if (error) setError('');
              }}
              placeholder="Ex: João da Silva"
              className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-white/20 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40 transition"
            />
          </div>

          {/* Cell Phone Number */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-white/70 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                Número do Celular (Tribbu'sChat)
              </span>
              <span className="text-[11px] text-white/40">DDD + 9 dígitos</span>
            </label>
            <input
              type="tel"
              required
              value={contactPhone}
              onChange={handlePhoneChange}
              placeholder="(11) 98765-4321"
              maxLength={15}
              className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-white/20 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40 font-mono transition"
            />
          </div>

          {/* Live Preview Card */}
          <div className="p-3 bg-white/[0.03] border border-white/10 rounded-xl space-y-2">
            <p className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">
              Pré-visualização do Cartão no Chat:
            </p>
            <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-3 flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-cyan-400 to-emerald-400 flex items-center justify-center font-bold text-slate-950 text-base flex-shrink-0 shadow">
                {initial}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white truncate">
                  {contactName || 'Nome do Contato'}
                </p>
                <p className="text-xs font-semibold text-cyan-400 font-mono mt-0.5 flex items-center gap-1">
                  <Smartphone className="w-3 h-3" />
                  {contactPhone || '(XX) 9XXXX-XXXX'}
                </p>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                Contato
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-white/70 hover:text-white hover:bg-white/5 border border-white/10 transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/25 transition-all cursor-pointer"
            >
              <Send className="w-3.5 h-3.5 stroke-[2.5]" />
              Enviar Contato
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
