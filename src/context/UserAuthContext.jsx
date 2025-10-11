import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

const UserAuthContext = createContext(null);

export const useUserAuth = () => {
  const context = useContext(UserAuthContext);
  if (context === null) {
    throw new Error('useUserAuth must be used within a UserAuthContextProvider');
  }
  return context;
};

export const UserAuthContextProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // True initially to check for session

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Could not fetch user session:', error);
      setUser(null);
      toast.error('Could not connect to the server to verify your session.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const sendOtp = async (email) => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        return true;
      } else {
        toast.error(data.error || 'Falha ao enviar OTP.');
        return false;
      }
    } catch (error) {
      toast.error('Ocorreu um erro ao enviar o OTP.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (email, otp) => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data.user);
        toast.success('Login bem-sucedido!');
        return true;
      } else {
        toast.error(data.error || 'Falha ao verificar OTP.');
        return false;
      }
    } catch (error) {
      toast.error('Ocorreu um erro ao verificar o OTP.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const signup = async (name, email) => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Cadastro bem-sucedido! Prossiga para o login com OTP.');
        return true;
      } else {
        toast.error(data.error || 'Falha no cadastro.');
        return false;
      }
    } catch (error) {
      toast.error('Ocorreu um erro durante o cadastro.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (res.ok) {
        setUser(null);
        toast.info('Você foi desconectado.');
      } else {
        toast.error('Falha ao desconectar.');
      }
    } catch (error) {
      toast.error('Ocorreu um erro durante o logout.');
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    loading,
    sendOtp,
    verifyOtp,
    signup,
    logout,
    fetchUser,
  };

  return (
    <UserAuthContext.Provider value={value}>
      {children}
    </UserAuthContext.Provider>
  );
};

