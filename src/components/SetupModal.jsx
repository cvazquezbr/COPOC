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
  CircularProgress,
} from '@mui/material';
import {
  Close as CloseIcon,
  AutoAwesome,
} from '@mui/icons-material';
import GeminiAuthSetup from './GeminiAuthSetup';

function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`vertical-tabpanel-${index}`}
      aria-labelledby={`vertical-tab-${index}`}
      style={{ width: '100%' }}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3, width: '100%' }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const SetupModal = ({ open, onClose, initialTab = 0 }) => {
  const [value, setValue] = useState(initialTab);

  const handleChange = (event, newValue) => {
    setValue(newValue);
  };

  const a11yProps = (index) => {
    return {
      id: `vertical-tab-${index}`,
      'aria-controls': `vertical-tabpanel-${index}`,
    };
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        Configurações
        <IconButton onClick={onClose}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', p: 0 }}>
        <Tabs
          orientation="vertical"
          variant="scrollable"
          value={value}
          onChange={handleChange}
          aria-label="Configuration tabs"
          sx={{
            borderRight: 1,
            borderColor: 'divider',
            minWidth: 200,
          }}
        >
          <Tab icon={<AutoAwesome />} iconPosition="start" label="Gemini" sx={{ justifyContent: 'flex-start', textAlign: 'left' }} {...a11yProps(0)} />
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