import React, { useState } from 'react';
import { X, Users, Sparkles, Check } from 'lucide-react';

interface NewCommunityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateCommunity: (name: string, description: string) => void;
}

export default function NewCommunityModal({
  isOpen,
  onClose,
  onCreateCommunity,
}: NewCommunityModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onCreateCommunity(name.trim(), description.trim());
      setName('');
      setDescription('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-cyan-400" />
            <h3 className="font-bold text-lg text-white">Nova Comunidade</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="flex flex-col items-center justify-center p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-2xl text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-400 to-emerald-400 text-slate-950 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Users className="w-8 h-8" />
            </div>
            <p className="text-xs text-white/70">
              Reúna membros em grupos relacionados e envie avisos gerais para todos.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-white/70 block">
              Nome da Comunidade
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Condomínio Solar, Equipe de Design..."
              className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-white/20 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-white/70 block">
              Descrição (opcional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Qual é o objetivo desta comunidade?"
              rows={3}
              className="w-full px-3.5 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-white/20 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40 resize-none"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 font-semibold text-sm transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-slate-950 font-bold text-sm transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/25"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              Criar Comunidade
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
