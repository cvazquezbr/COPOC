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

// This initial text is now a fallback, the primary source will be the fetched template
const initialBaseText = defaultBriefingTemplate.blocks.map(block => block.content).join('\n');

const emptyBriefingData = {
  name: '',
  baseText: initialBaseText,
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
  const [userTemplate, setUserTemplate] = useState(null);
  const [isTemplateLoading, setIsTemplateLoading] = useState(true);

  // --- Effects -------------------------------------------------------------
  useEffect(() => {
    // Fetch the user's template once when the page loads.
    const fetchTemplate = async () => {
      setIsTemplateLoading(true);
      try {
        const response = await fetch('/api/briefing-template');
        if (response.ok) {
          const savedTemplates = await response.json();
          // The API returns an array, and the template data is nested.
          if (savedTemplates && savedTemplates.length > 0 && savedTemplates[0].template_data) {
            setUserTemplate(savedTemplates[0].template_data);
            console.log('User template loaded successfully.');
          } else {
            setUserTemplate(defaultBriefingTemplate);
            console.log('No saved template found, using default.');
          }
        } else {
          setUserTemplate(defaultBriefingTemplate);
          console.error('Could not fetch template, using default.');
        }
      } catch (error) {
        toast.error(`Error loading your briefing template: ${error.message}`);
        setUserTemplate(defaultBriefingTemplate); // Fallback
      } finally {
        // Ensure userTemplate is never null here
        setUserTemplate(current => current || defaultBriefingTemplate);
        setIsTemplateLoading(false);
      }
    };

    fetchTemplate();
    fetchBriefings(); // Fetch existing briefings
  }, []);

  useEffect(() => {
    if (selectedBriefing && briefingFormData) {
      setIsBriefingDirty(!isEqual(selectedBriefing.briefing_data, briefingFormData));
    } else {
      setIsBriefingDirty(false);
    }
  }, [briefingFormData, selectedBriefing]);

  useEffect(() => {
    if (!selectedBriefing && onNoBriefingSelected) onNoBriefingSelected();
  }, [selectedBriefing]);

  useEffect(() => {
    // Wait for the template to be loaded before entering create mode
    if (startInCreateMode && !isTemplateLoading) {
      handleNewBriefing();
    }
  }, [startInCreateMode, isTemplateLoading]);

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
    // Use the template stored with the briefing itself
    setBriefingFormData(briefing.briefing_data);
    setWizardOpen(true);
    if (isMobile) setBriefingDrawerOpen(false);
  };

  const handleNewBriefing = () => {
    if (isTemplateLoading || !userTemplate) {
      toast.error("Aguarde, o modelo de briefing está carregando.");
      return;
    }
    setSelectedBriefing(null);
    // Use the fetched template to construct the initial state.
    const newBaseText = userTemplate.blocks.map(block => {
      const titleHtml = `<h3>${block.title}</h3>`;
      // Ensure content is a string before splitting
      const contentHtml = (block.content || '')
        .split('\n')
        .map(line => line.trim())
        .filter(line => line)
        .map(line => `<p>${line}</p>`)
        .join('\n');
      return `${titleHtml}\n${contentHtml}`;
    }).join('\n\n');

    const newBriefingData = {
      ...emptyBriefingData,
      baseText: newBaseText,
      template: userTemplate,
    };
    setBriefingFormData(newBriefingData);
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
      // Ensure the saved data includes the template that was used
      const briefingToSave = {
        name: briefingFormData.name,
        briefing_data: { ...briefingFormData, template: userTemplate },
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
        disabled={isTemplateLoading}
      >
        Novo Briefing
        {isTemplateLoading && <CircularProgress size={20} color="inherit" sx={{ ml: 1 }} />}
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
                  disabled={isTemplateLoading}
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
            <Button variant="contained" onClick={handleNewBriefing} disabled={isTemplateLoading}>
              Criar novo briefing
              {isTemplateLoading && <CircularProgress size={24} sx={{ position: 'absolute' }} />}
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
      {isMobile && !briefingDrawerOpen && (
        <Fab
          color="primary"
          sx={{ position: 'fixed', bottom: 24, right: 24, boxShadow: 4 }}
          onClick={handleNewBriefing}
          disabled={isTemplateLoading}
        >
          <Add />
        </Fab>
      )}
    </Box>
  );
};

export default BriefingPage;