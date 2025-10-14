import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Tabs,
  Tab,
  IconButton,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Close as CloseIcon,
  AutoAwesome,
} from '@mui/icons-material';
import GeminiAuthSetup from './GeminiAuthSetup';

function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <Box
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
      sx={{
        p: 3,
        flexGrow: 1,
        width: '100%',
        overflow: 'auto',
      }}
      {...other}
    >
      {value === index && children}
    </Box>
  );
}

const SetupModal = ({ open, onClose, initialTab = 0 }) => {
  const [value, setValue] = useState(initialTab);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const handleChange = (event, newValue) => {
    setValue(newValue);
  };

  const a11yProps = (index) => ({
    id: `tab-${index}`,
    'aria-controls': `tabpanel-${index}`,
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" fullScreen={isMobile}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        Configurações
        <IconButton onClick={onClose}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent
        sx={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          p: 0,
          overflow: 'hidden', // Prevent double scrollbars
        }}
      >
        <Tabs
          orientation={isMobile ? 'horizontal' : 'vertical'}
          variant="scrollable"
          value={value}
          onChange={handleChange}
          aria-label="Configuration tabs"
          sx={{
            p: 0,
            borderRight: isMobile ? 0 : 1,
            borderBottom: isMobile ? 1 : 0,
            borderColor: 'divider',
            minWidth: isMobile ? 'auto' : 200,
            flexShrink: 0,
          }}
        >
          <Tab
            icon={<AutoAwesome />}
            iconPosition="start"
            label="Gemini"
            sx={{ justifyContent: isMobile ? 'center' : 'flex-start' }}
            {...a11yProps(0)}
          />
        </Tabs>
        <TabPanel value={value} index={0}>
          <GeminiAuthSetup />
        </TabPanel>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Fechar</Button>
      </DialogActions>
    </Dialog>
  );
};

export default SetupModal;