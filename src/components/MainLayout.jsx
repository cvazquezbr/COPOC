import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  AppBar as MuiAppBar,
  Toolbar,
  IconButton,
  Typography,
  Menu,
  MenuItem,
  Drawer as MuiDrawer,
  List,
  ListItem,
  ListItemText,
  CssBaseline,
  Divider,
  ListItemIcon,
  ListItemButton,
  useTheme,
  styled,
  Button,
  useMediaQuery,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import AccountCircle from '@mui/icons-material/AccountCircle';
import SettingsIcon from '@mui/icons-material/Settings';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import AddIcon from '@mui/icons-material/Add';
import DescriptionIcon from '@mui/icons-material/Description';
import ArticleIcon from '@mui/icons-material/Article';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import DeleteIcon from '@mui/icons-material/Delete';
import Checkbox from '@mui/material/Checkbox';

import { useUserAuth } from '../context/UserAuthContext';
import { useLayout } from '../context/LayoutContext';
import { useTheme as useAppTheme } from '../context/ThemeContext';
import SetupModal from './SetupModal';
import { getBriefings } from '../utils/briefingState';
import { deleteTranscriptionsBatch } from '../utils/transcriptionState';
import { toast } from 'sonner';

const drawerWidth = 280;

const openedMixin = (theme) => ({
  width: drawerWidth,
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen,
  }),
  overflowX: 'hidden',
});

const closedMixin = (theme) => ({
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  overflowX: 'hidden',
  width: `calc(${theme.spacing(7)} + 1px)`,
  [theme.breakpoints.up('sm')]: {
    width: `calc(${theme.spacing(8)} + 1px)`,
  },
});

const DrawerHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: theme.spacing(0, 1),
  ...theme.mixins.toolbar,
}));

const AppBar = styled(MuiAppBar, {
  shouldForwardProp: (prop) => prop !== 'open',
})(({ theme, open, isMobile }) => ({
  zIndex: theme.zIndex.drawer + 1,
  transition: theme.transitions.create(['width', 'margin'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  ...(!isMobile && open && {
    marginLeft: drawerWidth,
    width: `calc(100% - ${drawerWidth}px)`,
    transition: theme.transitions.create(['width', 'margin'], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
  }),
}));

const DesktopDrawer = styled(MuiDrawer, { shouldForwardProp: (prop) => prop !== 'open' })(
  ({ theme, open }) => ({
    width: drawerWidth,
    flexShrink: 0,
    whiteSpace: 'nowrap',
    boxSizing: 'border-box',
    ...(open && {
      ...openedMixin(theme),
      '& .MuiDrawer-paper': openedMixin(theme),
    }),
    ...(!open && {
      ...closedMixin(theme),
      '& .MuiDrawer-paper': closedMixin(theme),
    }),
  }),
);

const MainLayout = () => {
  const theme = useTheme();
  const { mode, toggleTheme } = useAppTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useUserAuth();
  const {
    briefings,
    fetchBriefings,
    setSelectedBriefingId,
    selectedBriefingId,
    transcriptions,
    fetchTranscriptions,
    setSelectedTranscriptionId,
    selectedTranscriptionId,
    checkedTranscriptionIds,
    setCheckedTranscriptionIds,
    isDrawerOpen,
    setDrawerOpen,
  } = useLayout();

  const isBriefingPage = location.pathname.startsWith('/briefings') || location.pathname.startsWith('/briefing-template');
  const isTranscriptionPage = location.pathname.startsWith('/avaliacoes');

  // Reset checkboxes when leaving transcription page
  useEffect(() => {
    if (!isTranscriptionPage) {
      setCheckedTranscriptionIds([]);
    }
  }, [isTranscriptionPage, setCheckedTranscriptionIds]);

  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (isBriefingPage) {
      fetchBriefings();
    } else if (isTranscriptionPage) {
      fetchTranscriptions();
    }
  }, [fetchBriefings, fetchTranscriptions, isBriefingPage, isTranscriptionPage]);

  const handleDrawerToggle = () => {
    if (isMobile) {
      setMobileOpen(!mobileOpen);
    } else {
      setDrawerOpen(!isDrawerOpen);
    }
  };

  const handleMenu = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleClose();
    logout();
  };

  const handleNewItem = () => {
    if (isBriefingPage) {
      setSelectedBriefingId(null);
      navigate('/briefings');
    } else if (isTranscriptionPage) {
      setSelectedTranscriptionId(null);
      setCheckedTranscriptionIds([]);
      navigate('/avaliacoes');
    }
    if (isMobile) setMobileOpen(false);
  };

  const handleSelectBriefing = (id) => {
    setSelectedBriefingId(id);
    navigate('/briefings');
    if (isMobile) setMobileOpen(false);
  };

  const handleSelectTranscription = (id) => {
    setSelectedTranscriptionId(id);
    navigate('/avaliacoes');
    if (isMobile) setMobileOpen(false);
  };

  const handleToggleTranscriptionCheck = (id, event) => {
    event.stopPropagation();
    setCheckedTranscriptionIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleDeleteSelectedTranscriptions = async () => {
    if (checkedTranscriptionIds.length === 0) return;

    if (window.confirm(`Tem certeza que deseja excluir ${checkedTranscriptionIds.length} avaliação(ões)?`)) {
      try {
        await deleteTranscriptionsBatch(checkedTranscriptionIds);
        toast.success(`${checkedTranscriptionIds.length} avaliação(ões) excluída(s) com sucesso.`);

        // If the currently viewed transcription was deleted, clear it
        if (checkedTranscriptionIds.includes(selectedTranscriptionId)) {
          setSelectedTranscriptionId(null);
        }

        setCheckedTranscriptionIds([]);
        await fetchTranscriptions();
      } catch (error) {
        console.error('Error deleting transcriptions:', error);
      }
    }
  };

  const drawerContent = (
    <div>
      <DrawerHeader>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleNewItem}
          sx={{
            margin: 'auto',
            flexGrow: 1,
            mr: 1,
            ml: 1,
            opacity: isMobile || isDrawerOpen ? 1 : 0,
            transition: 'opacity 0.2s',
          }}
        >
          {isBriefingPage ? 'Novo Briefing' : 'Nova Avaliação'}
        </Button>
        <IconButton onClick={() => (isMobile ? setMobileOpen(false) : setDrawerOpen(false))}>
          <ChevronLeftIcon />
        </IconButton>
      </DrawerHeader>
      <Divider />
      {isTranscriptionPage && checkedTranscriptionIds.length > 0 && (
        <>
          <Box sx={{ p: 1, display: 'flex', justifyContent: 'center' }}>
            <Button
              variant="contained"
              color="error"
              startIcon={<DeleteIcon />}
              fullWidth
              size="small"
              onClick={handleDeleteSelectedTranscriptions}
              sx={{
                opacity: isMobile || isDrawerOpen ? 1 : 0,
                transition: 'opacity 0.2s',
              }}
            >
              Excluir ({checkedTranscriptionIds.length})
            </Button>
          </Box>
          <Divider />
        </>
      )}
      <List>
        {isBriefingPage && briefings.map((briefing) => (
          <ListItem key={briefing.id} disablePadding sx={{ display: 'block' }}>
            <ListItemButton
              selected={selectedBriefingId === briefing.id}
              onClick={() => handleSelectBriefing(briefing.id)}
              sx={{
                minHeight: 48,
                justifyContent: isDrawerOpen || isMobile ? 'initial' : 'center',
                px: 2.5,
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 0,
                  mr: isDrawerOpen || isMobile ? 3 : 'auto',
                  justifyContent: 'center',
                }}
              >
                <DescriptionIcon />
              </ListItemIcon>
              <ListItemText primary={briefing.name} sx={{ opacity: isDrawerOpen || isMobile ? 1 : 0 }} />
            </ListItemButton>
          </ListItem>
        ))}
        {isTranscriptionPage && transcriptions.map((transcription) => (
          <ListItem
            key={transcription.id}
            disablePadding
            sx={{ display: 'block' }}
            secondaryAction={
              (isDrawerOpen || isMobile) && (
                <Checkbox
                  edge="end"
                  onChange={(e) => handleToggleTranscriptionCheck(transcription.id, e)}
                  checked={checkedTranscriptionIds.includes(transcription.id)}
                  onClick={(e) => e.stopPropagation()}
                />
              )
            }
          >
            <ListItemButton
              selected={selectedTranscriptionId === transcription.id}
              onClick={() => handleSelectTranscription(transcription.id)}
              sx={{
                minHeight: 48,
                justifyContent: isDrawerOpen || isMobile ? 'initial' : 'center',
                px: 2.5,
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 0,
                  mr: isDrawerOpen || isMobile ? 3 : 'auto',
                  justifyContent: 'center',
                }}
              >
                <DescriptionIcon />
              </ListItemIcon>
              <ListItemText
                primary={transcription.name}
                sx={{
                  opacity: isDrawerOpen || isMobile ? 1 : 0,
                  pr: (isDrawerOpen || isMobile) ? 4 : 0, // Add padding to avoid overlap with checkbox
                }}
                primaryTypographyProps={{
                  noWrap: true,
                }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </div>
  );

  return (
    <>
      <Box sx={{ display: 'flex' }}>
        <CssBaseline />
        <AppBar position="fixed" open={!isMobile && isDrawerOpen} isMobile={isMobile}>
          <Toolbar>
            {(isBriefingPage || isTranscriptionPage) && (
              <IconButton
                color="inherit"
                aria-label="open drawer"
                onClick={handleDrawerToggle}
                edge="start"
                sx={{
                  marginRight: 2,
                  ...((!isMobile && isDrawerOpen) && { display: 'none' }),
                }}
              >
                <MenuIcon />
              </IconButton>
            )}
            <Box sx={{ flexGrow: 1 }} />
            {isBriefingPage &&
              <IconButton
                color="inherit"
                onClick={() => navigate('/briefing-template')}
                aria-label="Edit Template"
              >
                <ArticleIcon />
              </IconButton>
            }
            <IconButton sx={{ ml: 1 }} onClick={toggleTheme} color="inherit" aria-label="Toggle theme">
              {mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
            </IconButton>
            <IconButton
              color="inherit"
              onClick={() => setSetupModalOpen(true)}
              aria-label="Settings"
            >
              <SettingsIcon />
            </IconButton>
            <div>
              <IconButton
                size="large"
                aria-label="account of current user"
                aria-controls="menu-appbar"
                aria-haspopup="true"
                onClick={handleMenu}
                color="inherit"
              >
                <AccountCircle />
              </IconButton>
              <Menu
                id="menu-appbar"
                anchorEl={anchorEl}
                anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                keepMounted
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                open={Boolean(anchorEl)}
                onClose={handleClose}
              >
                <MenuItem onClick={handleLogout}>Logout</MenuItem>
              </Menu>
            </div>
          </Toolbar>
        </AppBar>
        {(isBriefingPage || isTranscriptionPage) && (
          <Box
            component="nav"
            sx={{ width: { sm: isDrawerOpen ? drawerWidth : `calc(${theme.spacing(7)} + 1px)` }, flexShrink: { sm: 0 } }}
          >
            {isMobile ? (
              <MuiDrawer
                variant="temporary"
                open={mobileOpen}
                onClose={handleDrawerToggle}
                ModalProps={{ keepMounted: true }}
                sx={{
                  '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
                }}
              >
                {drawerContent}
              </MuiDrawer>
            ) : (
              <DesktopDrawer variant="permanent" open={isDrawerOpen}>
                {drawerContent}
              </DesktopDrawer>
            )}
          </Box>
        )}
        <Box component="main" sx={{ flexGrow: 1, p: 3, minHeight: '100vh', width: '100%' }}>
          <Toolbar />
          <Outlet />
        </Box>
      </Box>
      <SetupModal open={setupModalOpen} onClose={() => setSetupModalOpen(false)} />
    </>
  );
};

export default MainLayout;