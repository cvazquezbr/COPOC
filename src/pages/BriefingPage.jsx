import React, { useState, useEffect, useCallback } from 'react';
import {
  Paper, Typography, Box, Button, CircularProgress,
} from '@mui/material';
import { toast } from 'sonner';
import isEqual from 'lodash.isequal';
import { saveBriefing, updateBriefing, deleteBriefing } from '../utils/briefingState';
import BriefingWizard from '../components/BriefingWizard';
import UnsavedChangesDialog from '../components/UnsavedChangesDialog';
import EditModeDialog from '../components/EditModeDialog';
import { defaultBriefingTemplate } from '../utils/defaultBriefingTemplate';
import { htmlToSections } from '../utils/templateUtils';
import { useLayout } from '../context/LayoutContext';

const emptyBriefingData = {
  name: '',
  baseText: '',
  template: defaultBriefingTemplate,
  revisedText: '',
  revisionNotes: '',
  sections: {},
  finalText: '',
  type: 'text', // Default type
};

const BriefingPage = () => {
  const { selectedBriefingId, briefings, fetchBriefings, setSelectedBriefingId } = useLayout();

  const [briefingData, setBriefingData] = useState(null);
  const [originalBriefingData, setOriginalBriefingData] = useState(null);
  const [isWizardOpen, setWizardOpen] = useState(false);
  const [isBriefingDirty, setIsBriefingDirty] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [userTemplate, setUserTemplate] = useState(null);
  const [isTemplateLoading, setIsTemplateLoading] = useState(true);
  const [isNewBriefing, setIsNewBriefing] = useState(false);
  const [creationMode, setCreationMode] = useState('text');
  const [editMode, setEditMode] = useState({ open: false, onStartOver: null, onDirectEdit: null });
  const [wizardProps, setWizardProps] = useState({});

  const fetchUserTemplate = useCallback(async () => {
    setIsTemplateLoading(true);
    try {
        const response = await fetch('/api/briefing-template');
        if (!response.ok) {
            if (response.status === 404) {
                toast.info('Nenhum modelo salvo encontrado, usando o padrão.');
                setUserTemplate(defaultBriefingTemplate);
            } else {
                throw new Error(`Failed to fetch template: ${response.statusText}`);
            }
        } else {
            const result = await response.json();
            if (result && result.template_data) {
                const rawData = result.template_data;
                const templateData = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
                setUserTemplate(templateData);
                toast.info('Seu modelo de briefing foi carregado.');
            } else {
                setUserTemplate(defaultBriefingTemplate);
                toast.info('Usando modelo de briefing padrão.');
            }
        }
    } catch (error) {
        toast.error(`Error loading your briefing template: ${error.message}`);
        setUserTemplate(defaultBriefingTemplate);
    } finally {
        setIsTemplateLoading(false);
    }
}, []);

  useEffect(() => {
    fetchUserTemplate();
  }, [fetchUserTemplate]);

  useEffect(() => {
    if (selectedBriefingId) {
      const selected = briefings.find(b => b.id === selectedBriefingId);
      if (selected) {
        const data = selected.briefing_data;
        setBriefingData(data);
        setOriginalBriefingData(data);
        setCreationMode(data.type || 'text');
        setIsNewBriefing(false);

        if (data.revisedText) {
          setEditMode({
            open: true,
            onStartOver: () => handleStartOver(data),
            onDirectEdit: () => handleDirectEdit(data),
          });
        } else {
          setWizardProps({ initialStep: 0, isDirectEdit: false });
          setWizardOpen(true);
        }
      }
    } else {
      setWizardOpen(false);
      setBriefingData(null);
      setOriginalBriefingData(null);
      setEditMode({ open: false, onStartOver: null, onDirectEdit: null });
    }
  }, [selectedBriefingId, briefings]);

  const handleStartOver = (data) => {
    setWizardProps({ initialStep: 0, isDirectEdit: false });
    setBriefingData(prev => ({ ...prev, revisedText: '', revisionNotes: '', sections: htmlToSections(data.baseText) }));
    setEditMode({ open: false, onStartOver: null, onDirectEdit: null });
    setWizardOpen(true);
  };

  const handleDirectEdit = (data) => {
    setWizardProps({ initialStep: 1, isDirectEdit: true });
    setEditMode({ open: false, onStartOver: null, onDirectEdit: null });
    setWizardOpen(true);
  };


  useEffect(() => {
    if (briefingData && originalBriefingData) {
      setIsBriefingDirty(!isEqual(briefingData, originalBriefingData));
    } else {
      setIsBriefingDirty(false);
    }
  }, [briefingData, originalBriefingData]);

  const handleNewBriefing = (mode) => {
    if (isTemplateLoading || !userTemplate) {
        toast.error("Aguarde, o modelo de briefing está carregando.");
        return;
    }
    setCreationMode(mode);
    setIsNewBriefing(true);
    setSelectedBriefingId(null);

    let newBriefingData;

    if (mode === 'text') {
        const newBaseText = userTemplate.blocks.map(block => {
            const titleHtml = `<h3>${block.title}</h3>`;
            const contentHtml = (block.content || '').split('\n').filter(line => line.trim()).map(line => `<p>${line.trim()}</p>`).join('\n');
            return `${titleHtml}\n${contentHtml}`;
        }).join('\n\n<hr />\n\n');

        newBriefingData = {
            ...emptyBriefingData,
            type: 'text',
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
            type: 'sections',
            baseText: '', // No base text initially for section mode
            sections: initialSections,
            template: userTemplate,
        };
    }

    setBriefingData(newBriefingData);
    setOriginalBriefingData(newBriefingData);
    setWizardOpen(true);
  };


  const handleSaveBriefing = async () => {
    if (!briefingData?.name) {
      toast.error('O nome do briefing é obrigatório.');
      return false;
    }

    try {
      const templateToSave = isNewBriefing ? userTemplate : (briefingData.template || userTemplate);
      const dataToSave = {
        ...briefingData,
        template: templateToSave,
      };

      const saved = isNewBriefing
        ? await saveBriefing(briefingData.name, dataToSave)
        : await updateBriefing(selectedBriefingId, briefingData.name, dataToSave);

      toast.success(`Briefing ${isNewBriefing ? 'criado' : 'atualizado'} com sucesso!`);
      await fetchBriefings();

      setSelectedBriefingId(null);
      setIsNewBriefing(false);
      setWizardOpen(false);

      return true;
    } catch (err) {
      toast.error(`Erro ao salvar briefing: ${err.message}`);
      return false;
    }
  };

  const handleCloseWizard = () => {
    if (isBriefingDirty) {
      setShowUnsavedDialog(true);
    } else {
      setWizardOpen(false);
      setSelectedBriefingId(null);
    }
  };

  const onConfirmDiscard = () => {
    setShowUnsavedDialog(false);
    setIsBriefingDirty(false);
    setWizardOpen(false);
    setSelectedBriefingId(null);
  };

  const onConfirmSave = async () => {
    const success = await handleSaveBriefing();
    if (success) {
      setShowUnsavedDialog(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedBriefingId) return;

    if (window.confirm(`Tem certeza que deseja excluir o briefing "${briefingData?.name}"?`)) {
      try {
        await deleteBriefing(selectedBriefingId);
        toast.success('Briefing excluído com sucesso!');
        await fetchBriefings();
        setSelectedBriefingId(null);
        setWizardOpen(false);
      } catch (error) {
        toast.error('Erro ao excluir briefing.');
      }
    }
  };


  if (!selectedBriefingId && !isWizardOpen) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <Paper elevation={3} sx={{ p: 5, borderRadius: 3, textAlign: 'center', maxWidth: 480, width: '100%' }}>
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
      </Box>
    );
  }

  if (!briefingData) {
    return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <CircularProgress />
            <Typography sx={{ ml: 2 }}>Carregando briefing...</Typography>
        </Box>
    );
  }


  return (
    <>
      {isWizardOpen && briefingData && (
        <BriefingWizard
          open={isWizardOpen}
          onClose={handleCloseWizard}
          onSave={handleSaveBriefing}
          onDelete={!isNewBriefing ? handleDelete : null}
          briefingData={briefingData}
          onBriefingDataChange={setBriefingData}
          isNewBriefing={isNewBriefing}
          creationMode={creationMode}
          {...wizardProps}
        />
      )}
      <UnsavedChangesDialog
        open={showUnsavedDialog}
        onClose={() => setShowUnsavedDialog(false)}
        onConfirmDiscard={onConfirmDiscard}
        onConfirmSave={onConfirmSave}
      />
      <EditModeDialog
        open={editMode.open}
        onClose={() => setEditMode({ ...editMode, open: false })}
        onStartOver={editMode.onStartOver}
        onDirectEdit={editMode.onDirectEdit}
      />
    </>
  );
};

export default BriefingPage;