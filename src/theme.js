import { createTheme } from '@mui/material/styles';

// Temas atualizados com o novo padrão Glass
export const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#8b5cf6', // Purple
    },
    secondary: {
      main: '#ec4899', // Pink
    },
    background: {
      default: 'transparent', // Fundo principal transparente
      paper: 'rgba(255, 255, 255, 0.7)', // Papel com transparência
    },
    text: {
      primary: '#1f2937',
      secondary: '#4b5563',
    }
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: { fontWeight: 700 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
  },
  components: {
    // Aplicando o efeito Glass no AppBar
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(255, 255, 255, 0.5)',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.05)',
          borderBottom: '1px solid rgba(229, 231, 235, 0.8)', // e5e7eb com alpha
        }
      }
    },
    // Aplicando o efeito Glass no Drawer
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: 'rgba(255, 255, 255, 0.6)',
          backdropFilter: 'blur(12px)',
          borderRight: '1px solid rgba(229, 231, 235, 0.9)', // e5e7eb com alpha
        }
      }
    },
    // Aplicando o efeito Glass nos Cards
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(255, 255, 255, 0.7)',
          backdropFilter: 'blur(10px)',
          borderRadius: 16,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
          border: '1px solid rgba(229, 231, 235, 1)', // e5e7eb
        }
      }
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 600,
        },
        contained: {
          background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
          '&:hover': {
            background: 'linear-gradient(135deg, #7c3aed 0%, #db2777 100%)',
          }
        }
      }
    },
    // Ajustando o Input para o novo design
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          backgroundColor: 'rgba(241, 245, 249, 0.7)', // slate-100 com alpha
          backdropFilter: 'blur(5px)',
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(226, 232, 240, 0.8)', // slate-200 com alpha
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: '#a78bfa', // primary.light
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#8b5cf6', // primary.main
            borderWidth: '2px',
          },
        }
      }
    }
  }
});

export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#a78bfa',
    },
    secondary: {
      main: '#f472b6',
    },
    background: {
      default: 'transparent', // Fundo principal transparente
      paper: 'rgba(30, 41, 59, 0.7)', // Cor do 'paper' antigo com alpha
    },
    text: {
      primary: '#f1f5f9',
      secondary: '#cbd5e1',
    }
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
  },
  components: {
    // Aplicando o efeito Glass no AppBar (Dark Mode)
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(30, 41, 59, 0.5)', // Cor do 'paper' com alpha
          backdropFilter: 'blur(12px)',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
          borderBottom: '1px solid rgba(51, 65, 85, 0.8)', // slate-700 com alpha
        }
      }
    },
    // Aplicando o efeito Glass no Drawer (Dark Mode)
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: 'rgba(30, 41, 59, 0.6)', // Cor do 'paper' com alpha
          backdropFilter: 'blur(12px)',
          borderRight: '1px solid rgba(51, 65, 85, 0.9)', // slate-700 com alpha
        }
      }
    },
    // Aplicando o efeito Glass nos Cards (Dark Mode)
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(30, 41, 59, 0.7)', // Cor do 'paper' com alpha
          backdropFilter: 'blur(10px)',
          borderRadius: 16,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
          border: '1px solid rgba(51, 65, 85, 1)', // slate-700
        }
      }
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 600,
        },
        contained: {
          background: 'linear-gradient(135deg, #a78bfa 0%, #f472b6 100%)',
          '&:hover': {
            background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
          }
        }
      }
    },
    // Ajustando o Input para o novo design (Dark Mode)
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          backgroundColor: 'rgba(30, 41, 59, 0.7)', // background.paper com alpha
          backdropFilter: 'blur(5px)',
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(71, 85, 105, 0.8)', // slate-600 com alpha
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: '#a78bfa', // primary.main
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#c4b5fd', // primary.light
            borderWidth: '2px',
          },
        }
      }
    }
  }
});
