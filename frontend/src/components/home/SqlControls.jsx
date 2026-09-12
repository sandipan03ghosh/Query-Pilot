import React from 'react';
import { 
  Typography, 
  Paper, 
  Box,
  Button,
  IconButton,
  alpha,
} from "@mui/material";
import { useTheme } from '@mui/material/styles';

const SqlControls = ({ 
  showSqlControls, 
  generatedSql, 
  copyToClipboard, 
  discardGeneratedSql, 
  executeGeneratedSql 
}) => {
  const theme = useTheme();
  
  return (
    showSqlControls && (
      <Paper 
        elevation={3}
        sx={{
          p: 3,
          mt: 2,
          mb: 3,
          borderRadius: 2,
          border: '1px solid',
          borderColor: alpha(theme.palette.primary.main, 0.2),
          bgcolor: alpha(theme.palette.background.paper, 0.8),
          backdropFilter: 'blur(10px)',
          position: 'sticky',
          top: 10,
          zIndex: 10,
          boxShadow: `0 4px 20px ${alpha(theme.palette.common.black, 0.15)}`
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6" fontWeight={600} sx={{
            color: theme.palette.text.primary,
          }}>
            Generated SQL Query
          </Typography>
          <IconButton 
            size="small" 
            onClick={() => copyToClipboard(generatedSql)}
            title="Copy SQL to clipboard"
            sx={{ 
              color: theme.palette.primary.main,
              '&:hover': {
                backgroundColor: alpha(theme.palette.primary.main, 0.1),
              }
            }}
          >
            <Box component="svg" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </Box>
          </IconButton>
        </Box>
        
        <Paper 
          elevation={0}
          sx={{
            p: 2,
            mb: 3,
            borderRadius: 1,
            bgcolor: alpha(theme.palette.background.default, 0.7),
            border: '1px solid',
            borderColor: alpha(theme.palette.divider, 0.6),
            overflow: 'auto',
            maxHeight: '200px',
            fontFamily: 'monospace',
            fontSize: '0.9rem',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          }}
        >
          {generatedSql}
        </Paper>
        
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
          <Button 
            variant="outlined" 
            color="error"
            onClick={discardGeneratedSql}
            sx={{
              borderRadius: '8px',
              fontWeight: 500,
              px: 3
            }}
          >
            Discard
          </Button>
          <Button 
            variant="contained" 
            color="primary"
            onClick={executeGeneratedSql}
            sx={{
              borderRadius: '8px',
              fontWeight: 500,
              px: 3,
              background: 'linear-gradient(45deg, #5581D9 10%, #6596EB 90%)',
              boxShadow: '0 2px 10px rgba(101, 150, 235, 0.3)',
              '&:hover': {
                background: 'linear-gradient(45deg, #4B74C7 10%, #5889DB 90%)',
                boxShadow: '0 4px 15px rgba(101, 150, 235, 0.4)',
              }
            }}
          >
            Execute Query
          </Button>
        </Box>
      </Paper>
    )
  );
};

export default SqlControls;