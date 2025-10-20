import React from 'react';
import {
  Modal, Box, Typography, CircularProgress,
} from '@mui/material';

const style = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 400,
  bgcolor: 'background.paper',
  border: '2px solid #000',
  boxShadow: 24,
  p: 4,
  textAlign: 'center',
};

const SavingModal = ({ open, title = 'Salvando...', children }) => (
    <Modal
      open={open}
      aria-labelledby="saving-modal-title"
      aria-describedby="saving-modal-description"
      BackdropProps={{
        style: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
        },
      }}
    >
      <Box sx={style}>
        <CircularProgress sx={{ mb: 2 }} />
        <Typography id="saving-modal-title" variant="h6" component="h2">
          {title}
        </Typography>
        {children && (
          <Typography id="saving-modal-description" sx={{ mt: 2 }}>
            {children}
          </Typography>
        )}
      </Box>
    </Modal>
  );

export default SavingModal;