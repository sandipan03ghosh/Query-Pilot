import React from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Chip, 
  Button,
  CircularProgress
} from '@mui/material';

const RelationshipsPanel = ({ 
  relationshipData,
  metadataLoading, 
  onExtractMetadata 
}) => {
  
  // If no relationship data, show placeholder
  if (!relationshipData || relationshipData.length === 0) {
    return (
      <Box>
        <Typography variant="h6" className="mb-4">
          Table Relationships
        </Typography>
        
        {metadataLoading ? (
          <Box className="flex justify-center py-8">
            <CircularProgress />
          </Box>
        ) : (
          <Box className="text-center py-8">
            <Typography className="text-gray-400 mb-4">
              No relationship data available. Please extract metadata first.
            </Typography>
            <Button
              variant="contained"
              color="secondary"
              onClick={onExtractMetadata}
              disabled={metadataLoading}
            >
              Extract Metadata
            </Button>
          </Box>
        )}
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h6" className="mb-4">
        Table Relationships
      </Typography>
      
      <Paper className="overflow-hidden w-full rounded-lg shadow-md" sx={{ 
        backgroundColor: '#1F2736',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
      }}>
        <Box className="p-4 border-b border-gray-700">
          <Typography variant="subtitle1" className="font-semibold">
            Table Relationships
          </Typography>
        </Box>
        <Box className="overflow-x-auto w-full">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-800">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider"
                    style={{ color: '#7C4DFF', borderBottom: '2px solid #7C4DFF' }}>
                  From Table
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider"
                    style={{ color: '#03DAC6', borderBottom: '2px solid #03DAC6' }}>
                  From Column
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider"
                    style={{ color: '#FF5252', borderBottom: '2px solid #FF5252' }}>
                  Relationship
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider"
                    style={{ color: '#FFB74D', borderBottom: '2px solid #FFB74D' }}>
                  To Table
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider"
                    style={{ color: '#29B6F6', borderBottom: '2px solid #29B6F6' }}>
                  To Column
                </th>
              </tr>
            </thead>
            <tbody>
              {relationshipData.map((rel, relIdx) => (
                <tr key={rel.id}>
                  <td className="px-3 py-2 text-sm"
                      style={{ 
                        backgroundColor: relIdx % 2 === 0 
                          ? 'rgba(124, 77, 255, 0.25)'
                          : 'rgba(124, 77, 255, 0.15)',
                        color: '#7C4DFF'
                      }}>
                    {rel.from_schema}.{rel.from_table}
                  </td>
                  <td className="px-3 py-2 text-sm"
                      style={{ 
                        backgroundColor: relIdx % 2 === 0 
                          ? 'rgba(3, 218, 198, 0.25)'
                          : 'rgba(3, 218, 198, 0.15)',
                        color: '#03DAC6'
                      }}>
                    {rel.from_column}
                  </td>
                  <td className="px-3 py-2 text-sm"
                      style={{ 
                        backgroundColor: relIdx % 2 === 0 
                          ? 'rgba(255, 82, 82, 0.25)'
                          : 'rgba(255, 82, 82, 0.15)',
                        color: '#FF5252'
                      }}>
                    <Chip
                      label={rel.relationship_type}
                      size="small"
                      color="primary"
                      variant="outlined"
                      sx={{ backgroundColor: 'rgba(31, 39, 54, 0.8)' }}
                    />
                  </td>
                  <td className="px-3 py-2 text-sm"
                      style={{ 
                        backgroundColor: relIdx % 2 === 0 
                          ? 'rgba(255, 183, 77, 0.25)'
                          : 'rgba(255, 183, 77, 0.15)',
                        color: '#FFB74D'
                      }}>
                    {rel.to_schema}.{rel.to_table}
                  </td>
                  <td className="px-3 py-2 text-sm"
                      style={{ 
                        backgroundColor: relIdx % 2 === 0 
                          ? 'rgba(41, 182, 246, 0.25)'
                          : 'rgba(41, 182, 246, 0.15)',
                        color: '#29B6F6'
                      }}>
                    {rel.to_column}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Box>
      </Paper>
    </Box>
  );
};

export default RelationshipsPanel;