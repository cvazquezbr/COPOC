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
    setLoading(true);
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

      // Handle user not found specifically
      if (res.status === 404) {
        return { success: false, error: 'User not found' };
      }

      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'OTP sent successfully!');
        return { success: true };
      } else {
        // Handle other errors
        toast.error(data.message || 'Falha ao enviar OTP.');
        return { success: false, error: data.message || 'Falha ao enviar OTP.' };
      }
    } catch (error) {
      console.error("sendOtp network error:", error);
      toast.error('Ocorreu um erro de rede ao enviar o OTP.');
      return { success: false, error: 'Network error' };
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (email, otp) => {
    setLoading(true);
    try {
      // Corrected endpoint from /verify-otp to /login
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });
      const data = await res.json();
      if (res.ok) {
        // The API returns the user object directly
        setUser(data);
        toast.success('Login bem-sucedido!');
        return true;
      } else {
        // API returns { message: '...' } on error
        toast.error(data.message || 'Falha ao verificar OTP.');
        return false;
      }
    } catch (error) {
      console.error("verifyOtp network error:", error);
      toast.error('Ocorreu um erro de rede ao verificar o OTP.');
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
        // API returns { message: '...' } on error
        toast.error(data.message || 'Falha no cadastro.');
        return false;
      }
    } catch (error) {
      console.error("signup network error:", error);
      toast.error('Ocorreu um erro durante o cadastro.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      // This endpoint doesn't exist yet, but we'll leave the call here
      // for future implementation.
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (res.ok) {
        setUser(null);
        toast.info('Você foi desconectado.');
      } else {
        // For now, we log out on the client even if the server fails
        setUser(null);
        toast.error('Falha ao desconectar do servidor, mas a sessão local foi limpa.');
      }
    } catch (error) {
      setUser(null);
      toast.error('Ocorreu um erro de rede durante o logout.');
    } finally {
      setLoading(false);
    }
  };

  const updateUserSettings = async (newSettings) => {
    try {
      const res = await fetch('/api/user/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });
      if (res.ok) {
        toast.success('Configurações salvas com sucesso!');
        // Optimistically update the user state
        setUser(currentUser => ({...currentUser, ...newSettings}));
        return true;
      } else {
        const errorData = await res.json();
        toast.error(errorData.message || 'Falha ao salvar as configurações.');
        return false;
      }
    } catch (error) {
      console.error("updateUserSettings network error:", error);
      toast.error('Ocorreu um erro de rede ao salvar as configurações.');
      return false;
    }
  };

  const updateSetting = (key, value) => {
    setUser((prev) => ({ ...prev, [key]: value }));
  };

  const saveSettings = async (settingsToSave) => {
    try {
      const response = await fetch('/api/user/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsToSave),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save settings');
      }

      toast.success('Settings saved successfully!');
      fetchUser(); // Refresh user data
    } catch (error) {
      console.error(error);
      toast.error(`Error saving settings: ${error.message}`);
      throw error;
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
    updateSetting,
    saveSettings
  };

  return (
    <UserAuthContext.Provider value={value}>
      {children}
    </UserAuthContext.Provider>
  );
};