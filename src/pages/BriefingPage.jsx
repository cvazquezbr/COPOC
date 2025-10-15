import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Paper,
  Typography,
  Box,
  Button,
  Alert,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  CircularProgress,
  IconButton,
  Divider
} from '@mui/material';
import { toast } from 'sonner';
import isEqual from 'lodash.isequal';
import { getBriefings, getBriefing, saveBriefing, updateBriefing, deleteBriefing } from '../utils/briefingState';
import BriefingWizard from '../components/BriefingWizard';
import UnsavedChangesDialog from '../components/UnsavedChangesDialog';
import { defaultBriefingTemplate } from '../utils/defaultBriefingTemplate';

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
  const location = useLocation();
  const navigate = useNavigate();

  const [briefingList, setBriefingList] = useState([]);
  const [selectedBriefing, setSelectedBriefing] = useState(null);
  const [briefingsLoading, setBriefingsLoading] = useState(true);
  const [briefingsError, setBriefingsError] = useState(null);
  const [briefingFormData, setBriefingFormData] = useState(null);
  const [creationMode, setCreationMode] = useState('text');
  const [isWizardOpen, setWizardOpen] = useState(false);
  const [isBriefingDirty, setIsBriefingDirty] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [userTemplate, setUserTemplate] = useState(null);
  const [isTemplateLoading, setIsTemplateLoading] = useState(true);
  const [isNewBriefing, setIsNewBriefing] = useState(false);
  const [creationMode, setCreationMode] = useState('text');

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

  useEffect(() => {
    const fetchTemplate = async () => {
      setIsTemplateLoading(true);
      try {
        const response = await fetch('/api/briefing-template');
        const data = response.ok ? await response.json() : null;
        const templateData = data && data.length > 0 && data[0].template_data ? data[0].template_data : defaultBriefingTemplate;
        setUserTemplate(templateData);
      } catch (error) {
        toast.error(`Error loading briefing template: ${error.message}`);
        setUserTemplate(defaultBriefingTemplate);
      } finally {
        setIsTemplateLoading(false);
      }
    };
    fetchTemplate();
    fetchBriefings();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const briefingId = params.get('id');
    const createMode = params.get('create');

    const loadBriefing = async (id) => {
      setBriefingsLoading(true);
      try {
        const briefing = await getBriefing(id);
        if (briefing.briefing_data?.type !== 'text' && briefing.briefing_data?.type !== 'sections') {
          toast.error(`Briefing format is outdated. Please create a new one.`);
          navigate('/');
          return;
        }
        setSelectedBriefing(briefing);
        setBriefingFormData(briefing.briefing_data);
        setWizardOpen(true);
      } catch (error) {
        toast.error(`Error loading briefing: ${error.message}`);
        navigate('/');
      } finally {
        setBriefingsLoading(false);
      }
    };

    if (briefingId) {
      loadBriefing(briefingId);
    } else if (createMode && userTemplate) {
      handleNewBriefing(createMode);
    } else if (!createMode) {
      setWizardOpen(false);
      setSelectedBriefing(null);
      setBriefingFormData(null);
    }
  }, [location.search, userTemplate, navigate]);

  useEffect(() => {
    if (selectedBriefing && briefingFormData) {
      setIsBriefingDirty(!isEqual(selectedBriefing.briefing_data, briefingFormData));
    } else {
      setIsBriefingDirty(false);
    }
  }, []);


  const handleNewBriefing = (mode) => {
    if (!userTemplate) {
        toast.error("Aguarde, o modelo de briefing está carregando.");
        return;
    }
    setCreationMode(mode);
    setIsNewBriefing(true);
    setSelectedBriefingId(null);

    let newBriefingData;
    if (mode === 'text') {
        const newBaseText = userTemplate.blocks.map(block =>
            `<h3>${block.title}</h3>\n${(block.content || '').split('\n').filter(line => line.trim()).map(line => `<p>${line.trim()}</p>`).join('\n')}`
        ).join('\n\n<hr />\n\n');
        newBriefingData = { ...emptyBriefingData, baseText: newBaseText, template: userTemplate, type: 'text' };
    } else { // 'sections' mode
        const initialSections = {};
        userTemplate.blocks.forEach(block => {
            initialSections[block.title] = block.content ? `<p>${block.content.replace(/\n/g, '</p><p>')}</p>` : '';
        });
        newBriefingData = { ...emptyBriefingData, sections: initialSections, template: userTemplate, type: 'sections' };
    }
    setBriefingFormData(newBriefingData);
    setWizardOpen(true);
  };

  const handleSaveBriefing = async () => {
    if (!briefingFormData?.name) {
      toast.error('Briefing name is required.');
      return false;
    }
    try {
      const isNew = !selectedBriefing?.id;
      const briefingToSave = {
        name: briefingFormData.name,
        briefing_data: { ...briefingFormData, template: userTemplate },
      };
      const saved = isNew
        ? await saveBriefing(briefingToSave.name, briefingToSave.briefing_data)
        : await updateBriefing(selectedBriefing.id, briefingToSave.name, briefingToSave.briefing_data);

      toast.success(`Briefing ${isNew ? 'created' : 'updated'} successfully!`);
      fetchBriefings();

      setWizardOpen(false);
      setSelectedBriefing(null);
      setBriefingFormData(null);
      navigate('/'); // Navigate to home after saving
      return true;
    } catch (err) {
      toast.error(`Error saving briefing: ${err.message}`);
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

  const handleCloseWizard = () => {
    handleNavigation(() => {
      setWizardOpen(false);
      navigate('/');
    });
  };

  const handleConfirmDelete = async (briefingId) => {
    try {
      await deleteBriefing(briefingId);
      toast.success('Briefing excluído com sucesso!');
      fetchBriefings();
      if (location.search.includes(`id=${briefingId}`)) {
        navigate('/');
      }
    } catch (error) {
      toast.error('Erro ao excluir briefing');
    }
  };

  if (isWizardOpen) {
    return (
      briefingFormData && (
        <BriefingWizard
          open={isWizardOpen}
          onClose={handleCloseWizard}
          onSave={handleSaveBriefing}
          briefingData={briefingFormData}
          onBriefingDataChange={setBriefingFormData}
          creationMode={creationMode}
        />
      )
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Paper elevation={3} sx={{ p: { xs: 2, md: 4 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h5">Campanhas</Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => handleNewBriefing('text')}
            disabled={isTemplateLoading}
          >
            Nova Campanha
          </Button>
        </Box>
        <Divider />
        {briefingsLoading ? (
          <CircularProgress sx={{ mt: 2 }} />
        ) : briefingsError ? (
          <Alert severity="error" sx={{ mt: 2 }}>{briefingsError}</Alert>
        ) : (
          <List>
            {briefingList.map((briefing) => (
              <ListItem
                key={briefing.id}
                disablePadding
                secondaryAction={
                  <IconButton edge="end" onClick={() => handleConfirmDelete(briefing.id)}>
                    <DeleteIcon />
                  </IconButton>
                }
              >
                <ListItemButton component={RouterLink} to={`/?id=${briefing.id}`}>
                  <ListItemText primary={briefing.name} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}
      </Paper>
    </Box>
  );
};

export default BriefingPage;