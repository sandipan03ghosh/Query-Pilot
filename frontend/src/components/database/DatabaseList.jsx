import React from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Button, 
  CircularProgress 
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import api from '../../api';

const DatabaseList = ({ 
  databases, 
  loading, 
  selectedDb, 
  onDatabaseSelect, 
  onDeleteClick, 
  onTestConnection,
  metadataLoading,
  onExtractMetadata,
  onUpdateEmbeddings,
  onViewSchema,
  onViewRelationships
}) => {

  return (
    <Box className="space-y-6">
      {/* Database Selection */}
      <Paper className="p-6 rounded-lg shadow-md" sx={{ 
        backgroundColor: '#1F2736',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
      }}>
        <Typography variant="h5" className="mb-4 font-semibold">
          Your Databases
        </Typography>
        
        {loading && <CircularProgress size={24} className="mx-auto my-4 block" />}
        
        {databases.length === 0 && !loading ? (
          <Typography className="text-gray-400 text-center py-4">
            No databases added yet.
          </Typography>
        ) : (
          <Box className="divide-y divide-gray-700">
            {databases.map((db) => (
              <Box key={db.id} className="py-3 flex justify-between items-center">
                <Box>
                  <Typography className="font-semibold">
                    {db.name}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                    {db.host}:{db.port}/{db.database_name}
                  </Typography>
                </Box>
                <Box className="space-x-2">
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => onTestConnection(db.id)}
                  >
                    Test
                  </Button>
                  <Button
                    size="small"
                    variant={selectedDb === db.id ? "contained" : "outlined"}
                    color="primary"
                    onClick={() => onDatabaseSelect(db.id)}
                  >
                    {selectedDb === db.id ? "Selected" : "Select"}
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    onClick={() => onDeleteClick(db.id)}
                    startIcon={<DeleteIcon />}
                  >
                    Delete
                  </Button>
                </Box>
              </Box>
            ))}
          </Box>
        )}
        
        {selectedDb && (
          <Box className="mt-4 pt-4 border-t border-gray-700">
            <Typography variant="subtitle1" className="font-semibold mb-2">
              Metadata Operations
            </Typography>
            <Box className="flex flex-wrap gap-2">
              <Button
                variant="contained"
                color="secondary"
                size="small"
                disabled={metadataLoading}
                onClick={onExtractMetadata}
              >
                Extract Metadata
              </Button>
              <Button
                variant="contained"
                color="info"
                size="small"
                disabled={metadataLoading}
                onClick={onUpdateEmbeddings}
              >
                Update Embeddings
              </Button>
              <Button
                variant="contained"
                color="success"
                size="small"
                disabled={metadataLoading}
                onClick={onViewSchema}
              >
                View Schema
              </Button>
              <Button
                variant="contained"
                color="warning"
                size="small"
                disabled={metadataLoading}
                onClick={onViewRelationships}
              >
                View Relationships
              </Button>
            </Box>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default DatabaseList;