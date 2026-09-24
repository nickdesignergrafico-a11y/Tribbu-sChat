import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Camera, 
  Upload, 
  Users, 
  Search, 
  Check, 
  Sparkles, 
  Trash2, 
  Shield, 
  AlertCircle,
  Loader2,
  Info
} from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { UserSession } from '../types';
import { uploadProfilePhoto } from '../services/storageService';
import { formatPhoneDisplay } from './LoginScreen';
import CameraCaptureModal from './CameraCaptureModal';

interface NewTribbuModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserSession;
  onCreateTribbu: (groupData: {
    name: string;
    photoURL?: string;
    avatarColor: string;
    avatarLetter: string;
    members: string[];
    description?: string;
  }) => Promise<void>;
}

interface MemberOption {
  uid: string;
  displayName: string;
  phoneNumber: string;
  photoURL?: string;
  avatarColor: string;
  initial: string;
}

const AVATAR_COLORS = [
  '#06B6D4', '#0891B2', '#00E5FF', '#10B981', '#059669',
  '#14B8A6', '#0284C7', '#3B82F6', '#6366F1', '#F59E0B'
];

export default function NewTribbuModal({
  isOpen,
  onClose,
  currentUser,
  onCreateTribbu
}: NewTribbuModalProps) {
  const [tribbuName, setTribbuName] = useState('');
  const [description, setDescription] = useState('');
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [selectedMemberPhones, setSelectedMemberPhones] = useState<Set<string>>(new Set());
  const [allUsers, setAllUsers] = useState<MemberOption[]>([]);
  const [memberSearchTerm, setMemberSearchTerm] = useState('');
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load available users from Firestore to populate member selection
  useEffect(() => {
    if (!isOpen) return;

    const loadUsers = async () => {
      setIsLoadingUsers(true);
      setError('');
      try {
        const snap = await getDocs(collection(db, 'users'));
        const users: MemberOption[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data();
          const phone = data.phoneNumber || '';
          // Don't list current user in selectable members list since they are creator by default
          if (phone && phone !== currentUser.phoneNumber && docSnap.id !== currentUser.uid) {
            users.push({
              uid: docSnap.id,
              displayName: data.displayName || phone,
              phoneNumber: phone,
              photoURL: data.photoURL,
              avatarColor: data.avatarColor || '#06B6D4',
              initial: data.initial || (data.displayName ? data.displayName.charAt(0).toUpperCase() : 'U')
            });
          }
        });
        setAllUsers(users);
      } catch (err: any) {
        console.error('Error loading users for group:', err);
      } finally {
        setIsLoadingUsers(false);
      }
    };

    loadUsers();
  }, [isOpen, currentUser]);

  const handleToggleMember = (phone: string) => {
    setSelectedMemberPhones(prev => {
      const next = new Set(prev);
      if (next.has(phone)) {
        next.delete(phone);
      } else {
        next.add(phone);
      }
      return next;
    });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingPhoto(true);
    setError('');
    try {
      const url = await uploadProfilePhoto(currentUser.uid || `tribbu_${Date.now()}`, file);
      setPhotoURL(url);
    } catch (err: any) {
      console.error('Error uploading group photo:', err);
      // Fallback: direct base64 data URL
      const reader = new FileReader();
      reader.onload = () => {
        setPhotoURL(reader.result as string);
      };
      reader.readAsDataURL(file);
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleCameraPhoto = (dataUrl: string) => {
    setPhotoURL(dataUrl);
    setIsCameraOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = tribbuName.trim();
    if (!cleanName) {
      setError('Por favor, informe o nome da sua Tribbu.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      // Generate initials and avatarColor per entities.json
      const words = cleanName.split(' ').filter(Boolean);
      const avatarLetter = words.map(w => w.charAt(0).toUpperCase()).slice(0, 2).join('') || 'TR';
      
      const charCode = cleanName.charCodeAt(0) || 0;
      const avatarColor = AVATAR_COLORS[charCode % AVATAR_COLORS.length];

      // Members array includes current creator phone + all selected members
      const membersList = Array.from(new Set([
        currentUser.phoneNumber,
        ...Array.from(selectedMemberPhones)
      ]));

      await onCreateTribbu({
        name: cleanName,
        photoURL: photoURL || undefined,
        avatarColor,
        avatarLetter,
        members: membersList,
        description: description.trim() || undefined
      });

      onClose();
    } catch (err: any) {
      console.error('Error creating group:', err);
      setError(err.message || 'Falha ao criar Tribbu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredMembers = allUsers.filter(u => {
    const query = memberSearchTerm.toLowerCase();
    return u.displayName.toLowerCase().includes(query) || u.phoneNumber.includes(query);
  });

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 select-none"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.25 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg bg-slate-900/95 border border-cyan-500/40 shadow-[0_0_35px_rgba(6,182,212,0.25)] rounded-3xl p-6 text-white relative overflow-hidden max-h-[90vh] flex flex-col"
          id="newTribbuModal"
        >
          {/* Glowing Top Neon Border */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 shadow-[0_0_12px_rgba(6,182,212,0.8)]" />

          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-400/50 flex items-center justify-center text-cyan-300 shadow-sm shadow-cyan-500/30">
                <Users className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-white tracking-tight flex items-center gap-2">
                  Nova Tribbu
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    Grupo Coletivo
                  </span>
                </h3>
                <p className="text-xs text-cyan-200/60 font-medium">
                  Crie uma comunidade com foto, nome e membros
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/10 rounded-full text-white/50 hover:text-white transition-colors cursor-pointer"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Form Content */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto pt-4 space-y-4 pr-1">
            {error && (
              <div className="p-3 bg-red-500/10 border-l-4 border-red-500 rounded-xl text-xs text-red-200 font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Photo Upload & Preview Section */}
            <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-950/60 border border-cyan-500/20 space-y-3">
              <div className="relative group">
                {photoURL ? (
                  <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.4)] relative">
                    <img 
                      src={photoURL} 
                      alt="Foto da Tribbu" 
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setPhotoURL(null)}
                      className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-cyan-300 cursor-pointer"
                      title="Remover foto"
                    >
                      <Trash2 className="w-6 h-6" />
                    </button>
                  </div>
                ) : (
                  <div className="w-24 h-24 rounded-full bg-slate-800/80 border-2 border-dashed border-cyan-400/40 flex flex-col items-center justify-center text-cyan-300/60 group-hover:border-cyan-400 transition-colors shadow-inner">
                    <Users className="w-8 h-8 text-cyan-400/70 mb-1" />
                    <span className="text-[10px] font-semibold text-cyan-200/70">Foto da Tribbu</span>
                  </div>
                )}

                {isUploadingPhoto && (
                  <div className="absolute inset-0 bg-slate-950/80 rounded-full flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
                  </div>
                )}
              </div>

              {/* Photo Upload Actions */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsCameraOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/40 text-cyan-300 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" />
                  Câmera
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/40 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Escolher Foto
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoUpload}
                />
              </div>

              <p className="text-[10px] text-white/40 text-center">
                Se não escolher uma foto, geraremos as iniciais e a cor neon automaticamente.
              </p>
            </div>

            {/* Tribbu Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-white/80 block" htmlFor="tribbuName">
                Nome da Tribbu *
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-cyan-400/70">
                  <Shield className="w-4 h-4" />
                </span>
                <input
                  id="tribbuName"
                  type="text"
                  required
                  placeholder="Ex: Tribbu Devs, Família, Time Design..."
                  value={tribbuName}
                  onChange={(e) => setTribbuName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950/70 border border-cyan-500/30 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400 transition-all font-medium"
                />
              </div>
            </div>

            {/* Tribbu Description (Optional) */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-white/80 block" htmlFor="tribbuDesc">
                Descrição do Grupo (opcional)
              </label>
              <input
                id="tribbuDesc"
                type="text"
                placeholder="Ex: Canal para alinhamentos e novidades da equipe"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950/70 border border-white/10 rounded-xl text-xs text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400 transition-all"
              />
            </div>

            {/* Member Selection Section */}
            <div className="space-y-2 pt-2 border-t border-white/10">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-cyan-400" />
                  Selecionar Membros da Tribbu
                </label>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                  {selectedMemberPhones.size} selecionado{selectedMemberPhones.size !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Search contacts filter */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  type="text"
                  placeholder="Pesquisar por nome ou número de chip..."
                  value={memberSearchTerm}
                  onChange={(e) => setMemberSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-950/70 border border-white/10 rounded-xl text-xs text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-cyan-400/50"
                />
              </div>

              {/* Members List */}
              <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                {isLoadingUsers ? (
                  <div className="py-6 flex items-center justify-center gap-2 text-xs text-cyan-300">
                    <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                    <span>Carregando usuários do Firestore...</span>
                  </div>
                ) : filteredMembers.length > 0 ? (
                  filteredMembers.map((member) => {
                    const isSelected = selectedMemberPhones.has(member.phoneNumber);
                    return (
                      <div
                        key={member.phoneNumber}
                        onClick={() => handleToggleMember(member.phoneNumber)}
                        className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-cyan-500/15 border-cyan-400/60 shadow-[0_0_12px_rgba(6,182,212,0.2)]'
                            : 'bg-white/[0.02] hover:bg-white/[0.06] border-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div 
                            className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-xs border border-white/10 overflow-hidden flex-shrink-0"
                            style={{ backgroundColor: member.avatarColor }}
                          >
                            {member.photoURL ? (
                              <img src={member.photoURL} alt={member.displayName} className="w-full h-full object-cover" />
                            ) : (
                              <span>{member.initial}</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className={`text-xs font-semibold truncate ${isSelected ? 'text-cyan-200' : 'text-white'}`}>
                              {member.displayName}
                            </p>
                            <p className="text-[10px] font-mono text-white/40 truncate">
                              {formatPhoneDisplay(member.phoneNumber)}
                            </p>
                          </div>
                        </div>

                        <div className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${
                          isSelected
                            ? 'bg-cyan-400 border-cyan-300 text-slate-950 shadow-sm'
                            : 'border-white/20 bg-slate-950/40 text-transparent'
                        }`}>
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-4 text-center text-xs text-white/40">
                    {memberSearchTerm ? 'Nenhum membro encontrado com este termo.' : 'Nenhum outro usuário disponível no momento.'}
                  </div>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-3 flex-shrink-0">
              <button
                type="submit"
                disabled={isSubmitting || !tribbuName.trim()}
                className="w-full py-3 bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 hover:from-cyan-300 hover:via-teal-300 hover:to-emerald-300 text-slate-950 font-black text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/30 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                    <span>Criando Tribbu no Firestore...</span>
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4" />
                    <span>Criar Tribbu</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>

      {/* Camera Capture Modal */}
      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleCameraPhoto}
        title="Tirar Foto para a Tribbu"
        isSelfie={false}
      />
    </AnimatePresence>
  );
}
