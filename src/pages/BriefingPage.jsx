import React, { useState, useEffect } from 'react';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import {
  Paper,
  Typography,
  Box,
  Button,
  Alert,
  IconButton,
  Toolbar,
  Divider,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  CircularProgress,
  Fab,
} from '@mui/material';
import { Add, Delete as DeleteIcon, Menu as MenuIcon } from '@mui/icons-material';
import { toast } from 'sonner';
import isEqual from 'lodash.isequal';
import { getBriefings, saveBriefing, updateBriefing, deleteBriefing } from '../utils/briefingState';
import BriefingWizard from '../components/BriefingWizard';
import UnsavedChangesDialog from '../components/UnsavedChangesDialog';
import { defaultBriefingTemplate } from '../utils/defaultBriefingTemplate';
import { useLayout } from '../context/LayoutContext';

const drawerWidth = 320;

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

const BriefingPage = ({
  onNoBriefingSelected,
  onUpdate,
  startInCreateMode,
  onBriefingCreated,
  onCreationCancelled,
}) => {
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

  // --- Effects -------------------------------------------------------------
  useEffect(() => {
    if (selectedBriefing && briefingFormData) {
      setIsBriefingDirty(!isEqual(selectedBriefing.briefing_data, briefingFormData));
    } else {
      setIsBriefingDirty(false);
    }
  }, [briefingFormData, selectedBriefing]);

  useEffect(() => {
    fetchBriefings();
  }, []);

  useEffect(() => {
    if (!selectedBriefing && onNoBriefingSelected) onNoBriefingSelected();
  }, [selectedBriefing]);

  useEffect(() => {
    if (startInCreateMode) handleNewBriefing();
  }, [startInCreateMode]);

  // --- Core logic ---------------------------------------------------------
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
      toast.error(
        `O briefing "${briefing.name}" foi criado com um formato antigo e não pode ser aberto. Por favor, crie um novo briefing.`
      );
      return;
    }
    setSelectedBriefing(briefing);
    setBriefingFormData(briefing.briefing_data);
    setWizardOpen(true);
    if (isMobile) setBriefingDrawerOpen(false);
  };

  const handleNewBriefing = () => {
    setSelectedBriefing(null);
    setBriefingFormData({ ...emptyBriefingData });
    setWizardOpen(true);
    if (isMobile) setBriefingDrawerOpen(false);
  };

  const handleSaveBriefing = async () => {
    if (!briefingFormData?.name) {
      toast.error('O nome do briefing é obrigatório.');
      return false;
    }

    try {
      const isNew = !selectedBriefing?.id;
      const briefingToSave = {
        name: briefingFormData.name,
        briefing_data: briefingFormData,
      };

      const saved = isNew
        ? await saveBriefing(briefingToSave.name, briefingToSave.briefing_data)
        : await updateBriefing(selectedBriefing.id, briefingToSave.name, briefingToSave.briefing_data);

      toast.success(`Briefing ${isNew ? 'criado' : 'atualizado'} com sucesso!`);

      if (isNew && onBriefingCreated) onBriefingCreated(saved);
      await fetchBriefings();
      if (onUpdate) onUpdate();

      setWizardOpen(false);
      setSelectedBriefing(null);
      setBriefingFormData(null);
      return true;
    } catch (err) {
      toast.error(`Erro ao salvar briefing: ${err.message}`);
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

  const handleConfirmDelete = async (briefingId) => {
    try {
      await deleteBriefing(briefingId);
      toast.success('Briefing excluído com sucesso!');
      fetchBriefings();
      if (onUpdate) onUpdate();
      setSelectedBriefing(null);
    } catch (error) {
      toast.error('Erro ao excluir briefing');
    }
  };

  // --- Drawer content ------------------------------------------------------
  const briefingDrawerContent = (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>Briefings</Typography>
        {isMobile && (
          <IconButton onClick={() => setBriefingDrawerOpen(false)}>
            <MenuIcon />
          </IconButton>
        )}
      </Box>

      <Button
        variant="contained"
        startIcon={<Add />}
        onClick={handleNewBriefing}
        fullWidth
        sx={{ mb: 2, borderRadius: 2 }}
      >
        Novo Briefing
      </Button>

      <Divider />

      <Box sx={{ mt: 2, flexGrow: 1, overflowY: 'auto' }}>
        {briefingsLoading && <CircularProgress />}
        {briefingsError && <Alert severity="error">{briefingsError}</Alert>}
        {!briefingsLoading && !briefingsError && (
          <List dense>
            {briefingList.map((p) => (
              <ListItem
                key={p.id}
                disablePadding
                secondaryAction={
                  <IconButton edge="end" onClick={() => handleConfirmDelete(p.id)}>
                    <DeleteIcon fontSize="small" />
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
    </Box>
  );

  // --- Render --------------------------------------------------------------
  return (
    <Box sx={{ display: 'flex', height: '100%', width: '100%' }}>
      <Drawer
        variant={isMobile ? 'temporary' : 'persistent'}
        anchor="left"
        open={briefingDrawerOpen}
        onClose={() => handleNavigation(() => setBriefingDrawerOpen(false))}
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            backgroundColor: theme.palette.background.paper,
            borderRight: `1px solid ${theme.palette.divider}`,
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
          backgroundColor: theme.palette.background.default,
          transition: theme.transitions.create('margin'),
          marginLeft: isMobile ? 0 : (briefingDrawerOpen ? `${drawerWidth}px` : 0),
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
        }}
      >
        {!isWizardOpen && (
          <Paper
            elevation={3}
            sx={{
              p: 5,
              borderRadius: 3,
              textAlign: 'center',
              maxWidth: 480,
              width: '100%',
            }}
          >
            <Typography variant="h6" gutterBottom>
              Nenhum briefing selecionado
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Selecione um briefing existente ou crie um novo para começar.
            </Typography>
            <Button variant="contained" onClick={handleNewBriefing}>
              Criar novo briefing
            </Button>
          </Paper>
        )}
      </Box>

      {isWizardOpen && briefingFormData && (
        <BriefingWizard
          open={isWizardOpen}
          onClose={() =>
            handleNavigation(() => {
              setWizardOpen(false);
              if (startInCreateMode && onCreationCancelled) onCreationCancelled();
            })
          }
          onSave={handleSaveBriefing}
          briefingData={briefingFormData}
          onBriefingDataChange={setBriefingFormData}
        />
      )}

      <UnsavedChangesDialog
        open={showUnsavedDialog}
        onClose={() => setShowUnsavedDialog(false)}
        onConfirmDiscard={() => {
          setShowUnsavedDialog(false);
          setIsBriefingDirty(false);
          if (navigationTarget) navigationTarget();
          setNavigationTarget(null);
        }}
        onConfirmSave={async () => {
          const success = await handleSaveBriefing();
          if (success && navigationTarget) navigationTarget();
          setShowUnsavedDialog(false);
        }}
      />

      {/* Botão flutuante no mobile */}
      {isMobile && (
        <Fab
          color="primary"
          sx={{ position: 'fixed', bottom: 24, right: 24, boxShadow: 4 }}
          onClick={handleNewBriefing}
        >
          <Add />
        </Fab>
      )}
    </Box>
  );
};

export default BriefingPage;
