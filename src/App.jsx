import React, { useState, useEffect, useCallback } from 'react';
import Cadastro from './components/Cadastro.jsx';
import LoginScreen from './components/LoginScreen';
import MainChatApp from './App.tsx';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { isUserProfileComplete } from './types';
import { getNormalizedPath, navigate } from './utils/navigation';

export { getNormalizedPath, navigate };

/**
 * Roteador Oficial do Tribbu'sChat (App.jsx)
 * 
 * Regras de Proteção e Rotas:
 * 1. ROTA /cadastro:
 *    - ACESSO 100% LIVRE para usuários autenticados via SMS que ainda NÃO possuem dados salvos na coleção /users do Firestore.
 *    - Impede que o sistema o jogue de volta para o /login (o SMS já foi validado).
 *    - Impede que o sistema o jogue direto para o /chat antes de preencher o Nome de Exibição e a Foto de Perfil.
 * 2. ROTA /login:
 *    - Exibida apenas para quem NÃO está autenticado via SMS.
 * 3. ROTA /chat:
 *    - Acessível exclusivamente quando o perfil do usuário na coleção /users estiver 100% salvo e completo.
 */
export default function App() {
  const [currentRoute, setCurrentRoute] = useState(() => {
    if (typeof window !== 'undefined') {
      return getNormalizedPath(window.location.pathname);
    }
    return '/';
  });

  const [currentUser, setCurrentUser] = useState(() => auth.currentUser);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [hasCompletedProfile, setHasCompletedProfile] = useState(false);

  const [pendingCadastroUser, setPendingCadastroUser] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem('tribbu_pending_user');
        if (saved) return JSON.parse(saved);
      } catch (_) {}
    }
    return null;
  });

  const [userSession, setUserSession] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('zapchat_user');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (isUserProfileComplete(parsed)) return parsed;
        }
      } catch (_) {}
    }
    return null;
  });

  // Listener contínuo de sincronização de rotas com o navegador (popstate e app-route-change)
  useEffect(() => {
    const handleRouteChange = () => {
      if (typeof window !== 'undefined') {
        const path = getNormalizedPath(window.location.pathname);
        setCurrentRoute(path);
      }
    };

    window.addEventListener('popstate', handleRouteChange);
    window.addEventListener('app-route-change', handleRouteChange);
    return () => {
      window.removeEventListener('popstate', handleRouteChange);
      window.removeEventListener('app-route-change', handleRouteChange);
    };
  }, []);

  // Monitora autenticação Firebase e sincroniza em tempo real com a coleção /users do Firestore
  useEffect(() => {
    let unsubscribeFirestore = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (fbUser) => {
      setCurrentUser(fbUser);
      setIsAuthReady(true);

      if (unsubscribeFirestore) {
        unsubscribeFirestore();
        unsubscribeFirestore = null;
      }

      if (fbUser) {
        const derivedPhone = fbUser.phoneNumber || (fbUser.email?.includes('@zapchat.phone') ? ('+' + fbUser.email.replace('@zapchat.phone', '')) : '') || '';
        const pending = {
          uid: fbUser.uid,
          phoneNumber: derivedPhone,
          email: fbUser.email || undefined,
          photoURL: fbUser.photoURL || undefined
        };
        setPendingCadastroUser((prev) => prev || pending);

        try {
          const userDocRef = doc(db, 'users', fbUser.uid);
          
          // Ouve em tempo real se o documento do usuário já existe e está completo na coleção /users
          unsubscribeFirestore = onSnapshot(userDocRef, (docSnap) => {
            const data = docSnap.exists() ? docSnap.data() : null;
            const complete = isUserProfileComplete(data);
            
            setHasCompletedProfile(complete);

            if (complete) {
              // Usuário já possui perfil completo salvo no Firestore
              const session = {
                uid: fbUser.uid,
                phoneNumber: data?.phoneNumber || derivedPhone,
                displayName: data?.displayName || '',
                initial: data?.initial || data?.displayName?.charAt(0).toUpperCase() || 'U',
                avatarColor: data?.avatarColor || '#06B6D4',
                photoURL: data?.photoURL || fbUser.photoURL || undefined,
                about: data?.about || 'Disponível na Tribbu',
                profileCompleted: true
              };
              setUserSession(session);
              try {
                localStorage.setItem('zapchat_user', JSON.stringify(session));
              } catch (_) {}

              // Se o perfil já está completo e ainda está em /cadastro ou /login, redireciona para /chat
              const curPath = typeof window !== 'undefined' ? getNormalizedPath(window.location.pathname) : '';
              if (curPath === '/login' || curPath === '/cadastro') {
                navigate('/chat');
              }
            } else {
              // USUÁRIO AUTENTICADO VIA SMS, MAS QUE AINDA NÃO POSSUI DADOS SALVOS NA COLEÇÃO /users:
              // Permite explicitamente acesso livre à rota /cadastro!
              // Evita estritamente que seja jogado para /login ou direto para /chat antes de preencher Nome e Foto
              setUserSession(null);
              const curPath = typeof window !== 'undefined' ? getNormalizedPath(window.location.pathname) : '';
              if (curPath !== '/cadastro') {
                navigate('/cadastro');
              }
            }
          }, (err) => {
            console.warn('[App.jsx] Consulta Firestore na coleção /users:', err);
          });
        } catch (err) {
          console.warn('[App.jsx] Erro ao conectar listener Firestore:', err);
        }
      } else {
        // Usuário deslogado
        setCurrentUser(null);
        setHasCompletedProfile(false);
        setUserSession(null);
        setPendingCadastroUser(null);
        
        // Se estava no /chat, redireciona para /login
        const curPath = typeof window !== 'undefined' ? getNormalizedPath(window.location.pathname) : '';
        if (curPath === '/chat') {
          navigate('/login');
        }
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeFirestore) unsubscribeFirestore();
    };
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await signOut(auth);
    } catch (_) {}
    setCurrentUser(null);
    setHasCompletedProfile(false);
    setUserSession(null);
    setPendingCadastroUser(null);
    try {
      localStorage.removeItem('zapchat_user');
      localStorage.removeItem('zapchat_token');
      sessionStorage.removeItem('tribbu_pending_user');
      localStorage.removeItem('tribbu_pending_phone');
    } catch (_) {}
    await navigate('/login');
  }, []);

  const normalizedCurrent = getNormalizedPath(currentRoute);
  const normalizedWindow = typeof window !== 'undefined' ? getNormalizedPath(window.location.pathname) : '';
  const isExplicitCadastroRoute = 
    normalizedCurrent === '/cadastro' || 
    normalizedCurrent.startsWith('/cadastro') ||
    normalizedWindow === '/cadastro' ||
    normalizedWindow.startsWith('/cadastro');

  // Identifica se o usuário precisa preencher o cadastro:
  // Está autenticado via SMS mas ainda NÃO possui dados salvos na coleção /users,
  // ou já possui dados pendentes no sessionStorage vindos da tela de login
  const isPendingCadastro = Boolean(
    (currentUser && !hasCompletedProfile) ||
    (pendingCadastroUser && !hasCompletedProfile)
  );

  // Aguarda a resolução inicial da autenticação Firebase para evitar transição dupla (tela de login piscando e logo em seguida tela de conversa)
  if (!isAuthReady) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950 font-sans antialiased text-white select-none">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
          <p className="text-xs text-white/60 font-medium tracking-wide">Carregando Tribbu'sChat...</p>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 1. ROTA /cadastro: Aponta diretamente para Cadastro.jsx
  // ACESSO 100% LIVRE PARA QUEM VALIDA SMS MAS NÃO TEM CADASTRO NO /users
  // Impede que o sistema o jogue de volta para o /login ou direto para o /chat
  // =========================================================================
  if (isExplicitCadastroRoute || isPendingCadastro) {
    // Se o perfil já estiver comprovadamente completo no Firestore, vai para o chat
    if (hasCompletedProfile && userSession && !isExplicitCadastroRoute) {
      return <MainChatApp userSession={userSession} onLogout={handleLogout} />;
    }

    return (
      <Cadastro
        user={pendingCadastroUser || currentUser || userSession}
        onComplete={(session, idToken) => {
          setHasCompletedProfile(true);
          setUserSession(session);
          setPendingCadastroUser(null);
          try {
            sessionStorage.removeItem('tribbu_pending_user');
            localStorage.setItem('zapchat_user', JSON.stringify(session));
            if (idToken) {
              localStorage.setItem('zapchat_token', idToken);
            }
          } catch (_) {}
          navigate('/chat');
        }}
        onNavigate={navigate}
        onCancel={() => {
          setPendingCadastroUser(null);
          try {
            sessionStorage.removeItem('tribbu_pending_user');
          } catch (_) {}
          navigate('/login');
        }}
      />
    );
  }

  // =========================================================================
  // 2. ROTA /login: Tela de autenticação por telefone SMS (apenas para não autenticados)
  // =========================================================================
  if (!currentUser || (normalizedCurrent === '/login' && !hasCompletedProfile)) {
    return (
      <LoginScreen
        onLoginSuccess={(session) => {
          setUserSession(session);
          setHasCompletedProfile(true);
          navigate('/chat');
        }}
        onNavigateToCadastro={(pending) => {
          setPendingCadastroUser(pending);
          try {
            sessionStorage.setItem('tribbu_pending_user', JSON.stringify(pending));
          } catch (_) {}
          navigate('/cadastro');
        }}
      />
    );
  }

  // =========================================================================
  // 3. ROTA /chat e Default: Área principal do Tribbu'sChat (usuário com perfil completo no /users)
  // =========================================================================
  const effectiveSession = userSession || (currentUser ? {
    uid: currentUser.uid,
    phoneNumber: currentUser.phoneNumber || '',
    displayName: currentUser.displayName || 'Usuário',
    initial: (currentUser.displayName || 'U').charAt(0).toUpperCase(),
    avatarColor: '#06B6D4'
  } : null);

  return (
    <MainChatApp userSession={effectiveSession} onLogout={handleLogout} />
  );
}
