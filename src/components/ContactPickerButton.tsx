import React, { useState, useEffect } from 'react';
import { Contact, Search, Loader2, AlertCircle, CheckCircle2, X, Phone } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Tipagem estrita para a Contact Picker API nativa do navegador (W3C Contact Picker API)
 */
export type ContactProperty = 'name' | 'tel' | 'email' | 'address' | 'icon';

export interface NativeContactInfo {
  name?: string[];
  tel?: string[];
  email?: string[];
}

export interface ContactsSelectOptions {
  multiple?: boolean;
}

export interface ContactsManager {
  select: (
    properties: ContactProperty[],
    options?: ContactsSelectOptions
  ) => Promise<NativeContactInfo[]>;
  getProperties?: () => Promise<ContactProperty[]>;
}

export type NavigatorWithContacts = Navigator & {
  contacts?: ContactsManager;
};

export interface VerifiedAppContact {
  name: string;
  phoneNumber: string;
  photoURL?: string;
  avatarColor: string;
  avatarLetter: string;
}

export interface DatabaseCheckResponse {
  exists: boolean;
  contact?: VerifiedAppContact;
}

export interface ContactPickerButtonProps {
  currentUserPhone?: string;
  onOpenChatWithContact: (contact: VerifiedAppContact) => void;
}

/**
 * Formata e valida o número de telefone para o padrão internacional E.164 estrito:
 * - Preserva/garante exatamente um sinal '+' no início (sem duplicidade de '+').
 * - Remove espaços, parênteses, pontos, traços e quaisquer caracteres não numéricos do miolo.
 * - Trata prefixo zero de operadora/DDD local brasileiro (ex: 063992624090 -> +5563992624090) quando sem '+'.
 * - Garante que a string final (contando o '+') tenha entre 8 e 16 caracteres; retorna null se inválido.
 */
export function formatarParaE164Estrito(rawPhone: string): string | null {
  if (!rawPhone || typeof rawPhone !== 'string') {
    return null;
  }

  const hadExplicitPlus = rawPhone.trim().startsWith('+');

  // Remove espaços, parênteses, pontos, traços e sinais '+' do miolo, mantendo apenas dígitos
  let digitsOnly = rawPhone
    .replace(/[\s().+-]/g, '')
    .replace(/\D/g, '');

  if (!digitsOnly) {
    return null;
  }

  // Se veio da agenda sem '+' e começa com '0' (ex: 063992624090 ou 01563992624090)
  if (!hadExplicitPlus && digitsOnly.startsWith('0')) {
    if (digitsOnly.length === 11 || digitsOnly.length === 12) {
      // Ex: 0 + DDD (2) + número (8 ou 9)
      digitsOnly = digitsOnly.slice(1);
    } else if (digitsOnly.length === 13 || digitsOnly.length === 14) {
      // Ex: 0 + Operadora (2) + DDD (2) + número (8 ou 9)
      digitsOnly = digitsOnly.slice(3);
    }
  }

  // Se o número tem 10 ou 11 dígitos (DDD + número brasileiro) e não começa com 55, adiciona o DDI 55
  if (!hadExplicitPlus && (digitsOnly.length === 10 || digitsOnly.length === 11) && !digitsOnly.startsWith('55')) {
    digitsOnly = `55${digitsOnly}`;
  }

  // Garante obrigatoriamente um único '+' no início antes dos dígitos
  const e164Phone = `+${digitsOnly}`;

  // Validação de comprimento: entre 8 e 16 caracteres (incluindo o '+')
  if (e164Phone.length < 8 || e164Phone.length > 16) {
    return null;
  }

  return e164Phone;
}

export const formatPhoneToE164 = formatarParaE164Estrito;

/**
 * Gera variações canônicas de um telefone (com/sem DDI 55 e com/sem o 9º dígito brasileiro)
 * para garantir que o cruzamento encontre o usuário mesmo que o Firebase Auth ou a agenda
 * tenha salvo com ou sem o nono dígito ou DDI.
 */
export function getPhoneMatchKeys(rawPhone?: string): string[] {
  if (!rawPhone) return [];
  let digits = rawPhone.replace(/\D/g, '');
  if (!digits) return [];

  if (digits.startsWith('0')) {
    if (digits.length === 11 || digits.length === 12) digits = digits.slice(1);
    else if (digits.length === 13 || digits.length === 14) digits = digits.slice(3);
  }

  const keys = new Set<string>();
  keys.add(digits);

  // Variação sem DDI 55
  const national = digits.startsWith('55') && digits.length >= 12 ? digits.slice(2) : digits;
  keys.add(national);
  keys.add(`55${national}`);

  // Tratamento do 9º dígito brasileiro: DDD (2 dígitos) + 9 + 8 dígitos (11 dígitos nacionais)
  if (national.length === 11 && national.charAt(2) === '9') {
    const withoutNinth = national.slice(0, 2) + national.slice(3); // 10 dígitos (DDD + 8 dígitos)
    keys.add(withoutNinth);
    keys.add(`55${withoutNinth}`);
  } else if (national.length === 10) {
    const withNinth = national.slice(0, 2) + '9' + national.slice(2); // 11 dígitos (DDD + 9 + 8 dígitos)
    keys.add(withNinth);
    keys.add(`55${withNinth}`);
  }

  // Últimos 8 dígitos (número base assinante) caso o contato na agenda tenha sido salvo sem DDD
  if (national.length === 8 || (national.length === 9 && national.startsWith('9'))) {
    const base8 = national.length === 9 ? national.slice(1) : national;
    keys.add(base8);
  }

  return Array.from(keys);
}

/**
 * Compara dois números no formato E.164 ou nacional (tratando DDI +55 e 9º dígito do Brasil)
 */
export function isMatchingE164Phone(phoneA?: string, phoneB?: string): boolean {
  if (!phoneA || !phoneB) return false;
  const keysA = getPhoneMatchKeys(phoneA);
  const keysB = new Set(getPhoneMatchKeys(phoneB));
  for (const k of keysA) {
    if (keysB.has(k)) return true;
  }
  // Fallback se um dos números foi salvo na agenda apenas com 8/9 dígitos locais sem DDD
  const digitsA = phoneA.replace(/\D/g, '');
  const digitsB = phoneB.replace(/\D/g, '');
  if (digitsA.length >= 8 && digitsB.length >= 8) {
    const last8A = digitsA.slice(-8);
    const last8B = digitsB.slice(-8);
    if (last8A === last8B && (digitsA.length <= 9 || digitsB.length <= 9)) {
      return true;
    }
  }
  return false;
}

/**
 * Função assíncrona de validação no banco de dados (API + Firestore /users)
 * que recebe o número formatado em E.164 (+dígitos) e verifica se o usuário possui o app instalado.
 */
export async function verifyUserInDatabaseByPhone(
  e164Phone: string,
  fallbackContactName?: string
): Promise<DatabaseCheckResponse> {
  const validPhone = formatarParaE164Estrito(e164Phone);
  if (!validPhone) {
    return { exists: false };
  }

  // 1. Tenta endpoint de API do backend (/api/users/check), se disponível
  try {
    const response = await fetch(`/api/users/check?phone=${encodeURIComponent(validPhone)}`);
    if (response.ok) {
      const data = (await response.json()) as {
        exists?: boolean;
        user?: {
          displayName?: string;
          name?: string;
          phoneNumber?: string;
          photoURL?: string;
          avatarColor?: string;
          initial?: string;
        };
      };
      if (data.exists && data.user && data.user.phoneNumber) {
        const resolvedName =
          data.user.displayName || data.user.name || fallbackContactName || data.user.phoneNumber;
        return {
          exists: true,
          contact: {
            name: resolvedName,
            phoneNumber: formatarParaE164Estrito(data.user.phoneNumber) || data.user.phoneNumber,
            photoURL: data.user.photoURL,
            avatarColor: data.user.avatarColor || '#06B6D4',
            avatarLetter:
              data.user.initial || resolvedName.trim().charAt(0).toUpperCase() || 'U'
          }
        };
      }
    }
  } catch {
    // Segue silenciosamente para a verificação direta no Firestore
  }

  // 2. Verifica na coleção /users do banco de dados Firestore
  try {
    const usersSnap = await getDocs(collection(db, 'users'));
    let matchedUser: VerifiedAppContact | undefined;

    usersSnap.forEach((docSnap) => {
      if (matchedUser) return;
      const data = docSnap.data() as {
        phoneNumber?: string;
        authPhoneNumber?: string;
        displayName?: string;
        name?: string;
        photoURL?: string;
        avatarColor?: string;
        initial?: string;
      };
      const candidatePhone = data.phoneNumber || data.authPhoneNumber || '';
      if (
        candidatePhone &&
        (isMatchingE164Phone(validPhone, data.phoneNumber) ||
          isMatchingE164Phone(validPhone, data.authPhoneNumber))
      ) {
        const storedE164 = formatarParaE164Estrito(candidatePhone) || candidatePhone;
        const resolvedName =
          data.displayName ||
          data.name ||
          fallbackContactName ||
          storedE164;
        matchedUser = {
          name: resolvedName,
          phoneNumber: storedE164,
          photoURL: data.photoURL || undefined,
          avatarColor: data.avatarColor || '#06B6D4',
          avatarLetter:
            data.initial || resolvedName.trim().charAt(0).toUpperCase() || 'U'
        };
      }
    });

    if (matchedUser) {
      return {
        exists: true,
        contact: matchedUser
      };
    }
  } catch {
    // Caso offline, retorna não encontrado de forma segura
  }

  return { exists: false };
}

export const ContactPickerButton: React.FC<ContactPickerButtonProps> = ({
  currentUserPhone,
  onOpenChatWithContact
}) => {
  // Detectar Suporte Nativo: Android com Contact Picker API vs iOS / Desktop
  const [suportaAgenda] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return false;
    }
    const suportaAgendaNativa = 'contacts' in navigator && 'ContactsManager' in window;
    return suportaAgendaNativa;
  });

  const [manualPhoneInput, setManualPhoneInput] = useState<string>('');
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [notification, setNotification] = useState<{
    type: 'warning' | 'success' | 'info';
    message: string;
  } | null>(null);

  // Ambos os fluxos (agenda nativa ou digitação manual) passam obrigatoriamente por formatarParaE164Estrito
  const processSelectedPhone = async (rawPhone: string, contactName?: string): Promise<void> => {
    const formattedE164 = formatarParaE164Estrito(rawPhone);

    if (!formattedE164) {
      setNotification({
        type: 'warning',
        message: 'Número inválido. O telefone no formato internacional (+) deve ter entre 8 e 16 caracteres.'
      });
      return;
    }

    if (currentUserPhone && isMatchingE164Phone(formattedE164, currentUserPhone)) {
      setNotification({
        type: 'info',
        message: 'Este é o seu próprio número de telefone.'
      });
      return;
    }

    setIsChecking(true);
    setNotification(null);

    try {
      const result = await verifyUserInDatabaseByPhone(formattedE164, contactName);

      if (result.exists && result.contact) {
        setNotification({
          type: 'success',
          message: `Contato ${result.contact.name} encontrado! Abrindo conversa...`
        });
        setManualPhoneInput('');
        onOpenChatWithContact(result.contact);
        setTimeout(() => setNotification(null), 2500);
      } else {
        const displayLabel = contactName ? `${contactName} (${formattedE164})` : formattedE164;
        setNotification({
          type: 'warning',
          message: `O contato ${displayLabel} ainda não usa o aplicativo Tribbu'sChat.`
        });
      }
    } finally {
      setIsChecking(false);
    }
  };

  // Fluxo Android (Suportado): Abre a agenda nativa do celular via navigator.contacts.select
  const handlePickFromContacts = async (): Promise<void> => {
    setNotification(null);

    const nav = typeof navigator !== 'undefined' ? (navigator as NavigatorWithContacts) : undefined;
    if (!nav?.contacts?.select) {
      return;
    }

    try {
      const selectedContacts = await nav.contacts.select(['name', 'tel'], {
        multiple: false
      });

      if (!selectedContacts || selectedContacts.length === 0) {
        return;
      }

      const firstContact = selectedContacts[0];
      const rawPhone = firstContact.tel?.[0] || '';
      const rawName = firstContact.name?.[0]?.trim() || undefined;

      if (!rawPhone) {
        setNotification({
          type: 'warning',
          message: 'O contato selecionado não possui um número de telefone salvo.'
        });
        return;
      }

      await processSelectedPhone(rawPhone, rawName);
    } catch {
      // Silencioso caso o usuário cancele o seletor da agenda
    }
  };

  // Fluxo iOS / Desktop (Não Suportado): Submissão manual do campo de telefone
  const handleManualSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!manualPhoneInput.trim()) return;
    await processSelectedPhone(manualPhoneInput);
  };

  return (
    <div className="px-2.5 pb-2 bg-slate-950/80 border-b border-cyan-500/20 flex-shrink-0 space-y-2">
      {suportaAgenda ? (
        /* Interface para Android (Suportado): Botão padrão 'Buscar da Agenda do Celular' */
        <button
          type="button"
          onClick={handlePickFromContacts}
          disabled={isChecking}
          className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-cyan-950/70 via-slate-900/90 to-emerald-950/70 hover:from-cyan-900/70 hover:to-emerald-900/70 border border-cyan-400/40 hover:border-cyan-300 text-cyan-200 shadow-[0_0_14px_rgba(6,182,212,0.15)] hover:shadow-[0_0_20px_rgba(6,182,212,0.32)] flex items-center justify-center gap-2 transition-all text-xs font-bold cursor-pointer group active:scale-98 disabled:opacity-60"
          id="btnBuscarDaAgenda"
          title="Buscar contato diretamente da agenda nativa do celular"
        >
          {isChecking ? (
            <Loader2 className="w-4 h-4 text-cyan-400 animate-spin flex-shrink-0" />
          ) : (
            <Contact className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform flex-shrink-0" />
          )}
          <span className="truncate">Buscar da Agenda do Celular</span>
        </button>
      ) : (
        /* Interface para iOS / Desktop (Não Suportado): Campo de entrada de texto automático */
        <form
          onSubmit={handleManualSubmit}
          className="p-2.5 rounded-xl bg-slate-900/95 border border-cyan-500/30 space-y-1.5"
        >
          <label
            htmlFor="inputNumeroContatoAgenda"
            className="block text-[11px] font-semibold text-cyan-300 flex items-center gap-1.5"
          >
            <Phone className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
            <span>Digite o número do contato (Ex: +5511999998888)</span>
          </label>

          <div className="flex items-center gap-1.5">
            <div className="flex-1 flex items-center gap-2 bg-slate-950/90 border border-white/10 focus-within:border-cyan-400/60 rounded-lg px-2.5 py-1.5">
              <Search className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
              <input
                id="inputNumeroContatoAgenda"
                type="tel"
                value={manualPhoneInput}
                onChange={(e) => setManualPhoneInput(e.target.value)}
                placeholder="+5511999998888"
                className="bg-transparent border-none outline-none w-full text-xs text-white placeholder-white/35 focus:ring-0"
              />
            </div>
            <button
              type="submit"
              disabled={isChecking || !manualPhoneInput.trim()}
              className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-slate-950 font-extrabold text-xs transition cursor-pointer disabled:opacity-50 flex items-center gap-1 flex-shrink-0"
            >
              {isChecking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Buscar'}
            </button>
          </div>
        </form>
      )}

      {/* Notificação de resultado da validação no banco de dados */}
      {notification && (
        <div
          className={`p-2.5 rounded-xl border text-xs flex items-start justify-between gap-2 animate-in fade-in duration-150 ${
            notification.type === 'warning'
              ? 'bg-amber-500/10 border-amber-400/30 text-amber-200'
              : notification.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-400/30 text-emerald-200'
                : 'bg-cyan-500/10 border-cyan-400/30 text-cyan-200'
          }`}
          role="status"
        >
          <div className="flex items-start gap-2">
            {notification.type === 'warning' ? (
              <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            )}
            <span className="leading-snug font-medium">{notification.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-white/40 hover:text-white p-0.5 rounded-full cursor-pointer flex-shrink-0"
            title="Fechar aviso"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};

export default ContactPickerButton;
