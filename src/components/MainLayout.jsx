import React from 'react';
import { Outlet, useLocation, Link as RouterLink } from 'react-router-dom';
import {
  Box, AppBar, Toolbar, IconButton, Typography, Button,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import AccountCircle from '@mui/icons-material/AccountCircle';

import { useLayout } from '../context/LayoutContext';

const MainLayout = () => {
  const { setBriefingDrawerOpen } = useLayout();
  const location = useLocation();

  const handleDrawerToggle = () => {
    setBriefingDrawerOpen((prev) => !prev);
  };

  const isBriefingPage = location.pathname === '/';

  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      <AppBar
        position="fixed"
        sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}
      >
        <Toolbar>
          {isBriefingPage && (
            <IconButton
              color="inherit"
              aria-label="open drawer"
              onClick={handleDrawerToggle}
              edge="start"
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
          )}
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            Copilot
          </Typography>
          <Button color="inherit" component={RouterLink} to="/briefing-template">
            Templates
          </Button>
          <IconButton
            size="large"
            aria-label="account of current user"
            aria-controls="menu-appbar"
            aria-haspopup="true"
            color="inherit"
          >
            <AccountCircle />
          </IconButton>
        </Toolbar>
      </AppBar>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          pt: '64px', // For standard toolbar height
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
};

export default MainLayout;