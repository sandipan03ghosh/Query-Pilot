import React from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Chip, 
  TextField,
  Button,
  CircularProgress,
  IconButton,
  Tooltip
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

const SchemaPanel = ({ 
  schemaData,
  metadataLoading, 
  onExtractMetadata,
  onSaveDescription,
  onGenerateAIDescription,
  // New props for description state management
  editDescription,
  setEditDescription,
  editingDescription,
  setEditingDescription,
  descriptionLoading
}) => {

  // Handle description editing
  const handleEditDescription = (type, id, currentDescription) => {
    setEditingDescription(`${type}_${id}`);
    setEditDescription(currentDescription || "");
  };

  // Handle description saving
  const handleSaveDescription = async (type, id) => {
    await onSaveDescription(type, id, editDescription);
    setEditingDescription(null);
  };
  
  // Handle AI description generation
  const handleGenerateAIDescription = async (type, id) => {
    await onGenerateAIDescription(type, id);
  };
  
  // If no schema data, show placeholder
  if (!schemaData || schemaData.length === 0) {
    return (
      <Box>
        <Typography variant="h6" className="mb-4">
          Database Schema
        </Typography>
        
        {metadataLoading ? (
          <Box className="flex justify-center py-8">
            <CircularProgress />
          </Box>
        ) : (
          <Box className="text-center py-8">
            <Typography className="text-gray-400 mb-4">
              No schema data available. Please extract metadata first.
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
        Database Schema
      </Typography>
      
      <Box className="space-y-6">
        {schemaData.map((table) => (
          <Paper key={table.id} variant="outlined" className="overflow-hidden w-full" sx={{ 
            backgroundColor: '#1F2736', 
            borderColor: 'rgba(255, 255, 255, 0.12)'
          }}>
            <Box className="bg-gray-800 p-3 border-b border-gray-700">
              <Box className="flex justify-between items-start">
                <Box className="flex-grow">
                  <Typography variant="subtitle1" className="font-medium text-gray-200">
                    {table.schema_name}.{table.table_name}
                    <Chip
                      label={table.table_type}
                      size="small"
                      variant="outlined"
                      className="ml-2 text-xs"
                      sx={{ backgroundColor: 'rgba(31, 39, 54, 0.8)' }}
                    />
                  </Typography>
                  
                  {/* Table Description */}
                  {editingDescription === `table_${table.id}` ? (
                    <Box className="mt-2">
                      <TextField
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        fullWidth
                        multiline
                        rows={3}
                        size="small"
                        variant="outlined"
                        sx={{ 
                          "& .MuiOutlinedInput-root": { 
                            backgroundColor: "rgba(31, 39, 54, 0.8)" 
                          } 
                        }}
                      />
                      <Box className="flex gap-2 mt-2">
                        <Button
                          size="small"
                          variant="contained"
                          color="success"
                          onClick={() => handleSaveDescription('table', table.id)}
                          startIcon={<CheckIcon />}
                        >
                          Save
                        </Button>
                        <Button
                          size="small"
                          variant="contained"
                          color="primary"
                          onClick={() => handleGenerateAIDescription('table', table.id)}
                          disabled={descriptionLoading}
                          startIcon={<AutoAwesomeIcon />}
                        >
                          {descriptionLoading ? "Generating..." : "AI Generate"}
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => setEditingDescription(null)}
                        >
                          Cancel
                        </Button>
                      </Box>
                    </Box>
                  ) : (
                    <Box className="group relative mt-1">
                      <Typography variant="body2" className="text-gray-300">
                        {table.description || "No description available."}
                        <IconButton
                          size="small"
                          className="ml-1 opacity-0 group-hover:opacity-100"
                          onClick={() => handleEditDescription('table', table.id, table.description || "")}
                          sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Typography>
                    </Box>
                  )}
                  
                  {table.row_count !== null && (
                    <Typography variant="caption" className="text-gray-400 mt-1 block">
                      Rows: {table.row_count}
                    </Typography>
                  )}
                </Box>
              </Box>
            </Box>
            
            {/* Table Columns */}
            <Box className="overflow-x-auto w-full">
              <table className="min-w-full divide-y divide-gray-700">
                <thead>
                  <tr className="bg-gray-800">
                    <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider"
                        style={{ color: '#7C4DFF', borderBottom: '2px solid #7C4DFF' }}>
                      Column
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider"
                        style={{ color: '#03DAC6', borderBottom: '2px solid #03DAC6' }}>
                      Type
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider"
                        style={{ color: '#FF5252', borderBottom: '2px solid #FF5252' }}>
                      Nullable
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider"
                        style={{ color: '#FFB74D', borderBottom: '2px solid #FFB74D' }}>
                      Key
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider"
                        style={{ color: '#29B6F6', borderBottom: '2px solid #29B6F6' }}>
                      Description
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider"
                        style={{ color: '#66BB6A', borderBottom: '2px solid #66BB6A' }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {table.columns.map((column, colIdx) => (
                    <tr key={column.id}>
                      <td className="px-3 py-2 text-sm font-medium"
                          style={{ 
                            backgroundColor: colIdx % 2 === 0 
                              ? 'rgba(124, 77, 255, 0.25)'
                              : 'rgba(124, 77, 255, 0.15)',
                            color: '#7C4DFF'
                          }}>
                        {column.name}
                      </td>
                      <td className="px-3 py-2 text-sm"
                          style={{ 
                            backgroundColor: colIdx % 2 === 0 
                              ? 'rgba(3, 218, 198, 0.25)'
                              : 'rgba(3, 218, 198, 0.15)',
                            color: '#03DAC6'
                          }}>
                        {column.data_type}
                      </td>
                      <td className="px-3 py-2 text-sm"
                          style={{ 
                            backgroundColor: colIdx % 2 === 0 
                              ? 'rgba(255, 82, 82, 0.25)'
                              : 'rgba(255, 82, 82, 0.15)',
                            color: '#FF5252'
                          }}>
                        {column.is_nullable ? "Yes" : "No"}
                      </td>
                      <td className="px-3 py-2 text-sm"
                          style={{ 
                            backgroundColor: colIdx % 2 === 0 
                              ? 'rgba(255, 183, 77, 0.25)'
                              : 'rgba(255, 183, 77, 0.15)',
                            color: '#FFB74D'
                          }}>
                        {column.is_primary_key && (
                          <Chip label="PK" size="small" color="primary" variant="outlined" className="mr-1" sx={{ backgroundColor: 'rgba(31, 39, 54, 0.8)' }} />
                        )}
                        {column.is_foreign_key && (
                          <Chip label="FK" size="small" color="secondary" variant="outlined" sx={{ backgroundColor: 'rgba(31, 39, 54, 0.8)' }} />
                        )}
                      </td>
                      <td className="px-3 py-2 text-sm"
                          style={{ 
                            backgroundColor: colIdx % 2 === 0 
                              ? 'rgba(41, 182, 246, 0.25)'
                              : 'rgba(41, 182, 246, 0.15)',
                            color: '#29B6F6'
                          }}>
                        {editingDescription === `column_${column.id}` ? (
                          <TextField
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            fullWidth
                            multiline
                            rows={2}
                            size="small"
                            variant="outlined"
                            sx={{ 
                              "& .MuiOutlinedInput-root": { 
                                backgroundColor: "rgba(31, 39, 54, 0.8)" 
                              } 
                            }}
                          />
                        ) : (
                          column.description || "-"
                        )}
                      </td>
                      <td className="px-3 py-2 text-sm"
                          style={{ 
                            backgroundColor: colIdx % 2 === 0 
                              ? 'rgba(102, 187, 106, 0.25)'
                              : 'rgba(102, 187, 106, 0.15)',
                            color: '#66BB6A'
                          }}>
                        {editingDescription === `column_${column.id}` ? (
                          <Box className="flex gap-1">
                            <Tooltip title="Save">
                              <IconButton
                                size="small"
                                color="success"
                                onClick={() => handleSaveDescription('column', column.id)}
                              >
                                <CheckIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Generate with AI">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => handleGenerateAIDescription('column', column.id)}
                                disabled={descriptionLoading}
                              >
                                <AutoAwesomeIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Cancel">
                              <IconButton
                                size="small"
                                onClick={() => setEditingDescription(null)}
                              >
                                <CloseIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        ) : (
                          <Tooltip title="Edit Description">
                            <IconButton
                              size="small"
                              onClick={() => handleEditDescription('column', column.id, column.description || "")}
                              style={{ color: '#66BB6A' }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Box>
          </Paper>
        ))}
      </Box>
    </Box>
  );
};

export default SchemaPanel;