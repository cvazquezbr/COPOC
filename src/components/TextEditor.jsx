import React from 'react';
import { EditorContent } from '@tiptap/react';
import { Box, TextField, Typography } from '@mui/material';
import AdvancedEditor from './AdvancedEditor';
import useInlineEditor from './InlineEditor';

const TextEditor = ({ value, onChange, html = false, variant = 'full', ...props }) => {
  if (html) {
    if (variant === 'simple') {
      const editor = useInlineEditor({ value, onChange });

      if (!editor) {
        return null;
      }

      return (
        <Box
          sx={{
            border: '1px solid #ccc',
            borderRadius: '4px',
            p: 1,
            minHeight: '40px',
            '.ProseMirror': {
              outline: 'none',
            }
          }}
        >
          <EditorContent editor={editor} />
        </Box>
      );
    }
    return <AdvancedEditor value={value} onChange={onChange} html={html} {...props} />;
  }

  const characterCount = value ? value.length : 0;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <TextField
        value={value}
        onChange={(e) => onChange(e.target.value)}
        multiline
        fullWidth
        variant="outlined"
        {...props}
        sx={{
          flexGrow: 1,
          '& .MuiInputBase-root': {
            height: '100%',
            alignItems: 'flex-start',
          },
          '& .MuiInputBase-input': {
            height: '100% !important',
            overflowY: 'auto !important',
          }
        }}
      />
      <Box sx={{ textAlign: 'right', py: 0.5, px: 1.5 }}>
        <Typography variant="caption" color="textSecondary">
          {characterCount} caracteres
        </Typography>
      </Box>
    </Box>
  );
};

export default TextEditor;
