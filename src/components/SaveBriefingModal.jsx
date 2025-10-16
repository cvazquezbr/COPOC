import React from 'react';
import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    TextField,
    Typography
} from '@mui/material';

const SaveBriefingModal = ({ open, onClose, onSave, briefingData, onBriefingDataChange, isNewBriefing }) => {
    const handleSave = () => {
        onSave();
        onClose();
    };

    return (
        <Dialog open={open} onClose={onClose} aria-labelledby="form-dialog-title">
            <DialogTitle id="form-dialog-title">
                {isNewBriefing ? 'Salvar Novo Briefing' : 'Salvar Alterações'}
            </DialogTitle>
            <DialogContent>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Defina um nome para o seu briefing. Se desejar fazer mais ajustes, feche esta janela e volte às etapas anteriores.
                </Typography>
                <TextField
                    autoFocus
                    margin="dense"
                    id="name"
                    label="Nome do Briefing"
                    type="text"
                    fullWidth
                    value={briefingData.name || ''}
                    onChange={(e) => onBriefingDataChange('name', e.target.value)}
                    required
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} color="primary">
                    Cancelar
                </Button>
                <Button onClick={handleSave} color="primary" variant="contained">
                    {isNewBriefing ? 'Salvar' : 'Salvar Alterações'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default SaveBriefingModal;