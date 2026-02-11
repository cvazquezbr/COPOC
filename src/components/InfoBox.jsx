import React from 'react';
import { Tooltip, Box, Typography } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

const InfoBox = ({ title, description }) => {
  return (
    <Tooltip
      title={
        <Box sx={{ p: 1, maxWidth: 350 }}>
          {title && (
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, color: 'inherit' }}>
              {title}
            </Typography>
          )}
          {description?.split('\n').map((line, i) => (
            <Typography key={i} variant="body2" sx={{ mb: line ? 0.5 : 1, fontSize: '0.75rem', color: 'inherit' }}>
              {line}
            </Typography>
          ))}
        </Box>
      }
      arrow
      placement="top"
    >
      <InfoOutlinedIcon
        fontSize="small"
        sx={{ ml: 0.5, cursor: 'help', verticalAlign: 'middle', color: 'primary.main' }}
      />
    </Tooltip>
  );
};

export default InfoBox;
