import React from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  Alert,
  CircularProgress
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import ERDiagram from '../ERDiagram';

const ERDiagramPanel = ({ 
  selectedDb,
  erDiagramLoading,
  erDiagramError,
  onGenerateERDiagram,
  showSnackbar
}) => {
  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Entity-Relationship Diagram
      </Typography>
      
      {!selectedDb ? (
        <Alert severity="info">
          Please select a database to view its ER diagram.
        </Alert>
      ) : (
        <Box>
          <Box sx={{ mb: 2 }}>
            <Button 
              variant="contained" 
              color="primary" 
              onClick={onGenerateERDiagram}
              disabled={erDiagramLoading}
              startIcon={erDiagramLoading ? <CircularProgress size={20} /> : <RefreshIcon />}
              sx={{ mr: 2 }}
            >
              Regenerate ER Diagram
            </Button>
            <Typography variant="caption" color="text.secondary">
              The diagram will automatically be generated when you extract metadata or when selecting a database with existing metadata.
            </Typography>
          </Box>
          
          {erDiagramError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {erDiagramError}
            </Alert>
          )}
          
          <Box sx={{ height: '70vh', width: '100%' }}>
            <ERDiagram 
              databaseId={selectedDb} 
              onRefreshClick={() => showSnackbar("Refreshing ER Diagram", "info")} 
            />
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default ERDiagramPanel;