import React, { useState } from 'react';
import { Outlet, useLocation, Link as RouterLink } from 'react-router-dom';
import {
  Box, AppBar, Toolbar, IconButton, Typography, Button, Menu, MenuItem, Drawer, List, ListItem, ListItemText, CssBaseline, useTheme, useMediaQuery
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import AccountCircle from '@mui/icons-material/AccountCircle';
import SettingsIcon from '@mui/icons-material/Settings';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

import { useUserAuth } from '../context/UserAuthContext';
import SetupModal from './SetupModal';

const drawerWidth = 240;

const MainLayout = () => {
  const { logout } = useUserAuth();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [open, setOpen] = useState(!isMobile);

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

  const handleDrawerOpen = () => {
    setOpen(true);
  };

  const handleDrawerClose = () => {
    setOpen(false);
  };

  const drawer = (
    <div>
      <Toolbar
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          px: [1],
        }}
      >
        <IconButton onClick={handleDrawerClose}>
          <ChevronLeftIcon />
        </IconButton>
      </Toolbar>
      <Divider />
      <List>
        <ListItem button component={RouterLink} to="/">
          <ListItemText primary="Briefings" />
        </ListItem>
      </List>
    </div>
  );

  return (
    <>
      <Box sx={{ display: 'flex', height: '100vh' }}>
        <CssBaseline />
        <AppBar position="fixed" open={open}>
          <Toolbar>
            <IconButton
              color="inherit"
              aria-label="open drawer"
              onClick={handleDrawerOpen}
              edge="start"
              sx={{
                marginRight: '36px',
                ...(open && { display: 'none' }),
              }}
            >
              <MenuIcon />
            </IconButton>
            <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
              M.I.D.I.A.T.O.R
            </Typography>
            <Button color="inherit" component={RouterLink} to="/briefing-template">
              Templates
            </Button>
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
                anchorOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
                keepMounted
                transformOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
                open={Boolean(anchorEl)}
                onClose={handleClose}
              >
                <MenuItem onClick={handleLogout}>Logout</MenuItem>
              </Menu>
            </div>
          </Toolbar>
        </AppBar>
        <Drawer
          variant="permanent"
          open={open}
          sx={{
            '& .MuiDrawer-paper': {
              position: 'relative',
              whiteSpace: 'nowrap',
              width: drawerWidth,
              transition: theme.transitions.create('width', {
                easing: theme.transitions.easing.sharp,
                duration: theme.transitions.duration.enteringScreen,
              }),
              boxSizing: 'border-box',
              ...(!open && {
                overflowX: 'hidden',
                transition: theme.transitions.create('width', {
                  easing: theme.transitions.easing.sharp,
                  duration: theme.transitions.duration.leavingScreen,
                }),
                width: theme.spacing(7),
                [theme.breakpoints.up('sm')]: {
                  width: theme.spacing(9),
                },
              }),
            },
          }}
        >
          {drawer}
        </Drawer>
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            height: '100vh',
            overflow: 'auto',
          }}
        >
          <Toolbar />
          <Outlet />
        </Box>
      </Box>
      <SetupModal open={setupModalOpen} onClose={() => setSetupModalOpen(false)} />
    </>
  );
};

export default MainLayout;