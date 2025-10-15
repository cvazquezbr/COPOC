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
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  CircularProgress,
} from '@mui/material';
import { Add, Delete as DeleteIcon } from '@mui/icons-material';
import { toast } from 'sonner';
import isEqual from 'lodash.isequal';
import { getBriefings, saveBriefing, updateBriefing, deleteBriefing } from '../utils/briefingState';
import BriefingWizard from '../components/BriefingWizard';
import UnsavedChangesDialog from '../components/UnsavedChangesDialog';
import { defaultBriefingTemplate } from '../utils/defaultBriefingTemplate';
import { useLayout } from '../context/LayoutContext';

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
  const { setBriefingDrawerOpen } = useLayout();

  const [briefingList, setBriefingList] = useState([]);
  const [selectedBriefing, setSelectedBriefing] = useState(null);
  const [briefingsLoading, setBriefingsLoading] = useState(true);
  const [briefingsError, setBriefingsError] = useState(null);
  const [briefingFormData, setBriefingFormData] = useState(null);
  const [creationMode, setCreationMode] = useState('text');
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

  const handleNewBriefing = (mode) => {
    if (isTemplateLoading || !userTemplate) {
        toast.error("Aguarde, o modelo de briefing está carregando.");
        return;
    }
    setCreationMode(mode);
    setSelectedBriefing(null);

    let newBriefingData;

    if (mode === 'text') {
        const newBaseText = userTemplate.blocks.map(block => {
            const titleHtml = `<h3>${block.title}</h3>`;
            const contentHtml = (block.content || '')
                .split('\n')
                .filter(line => line.trim())
                .map(line => `<p>${line.trim()}</p>`)
                .join('\n');
            return `${titleHtml}\n${contentHtml}`;
        }).join('\n\n<hr />\n\n'); // Add horizontal lines between sections

        newBriefingData = {
            ...emptyBriefingData,
            baseText: newBaseText,
            template: userTemplate,
        };
    } else { // 'sections' mode
        const initialSections = {};
        userTemplate.blocks.forEach(block => {
            initialSections[block.title] = block.content ? `<p>${block.content.replace(/\n/g, '</p><p>')}</p>` : '';
        });

        newBriefingData = {
            ...emptyBriefingData,
            baseText: '', // No base text initially for section mode
            sections: initialSections,
            template: userTemplate,
        };
    }

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

  // --- Render --------------------------------------------------------------
  return (
    <Box sx={{ display: 'flex', height: '100%', width: '100%' }}>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          backgroundColor: theme.palette.background.default,
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
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Button variant="contained" onClick={() => handleNewBriefing('text')} disabled={isTemplateLoading}>
                Criar por Texto
                {isTemplateLoading && <CircularProgress size={24} sx={{ position: 'absolute' }} />}
              </Button>
              <Button variant="outlined" onClick={() => handleNewBriefing('sections')} disabled={isTemplateLoading}>
                Criar por Seções
              </Button>
            </Box>
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
          creationMode={creationMode}
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
    </Box>
  );
};

export default BriefingPage;