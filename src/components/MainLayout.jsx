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

import { useUserAuth } from '../context/UserAuthContext';
import { useLayout } from '../context/LayoutContext';
import { useTheme as useAppTheme } from '../context/ThemeContext';
import SetupModal from './SetupModal';
import { getBriefings } from '../utils/briefingState';

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
    isDrawerOpen,
    setDrawerOpen,
  } = useLayout();

  const isBriefingPage = location.pathname === '/briefings';

  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    fetchBriefings();
  }, [fetchBriefings]);

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

  const handleNewBriefing = () => {
    setSelectedBriefingId(null);
    navigate('/briefings');
    if (isMobile) setMobileOpen(false);
  };

  const handleSelectBriefing = (id) => {
    setSelectedBriefingId(id);
    navigate('/briefings');
    if (isMobile) setMobileOpen(false);
  };

  const drawerContent = isBriefingPage ? (
    <div>
      <DrawerHeader>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleNewBriefing}
          sx={{
            margin: 'auto',
            flexGrow: 1,
            mr: 1,
            ml: 1,
            opacity: isMobile || isDrawerOpen ? 1 : 0,
            transition: 'opacity 0.2s',
          }}
        >
          Novo Briefing
        </Button>
        <IconButton onClick={() => isMobile ? setMobileOpen(false) : setDrawerOpen(false)}>
          <ChevronLeftIcon />
        </IconButton>
      </DrawerHeader>
      <Divider />
      <List>
        {briefings.map((briefing) => (
          <ListItem key={briefing.id} disablePadding sx={{ display: 'block' }}>
            <ListItemButton
              selected={selectedBriefingId === briefing.id}
              onClick={() => handleSelectBriefing(briefing.id)}
              sx={{
                minHeight: 48,
                justifyContent: (isDrawerOpen || isMobile) ? 'initial' : 'center',
                px: 2.5,
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 0,
                  mr: (isDrawerOpen || isMobile) ? 3 : 'auto',
                  justifyContent: 'center',
                }}
              >
                <DescriptionIcon />
              </ListItemIcon>
              <ListItemText primary={briefing.name} sx={{ opacity: (isDrawerOpen || isMobile) ? 1 : 0 }} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </div>
  ) : null;

  return (
    <>
      <Box sx={{ display: 'flex' }}>
        <CssBaseline />
        <AppBar position="fixed" open={!isMobile && isDrawerOpen} isMobile={isMobile}>
          <Toolbar>
            {isBriefingPage && (
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
            <IconButton
              color="inherit"
              onClick={() => navigate('/briefing-template')}
              aria-label="Edit Template"
            >
              <ArticleIcon />
            </IconButton>
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
        {isBriefingPage && (
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
        <Box component="main" sx={{ flexGrow: 1, p: 3, minHeight: '100vh' }}>
          <Toolbar />
          <Outlet />
        </Box>
      </Box>
      <SetupModal open={setupModalOpen} onClose={() => setSetupModalOpen(false)} />
    </>
  );
};

export default MainLayout;