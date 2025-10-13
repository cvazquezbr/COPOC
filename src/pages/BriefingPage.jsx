import React, { useState, useEffect } from 'react';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import {
  Typography, Box, Button, Alert, IconButton, Toolbar, Divider, Drawer, List, ListItem, ListItemButton, ListItemText, CircularProgress,
} from '@mui/material';
import { Add, Delete as DeleteIcon } from '@mui/icons-material';
import { toast } from 'sonner';

import { getBriefings, saveBriefing, updateBriefing, deleteBriefing } from '../utils/briefingState';
import BriefingWizard from '../components/BriefingWizard';
import { defaultBriefingTemplate } from '../utils/defaultBriefingTemplate';
import { useLayout } from '../context/LayoutContext';

const emptyBriefingData = {
  id: null, // To distinguish between new and existing
  name: '',
  baseText: '',
  template: defaultBriefingTemplate,
  revisedText: '',
  revisionNotes: '',
  sections: {},
  finalText: '',
  type: 'text', // Explicitly mark the type
};

const BriefingPage = ({ onNoBriefingSelected, onUpdate, startInCreateMode, onBriefingCreated, onCreationCancelled }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { briefingDrawerOpen, setBriefingDrawerOpen } = useLayout();

  const [briefingList, setBriefingList] = useState([]);
  const [briefingsLoading, setBriefingsLoading] = useState(true);
  const [briefingsError, setBriefingsError] = useState(null);

  const [isWizardOpen, setWizardOpen] = useState(false);
  const [currentBriefingData, setCurrentBriefingData] = useState(null);

  useEffect(() => {
    fetchBriefings();
  }, []);

  useEffect(() => {
    if (startInCreateMode && !isWizardOpen) {
      handleNewBriefing();
    }
  }, [startInCreateMode, isWizardOpen]);

  const fetchBriefings = async () => {
    setBriefingsLoading(true);
    setBriefingsError(null);
    try {
      const data = await getBriefings();
      setBriefingList(data);
    } catch (err) {
      setBriefingsError(err.message);
    } finally {
      setBriefingsLoading(false);
    }
  };

  const handleSelectBriefing = (briefing) => {
    // The data stored in the DB is what we need for the wizard
    setCurrentBriefingData(briefing.briefing_data);
    setWizardOpen(true);
    if (isMobile) setBriefingDrawerOpen(false);
  };

  const handleNewBriefing = () => {
    setCurrentBriefingData({ ...emptyBriefingData, id: null }); // Ensure it's a new one
    setWizardOpen(true);
    if (isMobile) setBriefingDrawerOpen(false);
  };

  const handleSaveBriefing = async (dataToSave) => {
    if (!dataToSave) {
      toast.error('Não há dados de briefing para salvar.');
      return;
    }
    if (!dataToSave.name) {
      toast.error('O nome do briefing é obrigatório.');
      return;
    }

    try {
      const isNew = !dataToSave.id;
      const savedBriefing = isNew
        ? await saveBriefing(dataToSave.name, dataToSave)
        : await updateBriefing(dataToSave.id, dataToSave.name, dataToSave);

      toast.success(`Briefing "${savedBriefing.name}" salvo com sucesso!`);

      if (isNew && onBriefingCreated) {
        onBriefingCreated(savedBriefing);
      }

      await fetchBriefings(); // Refresh the list
      if (onUpdate) onUpdate();

      setWizardOpen(false);
      setCurrentBriefingData(null);
    } catch (err) {
      toast.error(`Falha ao salvar briefing: ${err.message}`);
    }
  };

  const handleCloseWizard = () => {
    setWizardOpen(false);
    setCurrentBriefingData(null);
    if (startInCreateMode && onCreationCancelled) {
        onCreationCancelled();
    }
  }

  const handleConfirmDelete = async (briefingId) => {
    try {
      await deleteBriefing(briefingId);
      toast.success('Briefing excluído com sucesso!');
      await fetchBriefings(); // Refresh list
      if (onUpdate) onUpdate();
    } catch (error) {
      toast.error(`Falha ao excluir briefing: ${error.message}`);
    }
  };

  const handleDeleteClick = (briefing) => {
    if (window.confirm(`Tem certeza que deseja excluir o briefing "${briefing.name}"? Esta ação não pode ser desfeita.`)) {
      handleConfirmDelete(briefing.id);
    }
  };

  const briefingDrawerContent = (
    <Box sx={{ p: 2, width: 320 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Briefings</Typography>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Button variant="contained" startIcon={<Add />} onClick={handleNewBriefing} fullWidth>+ Novo</Button>
      </Box>
      <Divider sx={{ my: 2 }} />
      {briefingsLoading && <CircularProgress />}
      {briefingsError && <Alert severity="error">{briefingsError}</Alert>}
      {!briefingsLoading && !briefingsError && (
        <List>
          {briefingList.map((p) => (
            <ListItem
              key={p.id}
              disablePadding
              secondaryAction={
                <IconButton edge="end" aria-label="delete" onClick={() => handleDeleteClick(p)}>
                  <DeleteIcon />
                </IconButton>
              }
            >
              <ListItemButton
                onClick={() => handleSelectBriefing(p)}
              >
                <ListItemText primary={p.name} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );

  return (
    <>
      <Box sx={{ display: 'flex', width: '100%', height: '100%' }}>
        <Drawer
          variant={isMobile ? 'temporary' : 'persistent'}
          anchor="left"
          open={briefingDrawerOpen}
          onClose={() => setBriefingDrawerOpen(false)}
          sx={{
            width: 320,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: 320,
              boxSizing: 'border-box',
              position: 'absolute',
            },
          }}
        >
          <Toolbar />
          {briefingDrawerContent}
        </Drawer>
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            p: 3,
            transition: theme.transitions.create('margin', {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.leavingScreen,
            }),
            marginLeft: !isMobile ? `-${320}px` : 0,
            ...(!isMobile && briefingDrawerOpen && {
              transition: theme.transitions.create('margin', {
                easing: theme.transitions.easing.easeOut,
                duration: theme.transitions.duration.enteringScreen,
              }),
              marginLeft: 0,
            }),
          }}
        >
          {!isWizardOpen && (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh' }}>
              <Typography variant="h6" color="text.secondary">
                Selecione um briefing para editar ou crie um novo.
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      {isWizardOpen && (
        <BriefingWizard
          open={isWizardOpen}
          onClose={handleCloseWizard}
          onSave={handleSaveBriefing}
          briefingData={currentBriefingData}
          onBriefingDataChange={setCurrentBriefingData}
        />
      )}
    </>
  );
};

export default BriefingPage;