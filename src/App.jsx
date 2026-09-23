import React, { useState, useEffect } from 'react';
import Cadastro from './components/Cadastro.jsx';
import LoginScreen from './components/LoginScreen';
import MainChatApp from './App.tsx';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { isUserProfileComplete } from './types';

/**
 * Função utilitária de navegação SPA para troca dinâmica de rotas
 * sem recarregar a página, sincronizando o histórico e disparando eventos
 * popstate e app-route-change.
 */
export function navigate(toPath) {
  if (typeof window !== 'undefined') {
    if (window.location.pathname !== toPath) {
      window.history.pushState(null, '', toPath);
    }
    window.dispatchEvent(new Event('popstate'));
    window.dispatchEvent(new CustomEvent('app-route-change', { detail: toPath }));
  }
}

/**
 * Roteador oficial do Tribbu'sChat (App.jsx)
 * 
 * Regras e Rotas:
 * 1. ROTA /cadastro: Aponta diretamente para Cadastro.jsx.
 *    ACESSO 100% LIVRE: Todo e qualquer mecanismo de rota protegida foi REMOVIDO.
 *    O usuário que acabou de validar o SMS (ou qualquer acesso direto à URL /cadastro)
 *    tem acesso imediato para cadastrar seu Nome de Exibição e Foto de Perfil antes de ir ao /chat.
 * 2. ROTA /login: Tela de autenticação por número de telefone via SMS.
 * 3. ROTA /chat e Default: Área principal do chat da Tribbu.
 */
export default function App() {
  const [currentRoute, setCurrentRoute] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.location.pathname || '/';
    }
    return '/';
  });

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

  // Listener contínuo de sincronização de rotas com a barra do navegador
  useEffect(() => {
    const handleRouteChange = () => {
      if (typeof window !== 'undefined') {
        setCurrentRoute(window.location.pathname);
      }
    };

    window.addEventListener('popstate', handleRouteChange);
    window.addEventListener('app-route-change', handleRouteChange);
    return () => {
      window.removeEventListener('popstate', handleRouteChange);
      window.removeEventListener('app-route-change', handleRouteChange);
    };
  }, []);

  // Observa o estado de autenticação do Firebase para preencher o telefone nos dados pendentes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      if (fbUser) {
        const phone = fbUser.phoneNumber || (fbUser.email?.includes('@zapchat.phone') ? ('+' + fbUser.email.replace('@zapchat.phone', '')) : '');
        const pending = {
          uid: fbUser.uid,
          phoneNumber: phone,
          email: fbUser.email || undefined,
          photoURL: fbUser.photoURL || undefined
        };
        setPendingCadastroUser((prev) => prev || pending);
      }
    });

    return () => unsubscribe();
  }, []);

  // =========================================================================
  // 1. ROTA /cadastro: Aponta diretamente para Cadastro.jsx
  // ACESSO 100% LIVRE - REMOVIDO QUALQUER BLOQUEIO OU MECANISMO DE ROTA PROTEGIDA
  // =========================================================================
  const isCadastroRoute = 
    currentRoute === '/cadastro' || 
    (typeof window !== 'undefined' && window.location.pathname === '/cadastro');

  if (isCadastroRoute) {
    return (
      <Cadastro
        user={pendingCadastroUser || userSession || auth.currentUser}
        onComplete={(session, idToken) => {
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
  // 2. ROTA /login: Tela de autenticação por telefone SMS
  // =========================================================================
  if (currentRoute === '/login') {
    return (
      <LoginScreen
        onLoginSuccess={(session) => {
          setUserSession(session);
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
  // 3. ROTA /chat e Default: Área principal do Tribbu'sChat
  // =========================================================================
  return (
    <MainChatApp />
  );
}
