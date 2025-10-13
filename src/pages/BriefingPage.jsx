import React, { useState, useEffect } from 'react';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import {
  Paper, Typography, Box, Button, Alert, IconButton, Toolbar, Divider, Drawer, List, ListItem, ListItemButton, ListItemText, CircularProgress,
} from '@mui/material';
import { Add, Delete as DeleteIcon } from '@mui/icons-material';
import { toast } from 'sonner';
import isEqual from 'lodash.isequal';

import { getBriefings, saveBriefing, updateBriefing, deleteBriefing } from '../utils/briefingState';
import BriefingWizard from '../components/BriefingWizard';
import UnsavedChangesDialog from '../components/UnsavedChangesDialog';
import { defaultBriefingTemplate } from '../utils/defaultBriefingTemplate';
import { useLayout } from '../context/LayoutContext';

const emptyBriefingData = {
  name: '',
  baseText: '',
  template: defaultBriefingTemplate,
  revisedText: '',
  revisionNotes: '',
  sections: {},
  finalText: '',
  type: 'text',
};

const BriefingPage = ({ onNoBriefingSelected, onUpdate, startInCreateMode, onBriefingCreated, onCreationCancelled }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { briefingDrawerOpen, setBriefingDrawerOpen } = useLayout();

  const [briefingList, setBriefingList] = useState([]);
  const [selectedBriefing, setSelectedBriefing] = useState(null);
  const [briefingsLoading, setBriefingsLoading] = useState(true);
  const [briefingsError, setBriefingsError] = useState(null);

  const [briefingFormData, setBriefingFormData] = useState(null);
  const [isWizardOpen, setWizardOpen] = useState(false);
  const [isBriefingDirty, setIsBriefingDirty] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [navigationTarget, setNavigationTarget] = useState(null);

  useEffect(() => {
    if (selectedBriefing && briefingFormData) {
      const isDirty = !isEqual(selectedBriefing.briefing_data, briefingFormData);
      setIsBriefingDirty(isDirty);
    } else {
      setIsBriefingDirty(false);
    }
  }, [briefingFormData, selectedBriefing]);

  useEffect(() => {
    fetchBriefings();
  }, []);

  useEffect(() => {
    if (!selectedBriefing && onNoBriefingSelected) {
      onNoBriefingSelected();
    }
  }, [selectedBriefing, onNoBriefingSelected]);

  useEffect(() => {
    if (startInCreateMode) {
      handleNewBriefing();
    }
  }, [startInCreateMode]);

  const fetchBriefings = async () => {
    setBriefingsLoading(true);
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
    if (briefing.briefing_data?.type !== 'text') {
      toast.error(`O briefing "${briefing.name}" foi criado com um formato antigo e não pode ser aberto. Por favor, crie um novo briefing.`);
      return;
    }
    setSelectedBriefing(briefing);
    setBriefingFormData(briefing.briefing_data);
    setWizardOpen(true);
    if (isMobile) setBriefingDrawerOpen(false);
  };

  const handleNewBriefing = () => {
    setSelectedBriefing(null); // Deselect any existing briefing
    setBriefingFormData({ ...emptyBriefingData });
    setWizardOpen(true);
    if (isMobile) setBriefingDrawerOpen(false);
  };

  const handleSaveBriefing = async () => {
    if (!briefingFormData) {
      toast.error('Não há dados de briefing para salvar.');
      return false;
    }
    if (!briefingFormData.name) {
      toast.error('O nome do briefing é obrigatório.');
      return false;
    }

    try {
      const isNew = !selectedBriefing || !selectedBriefing.id;
      const briefingToSave = {
        name: briefingFormData.name,
        briefing_data: briefingFormData,
      };

      const saved = isNew
        ? await saveBriefing(briefingToSave.name, briefingToSave.briefing_data)
        : await updateBriefing(selectedBriefing.id, briefingToSave.name, briefingToSave.briefing_data);

      toast.success(`Briefing ${isNew ? 'salvo' : 'atualizado'} com sucesso!`);

      if (isNew && onBriefingCreated) {
        onBriefingCreated(saved);
      }

      await fetchBriefings();
      if (onUpdate) onUpdate();

      setWizardOpen(false);
      setBriefingFormData(null);
      setSelectedBriefing(null);
      return true;
    } catch (err) {
      toast.error(`Falha ao salvar briefing: ${err.message}`);
      return false;
    }
  };

  const handleNavigation = (targetAction) => {
    if (isBriefingDirty) {
      setNavigationTarget(() => targetAction);
      setShowUnsavedDialog(true);
    } else {
      targetAction();
    }
  };

  const handleDialogClose = () => {
    setShowUnsavedDialog(false);
    setNavigationTarget(null);
  };

  const handleDialogDiscard = () => {
    setShowUnsavedDialog(false);
    setIsBriefingDirty(false);
    if (navigationTarget) {
      navigationTarget();
    }
    setNavigationTarget(null);
  };

  const handleDialogSaveAndNavigate = async () => {
    const success = await handleSaveBriefing();
    setShowUnsavedDialog(false);
    if (success && navigationTarget) {
      navigationTarget();
    }
    setNavigationTarget(null);
  };

  const handleConfirmDelete = async (briefingId) => {
    try {
      await deleteBriefing(briefingId);
      toast.success('Briefing excluído com sucesso!');
      fetchBriefings(); // Refresh list
      if (onUpdate) onUpdate();
      setSelectedBriefing(null); // Deselect if the deleted one was selected
    } catch (error) {
      console.error(error);
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
        <Typography variant="h6" noWrap>Briefings</Typography>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Button variant="contained" startIcon={<Add />} onClick={handleNewBriefing} fullWidth>+ Novo</Button>
      </Box>
      <Divider sx={{ my: 2 }} />
      {briefingsLoading && <CircularProgress />}
      {briefingsError && <Alert severity="error">Falha ao carregar briefings: {briefingsError}</Alert>}
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
                selected={selectedBriefing?.id === p.id && isWizardOpen}
                onClick={() => handleNavigation(() => handleSelectBriefing(p))}
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
          onClose={() => handleNavigation(() => setBriefingDrawerOpen(false))}
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
            position: 'relative',
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

      {isWizardOpen && briefingFormData && (
        <BriefingWizard
          open={isWizardOpen}
          onClose={() => handleNavigation(() => {
            setWizardOpen(false);
            if (startInCreateMode && onCreationCancelled) onCreationCancelled();
          })}
          onSave={handleSaveBriefing}
          briefingData={briefingFormData}
          onBriefingDataChange={setBriefingFormData}
        />
      )}

      <UnsavedChangesDialog
        open={showUnsavedDialog}
        onClose={handleDialogClose}
        onConfirmDiscard={handleDialogDiscard}
        onConfirmSave={handleDialogSaveAndNavigate}
      />
    </>
  );
};

export default BriefingPage;