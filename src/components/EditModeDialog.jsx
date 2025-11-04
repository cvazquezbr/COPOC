import React from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box
} from '@mui/material';

const EditModeDialog = ({ open, onClose, onStartOver, onDirectEdit }) => {
  return (
    <Dialog open={open} onClose={onClose} aria-labelledby="edit-mode-dialog-title">
      <DialogTitle id="edit-mode-dialog-title">Escolha o modo de edição</DialogTitle>
      <DialogContent>
        <Typography variant="body1">
          Este briefing já foi revisado. Deseja começar o processo desde o início ou editar diretamente o texto revisado?
        </Typography>
      </DialogContent>
      <DialogActions sx={{ p: 3, justifyContent: 'center' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%' }}>
          <Button onClick={onStartOver} variant="outlined" color="primary" size="large">
            Refazer Processo
          </Button>
          <Button onClick={onDirectEdit} variant="contained" color="primary" size="large">
            Editar Texto Revisado
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default EditModeDialog;