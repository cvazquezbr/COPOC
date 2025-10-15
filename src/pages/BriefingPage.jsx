import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Paper, Typography, Box, Button, CircularProgress,
} from '@mui/material';
import { toast } from 'sonner';
import isEqual from 'lodash.isequal';
import { saveBriefing, updateBriefing, deleteBriefing } from '../utils/briefingState';
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

const BriefingPage = () => {
  const { selectedBriefingId, briefings, fetchBriefings, setSelectedBriefingId } = useLayout();
  const [searchParams, setSearchParams] = useSearchParams();

  const [briefingData, setBriefingData] = useState(null);
  const [originalBriefingData, setOriginalBriefingData] = useState(null);
  const [isWizardOpen, setWizardOpen] = useState(false);
  const [isBriefingDirty, setIsBriefingDirty] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [userTemplate, setUserTemplate] = useState(null);
  const [isTemplateLoading, setIsTemplateLoading] = useState(true);
  const [isNewBriefing, setIsNewBriefing] = useState(false);

  const fetchUserTemplate = useCallback(async () => {
    setIsTemplateLoading(true);
    try {
      const response = await fetch('/api/briefing-template');
      if (response.ok) {
        const savedTemplates = await response.json();
        if (savedTemplates && savedTemplates.length > 0 && savedTemplates[0].template_data) {
          setUserTemplate(savedTemplates[0].template_data);
        } else {
          setUserTemplate(defaultBriefingTemplate);
        }
      } else {
        setUserTemplate(defaultBriefingTemplate);
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
    const createNew = searchParams.get('create') === 'true';
    setIsNewBriefing(createNew);

    if (createNew && !isTemplateLoading) {
      const newBaseText = userTemplate.blocks.map(block => {
        const titleHtml = `<h3>${block.title}</h3>`;
        const contentHtml = (block.content || '').split('\n').filter(line => line.trim()).map(line => `<p>${line.trim()}</p>`).join('\n');
        return `${titleHtml}\n${contentHtml}`;
      }).join('\n\n<hr />\n\n');

      const newBriefing = {
        ...emptyBriefingData,
        baseText: newBaseText,
        template: userTemplate,
      };
      setBriefingData(newBriefing);
      setOriginalBriefingData(newBriefing);
      setWizardOpen(true);
      setSelectedBriefingId(null);
      // Remove the query param after use
      setSearchParams({}, { replace: true });
    } else if (!createNew && selectedBriefingId) {
      const selected = briefings.find(b => b.id === selectedBriefingId);
      if (selected) {
        setBriefingData(selected.briefing_data);
        setOriginalBriefingData(selected.briefing_data);
        setWizardOpen(true);
      }
    } else {
      setWizardOpen(false);
      setBriefingData(null);
      setOriginalBriefingData(null);
    }
  }, [selectedBriefingId, briefings, searchParams, isTemplateLoading, userTemplate, setSearchParams, setSelectedBriefingId]);

  useEffect(() => {
    if (briefingData && originalBriefingData) {
      setIsBriefingDirty(!isEqual(briefingData, originalBriefingData));
    } else {
      setIsBriefingDirty(false);
    }
  }, [briefingData, originalBriefingData]);

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
      await fetchBriefings(); // Refresh the list in the layout

      // After saving, select the briefing (new or updated)
      setSelectedBriefingId(saved.id);
      setIsNewBriefing(false); // It's no longer a "new" briefing
      setBriefingData(saved.briefing_data);
      setOriginalBriefingData(saved.briefing_data);
      setWizardOpen(true);

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

    // Simple confirmation dialog
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


  if (isTemplateLoading && searchParams.get('create') === 'true') {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Carregando modelo para novo briefing...</Typography>
      </Box>
    );
  }

  if (!isWizardOpen || !briefingData) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <Paper elevation={0} sx={{ p: 5, textAlign: 'center', backgroundColor: 'transparent' }}>
          <Typography variant="h6" gutterBottom>
            Nenhum briefing selecionado
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Selecione um briefing na barra lateral ou crie um novo para começar.
          </Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <>
      <BriefingWizard
        open={isWizardOpen}
        onClose={handleCloseWizard}
        onSave={handleSaveBriefing}
        onDelete={!isNewBriefing ? handleDelete : null}
        briefingData={briefingData}
        onBriefingDataChange={setBriefingData}
        isNewBriefing={isNewBriefing}
      />
      <UnsavedChangesDialog
        open={showUnsavedDialog}
        onClose={() => setShowUnsavedDialog(false)}
        onConfirmDiscard={onConfirmDiscard}
        onConfirmSave={onConfirmSave}
      />
    </>
  );
};

export default BriefingPage;