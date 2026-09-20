import React, { useState, useRef } from 'react';
import { 
  X, 
  Camera, 
  Upload, 
  Send, 
  Image as ImageIcon, 
  Type, 
  Megaphone, 
  Sparkles, 
  Users, 
  Layers
} from 'lucide-react';
import CameraCaptureModal from './CameraCaptureModal';
import { TextStatusCard, THEME_CONFIGS } from './TextStatusCard';
import { Chat, TextStatusStyle, UserSession } from '../types';

interface NewStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: UserSession | null;
  availableGroups?: Chat[];
  initialGroupId?: string;
  initialTab?: 'media' | 'text';
  onPublishStatus: (
    fileOrDataUrl: File | string, 
    mediaType: 'image' | 'video', 
    caption?: string,
    onProgress?: (percent: number) => void
  ) => Promise<void>;
  onPublishTextStatus?: (
    textContent: string,
    style: TextStatusStyle,
    isTribbuNotice?: boolean,
    targetGroupId?: string,
    targetGroupName?: string
  ) => Promise<void>;
}

const BADGE_OPTIONS = [
  '📢 Aviso da Tribbu',
  '⚡ Novidade',
  '🚀 Projeto',
  '💡 Reflexão & Ideia',
  '💬 Mensagem da Tribbu',
  '🔥 Destaque'
];

export const NewStatusModal: React.FC<NewStatusModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  availableGroups = [],
  initialGroupId,
  initialTab = 'media',
  onPublishStatus,
  onPublishTextStatus
}) => {
  const [activeTab, setActiveTab] = useState<'media' | 'text'>(initialTab || (initialGroupId ? 'text' : 'media'));

  // Media Tab states
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [caption, setCaption] = useState('');
  const [showCamera, setShowCamera] = useState(false);

  // Text Status Tab states (Modern Dark Mode Card)
  const [textContent, setTextContent] = useState('');
  const [selectedTheme, setSelectedTheme] = useState<TextStatusStyle['themeId']>('tribbu-cyber');
  const [selectedBadge, setSelectedBadge] = useState<string>('📢 Aviso da Tribbu');
  const [isTribbuNotice, setIsTribbuNotice] = useState<boolean>(!!initialGroupId);
  const [selectedGroupId, setSelectedGroupId] = useState<string>(initialGroupId || (availableGroups[0]?.id || ''));

  // Common submission states
  const [isPublishing, setIsPublishing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const validGroups = availableGroups.filter(g => g.isGroup || g.isCommunity);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVid = file.type.startsWith('video');
    setMediaType(isVid ? 'video' : 'image');
    setSelectedFile(file);

    const reader = new FileReader();
    reader.onload = () => {
      setMediaPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleCameraCapture = (photoDataUrl: string) => {
    setMediaType('image');
    setSelectedFile(null);
    setMediaPreview(photoDataUrl);
    setShowCamera(false);
  };

  const handlePublishMedia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mediaPreview && !selectedFile) return;

    setIsPublishing(true);
    setUploadProgress(10);
    try {
      await onPublishStatus(
        selectedFile || mediaPreview!, 
        mediaType, 
        caption.trim(),
        (progress) => setUploadProgress(progress)
      );
      handleClose();
    } catch (err) {
      console.error('Error publishing status:', err);
    } finally {
      setIsPublishing(false);
      setUploadProgress(0);
    }
  };

  const handlePublishText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textContent.trim() || !onPublishTextStatus) return;

    setIsPublishing(true);
    try {
      const targetGroup = validGroups.find(g => g.id === selectedGroupId);
      await onPublishTextStatus(
        textContent.trim(),
        {
          themeId: selectedTheme,
          badge: selectedBadge
        },
        isTribbuNotice,
        isTribbuNotice ? targetGroup?.id : undefined,
        isTribbuNotice ? targetGroup?.name : undefined
      );
      handleClose();
    } catch (err) {
      console.error('Error publishing text status:', err);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleClose = () => {
    setMediaPreview(null);
    setSelectedFile(null);
    setCaption('');
    setTextContent('');
    setIsPublishing(false);
    setUploadProgress(0);
    onClose();
  };

  const previewGroup = validGroups.find(g => g.id === selectedGroupId);

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 select-none animate-in fade-in duration-200"
      id="newStatusModal"
    >
      <div 
        className="w-full max-w-xl bg-slate-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col text-white max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="px-5 sm:px-6 py-3.5 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
              {activeTab === 'media' ? <Camera className="w-4 h-4" /> : <Type className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-white">Criar Novo Status</h3>
              <p className="text-[11px] text-white/50">Visível no Tribbu'sChat por 24 horas</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher: Mídia vs Status em Texto */}
        <div className="flex border-b border-white/10 bg-slate-950/60 p-1.5 gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('media')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'media'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 shadow-sm'
                : 'text-white/60 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <Camera className="w-3.5 h-3.5 text-cyan-400" />
            <span>Mídia (Foto / Vídeo)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('text')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'text'
                ? 'bg-gradient-to-r from-cyan-500/20 via-teal-500/20 to-emerald-500/20 text-cyan-200 border border-cyan-400/50 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                : 'text-white/60 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <Type className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-bold">Status em Texto (Dark Mode)</span>
            <span className="text-[10px] bg-emerald-500/25 text-emerald-300 font-mono px-1.5 py-0.2 rounded border border-emerald-400/30">
              Novo
            </span>
          </button>
        </div>

        {/* Modal Body Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* ================= TAB 1: MÍDIA ================= */}
          {activeTab === 'media' && (
            <div className="space-y-4">
              <input 
                type="file" 
                ref={fileInputRef} 
                accept="image/*,video/*" 
                className="hidden" 
                onChange={handleFileSelect} 
              />

              {/* Media Preview or Upload Prompt */}
              {mediaPreview ? (
                <div className="relative rounded-2xl overflow-hidden bg-black aspect-[4/5] max-h-[340px] flex items-center justify-center border border-white/10">
                  {mediaType === 'video' ? (
                    <video src={mediaPreview} controls autoPlay playsInline className="w-full h-full object-contain" />
                  ) : (
                    <img src={mediaPreview} alt="Preview do status" className="w-full h-full object-contain" />
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setMediaPreview(null);
                      setSelectedFile(null);
                    }}
                    className="absolute top-3 right-3 p-2 rounded-full bg-black/60 text-white hover:bg-black/90 transition cursor-pointer"
                    title="Trocar mídia"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="border-2 border-dashed border-cyan-500/30 rounded-2xl p-7 flex flex-col items-center justify-center text-center space-y-4 bg-white/[0.02]">
                  <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shadow-lg shadow-cyan-500/10">
                    <ImageIcon className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Compartilhe uma foto ou vídeo</p>
                    <p className="text-xs text-white/50 mt-1 max-w-xs">
                      Seus status ficam visíveis para seus contatos por 24 horas no Tribbu'sChat.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowCamera(true)}
                      className="px-4 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-200 font-semibold text-xs flex items-center gap-2 transition cursor-pointer"
                    >
                      <Camera className="w-4 h-4 text-cyan-400" />
                      Abrir Câmera
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-200 font-semibold text-xs flex items-center gap-2 transition cursor-pointer"
                    >
                      <Upload className="w-4 h-4 text-emerald-400" />
                      Galeria / Mídia
                    </button>
                  </div>
                </div>
              )}

              {/* Caption Input */}
              {mediaPreview && (
                <div>
                  <label className="block text-xs font-semibold text-cyan-200/80 mb-1.5">
                    Legenda (opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Escreva uma legenda..."
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    disabled={isPublishing}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/40 focus:outline-none focus:border-cyan-400 disabled:opacity-50"
                    maxLength={180}
                  />
                </div>
              )}

              {/* Upload Progress Bar for Firebase Storage */}
              {isPublishing && (
                <div className="p-3.5 bg-slate-950/80 rounded-2xl border border-cyan-500/30 space-y-2 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-cyan-300 font-semibold flex items-center gap-1.5">
                      <Upload className="w-3.5 h-3.5 text-cyan-400 animate-bounce" />
                      Enviando para o Firebase Storage...
                    </span>
                    <span className="text-emerald-400 font-bold font-mono">{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden p-0.5 border border-white/10">
                    <div 
                      className="h-full bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 rounded-full transition-all duration-200 shadow-[0_0_12px_rgba(6,182,212,0.6)]"
                      style={{ width: `${Math.max(5, uploadProgress)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================= TAB 2: STATUS EM TEXTO (DARK MODE CARD) ================= */}
          {activeTab === 'text' && (
            <div className="space-y-4">
              {/* 1. Text Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    Mensagem do Status / Aviso
                  </label>
                  <span className={`text-[11px] font-mono ${textContent.length > 250 ? 'text-amber-400' : 'text-white/50'}`}>
                    {textContent.length}/280
                  </span>
                </div>
                <textarea
                  rows={3}
                  placeholder="Ex: Atenção tribo! Hoje teremos uma reunião especial às 19h no canal de Projetos. 🚀⚡"
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  disabled={isPublishing}
                  className="w-full bg-slate-950/80 border border-cyan-500/30 rounded-2xl p-3.5 text-sm text-white placeholder-white/40 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 transition-all resize-none shadow-inner"
                  maxLength={280}
                />
              </div>

              {/* 2. Theme & Badge Customization */}
              <div className="space-y-3 p-3.5 rounded-2xl bg-white/[0.02] border border-white/10">
                {/* Theme Selector */}
                <div>
                  <span className="text-[11px] font-bold text-white/70 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                    <Layers className="w-3 h-3 text-cyan-400" />
                    Tema do Cartão Dark Mode
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {(Object.keys(THEME_CONFIGS) as TextStatusStyle['themeId'][]).map((thKey) => {
                      const t = THEME_CONFIGS[thKey];
                      const isSelected = selectedTheme === thKey;
                      return (
                        <button
                          key={thKey}
                          type="button"
                          onClick={() => setSelectedTheme(thKey)}
                          className={`p-2 rounded-xl text-left transition-all cursor-pointer border ${
                            isSelected
                              ? 'bg-slate-950 border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.4)] ring-1 ring-cyan-400'
                              : 'bg-slate-950/50 border-white/10 hover:border-white/20 text-white/70'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span 
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: t.accentColor.replace('text-', '') === 'cyan-400' ? '#06b6d4' : '#10b981' }}
                            />
                            <span className="text-xs font-semibold text-white truncate">{t.name}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Badge Category */}
                <div>
                  <span className="text-[11px] font-bold text-white/70 uppercase tracking-wider block mb-2">
                    Selo / Categoria
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {BADGE_OPTIONS.map((badge) => (
                      <button
                        key={badge}
                        type="button"
                        onClick={() => setSelectedBadge(badge)}
                        className={`text-xs px-2.5 py-1 rounded-lg font-medium transition cursor-pointer border ${
                          selectedBadge === badge
                            ? 'bg-cyan-500/25 text-cyan-200 border-cyan-400/60 shadow-sm'
                            : 'bg-white/5 text-white/60 hover:text-white border-white/5'
                        }`}
                      >
                        {badge}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. OPTION TO POST AS "AVISO DA TRIBBU" IN GROUPS / CHANNELS (24H) */}
                <div className="pt-2 border-t border-white/10">
                  <div className="flex items-center justify-between">
                    <label 
                      htmlFor="tribbuNoticeToggle" 
                      className="flex items-center gap-2 cursor-pointer select-none"
                    >
                      <input 
                        type="checkbox"
                        id="tribbuNoticeToggle"
                        checked={isTribbuNotice}
                        onChange={(e) => setIsTribbuNotice(e.target.checked)}
                        className="w-4 h-4 rounded border-cyan-500/50 text-cyan-500 focus:ring-cyan-400 bg-slate-900 cursor-pointer accent-cyan-400"
                      />
                      <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                        <Megaphone className="w-3.5 h-3.5 text-emerald-400" />
                        Postar como Aviso da Tribbu em um Canal / Grupo (24 horas)
                      </span>
                    </label>
                  </div>

                  {isTribbuNotice && (
                    <div className="mt-2.5 p-2.5 rounded-xl bg-slate-950/90 border border-emerald-500/30 space-y-2 animate-in fade-in duration-150">
                      <div className="flex items-center gap-2 text-xs text-white/70">
                        <Users className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                        <span>Selecione o Grupo / Canal de destino:</span>
                      </div>

                      {validGroups.length > 0 ? (
                        <select
                          value={selectedGroupId}
                          onChange={(e) => setSelectedGroupId(e.target.value)}
                          className="w-full bg-slate-900 border border-cyan-500/40 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400 cursor-pointer"
                        >
                          {validGroups.map(g => (
                            <option key={g.id} value={g.id}>
                              {g.name} ({g.isCommunity ? 'Comunidade' : 'Grupo'})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <p className="text-[11px] text-amber-300/90">
                          Nenhum grupo encontrado na sua conta. O status será publicado no seu Status geral.
                        </p>
                      )}

                      <p className="text-[11px] text-white/50 leading-relaxed">
                        Este status ficará em destaque no topo do grupo durante 24 horas para todos os membros da tribo.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* 4. Real-time Live Interactive Preview */}
              <div>
                <span className="text-[11px] font-bold text-white/60 uppercase tracking-wider block mb-2 text-center">
                  Pré-visualização do Cartão em Dark Mode
                </span>
                <div className="p-2 sm:p-3 bg-black/40 rounded-2xl border border-white/10 flex justify-center">
                  <TextStatusCard
                    status={{
                      textContent: textContent || 'Escreva algo incrível para a sua tribo...',
                      userName: currentUser?.displayName || currentUser?.phoneNumber || 'Meu Usuário',
                      userPhone: currentUser?.phoneNumber,
                      avatarColor: currentUser?.avatarColor || '#06B6D4',
                      photoURL: currentUser?.photoURL,
                      isTribbuNotice,
                      targetGroupName: isTribbuNotice ? previewGroup?.name : undefined,
                      textStyle: {
                        themeId: selectedTheme,
                        badge: selectedBadge
                      },
                      timestamp: Date.now(),
                      expiresAt: Date.now() + 24 * 60 * 60 * 1000
                    }}
                    showExpiration={true}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-white/10 bg-white/[0.02] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleClose}
            disabled={isPublishing}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-white/60 hover:text-white transition cursor-pointer"
          >
            Cancelar
          </button>

          {activeTab === 'media' ? (
            mediaPreview && (
              <button
                type="button"
                onClick={handlePublishMedia}
                disabled={isPublishing}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/25 transition cursor-pointer disabled:opacity-50"
              >
                {isPublishing ? (
                  <span>Publicando mídia...</span>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 fill-slate-950" />
                    <span>Compartilhar no Status</span>
                  </>
                )}
              </button>
            )
          ) : (
            <button
              type="button"
              onClick={handlePublishText}
              disabled={isPublishing || !textContent.trim()}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/25 transition cursor-pointer disabled:opacity-40"
            >
              {isPublishing ? (
                <span>Publicando cartão...</span>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5 fill-slate-950" />
                  <span>
                    {isTribbuNotice ? 'Publicar Aviso da Tribbu (24h)' : 'Publicar Status de Texto'}
                  </span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Camera Capture Modal */}
      <CameraCaptureModal
        isOpen={showCamera}
        onClose={() => setShowCamera(false)}
        onCapture={handleCameraCapture}
      />
    </div>
  );
};
