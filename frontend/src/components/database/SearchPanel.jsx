import React, { useEffect } from 'react';
import { 
  Box, 
  Typography, 
  TextField, 
  Button, 
  Paper,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  InputAdornment
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import TableChartIcon from '@mui/icons-material/TableChart';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';

const SearchPanel = ({ 
  selectedDb,
  searchQuery, 
  setSearchQuery, 
  searchResults, 
  metadataLoading,
  onSearch 
}) => {

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    onSearch(e);
  };
  
  // Helper function to get table display name based on search result format
  const getTableName = (table) => {
    // Handle both formats: backend might return either schema_name.table_name or schema.name
    if (table.table_name) {
      return `${table.schema_name || 'public'}.${table.table_name}`;
    } else {
      return `${table.schema || 'public'}.${table.name}`;
    }
  };

  // Helper function to get table description safely
  const getTableDescription = (table) => {
    return table.description || "No description available.";
  };
  
  // Helper function to render tables regardless of result format
  const renderTableResults = (tables) => {
    return (
      <Paper className="overflow-hidden w-full rounded-lg shadow-md" sx={{ 
        backgroundColor: '#1F2736',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
      }}>
        <Box className="p-4 border-b border-gray-700 flex items-center">
          <TableChartIcon sx={{ color: '#7C4DFF', mr: 1 }} />
          <Typography variant="subtitle1" className="font-semibold">
            Tables ({tables.length})
          </Typography>
        </Box>
        <Box className="p-4">
          {tables.map((table) => (
            <Paper key={table.id} variant="outlined" className="p-3 mb-3" sx={{ 
              backgroundColor: 'rgba(31, 39, 54, 0.4)',
              borderColor: 'rgba(124, 77, 255, 0.3)',
              '&:hover': {
                borderColor: '#7C4DFF',
                boxShadow: '0 0 10px rgba(124, 77, 255, 0.3)'
              }
            }}>
              <Box className="flex justify-between items-start">
                <Box>
                  <Typography variant="subtitle2" sx={{ color: '#7C4DFF' }}>
                    {getTableName(table)}
                  </Typography>
                  <Typography variant="body2" className="text-gray-400">
                    {getTableDescription(table)}
                  </Typography>
                  {table.row_count !== null && (
                    <Typography variant="caption" className="text-gray-500">
                      {table.row_count} rows
                    </Typography>
                  )}
                </Box>
                <Chip 
                  label={table.table_type || table.type || 'TABLE'} 
                  size="small"
                  sx={{ 
                    backgroundColor: 'rgba(124, 77, 255, 0.2)',
                    borderColor: '#7C4DFF',
                    color: '#7C4DFF'
                  }}
                  variant="outlined"
                />
              </Box>
              <Box className="mt-2">
                <Typography variant="caption" className="text-gray-500">
                  Score: {Math.round((table.score || 0) * 100)}%
                </Typography>
              </Box>
            </Paper>
          ))}
        </Box>
      </Paper>
    );
  };
  
  // Helper function to render columns regardless of result format
  const renderColumnResults = (columns) => {
    return (
      <Paper className="overflow-hidden w-full rounded-lg shadow-md" sx={{ 
        backgroundColor: '#1F2736',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
      }}>
        <Box className="p-4 border-b border-gray-700 flex items-center">
          <ViewColumnIcon sx={{ color: '#03DAC6', mr: 1 }} />
          <Typography variant="subtitle1" className="font-semibold">
            Columns ({columns.length})
          </Typography>
        </Box>
        <Box className="p-4">
          {columns.map((column) => (
            <Paper key={column.id} variant="outlined" className="p-3 mb-3" sx={{ 
              backgroundColor: 'rgba(31, 39, 54, 0.4)',
              borderColor: 'rgba(3, 218, 198, 0.3)',
              '&:hover': {
                borderColor: '#03DAC6',
                boxShadow: '0 0 10px rgba(3, 218, 198, 0.3)'
              }
            }}>
              <Box className="flex justify-between items-start">
                <Box>
                  <Typography variant="subtitle2" sx={{ color: '#03DAC6' }}>
                    {column.name || column.column_name} <span style={{ color: '#aaa' }}>({column.data_type || 'unknown'})</span>
                  </Typography>
                  <Typography variant="caption" className="text-gray-400 block">
                    Table: {column.table_schema || column.schema || 'public'}.{column.table_name || column.table || ''}
                  </Typography>
                  <Typography variant="body2" className="text-gray-400 mt-1">
                    {column.description || "No description available."}
                  </Typography>
                </Box>
                <Box className="flex space-x-1">
                  {column.is_primary_key && (
                    <Chip 
                      label="PK" 
                      size="small"
                      sx={{ 
                        backgroundColor: 'rgba(124, 77, 255, 0.2)',
                        borderColor: '#7C4DFF',
                        color: '#7C4DFF'
                      }}
                      variant="outlined"
                    />
                  )}
                  {column.is_foreign_key && (
                    <Chip 
                      label="FK" 
                      size="small"
                      sx={{ 
                        backgroundColor: 'rgba(3, 218, 198, 0.2)',
                        borderColor: '#03DAC6',
                        color: '#03DAC6'
                      }}
                      variant="outlined"
                    />
                  )}
                  {column.is_nullable && (
                    <Chip 
                      label="Nullable" 
                      size="small"
                      sx={{ 
                        backgroundColor: 'rgba(255, 183, 77, 0.2)',
                        borderColor: '#FFB74D',
                        color: '#FFB74D'
                      }}
                      variant="outlined"
                    />
                  )}
                </Box>
              </Box>
              <Box className="mt-2">
                <Typography variant="caption" className="text-gray-500">
                  Score: {Math.round((column.score || 0) * 100)}%
                </Typography>
              </Box>
            </Paper>
          ))}
        </Box>
      </Paper>
    );
  };

  return (
    <Box>
      <Typography variant="h6" className="mb-4">
        Search Database Metadata
      </Typography>
      
      <Paper className="p-4 rounded-lg shadow-md mb-6" sx={{ 
        backgroundColor: '#1F2736',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
      }}>
        <form onSubmit={handleSearchSubmit} className="space-y-4">
          <Typography variant="body2" color="text.secondary" className="mb-2">
            Search for tables, columns, or specific types using natural language
          </Typography>
          <Box 
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              background: 'linear-gradient(90deg, rgba(124, 77, 255, 0.2), rgba(3, 218, 198, 0.1))',
              p: 0.2,
              borderRadius: 2
            }}
          >
            <TextField
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              fullWidth
              placeholder="e.g., 'primary key columns' or 'tables with customer data'"
              variant="outlined"
              required
              disabled={!selectedDb || metadataLoading}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="primary" />
                  </InputAdornment>
                ),
              }}
              sx={{ 
                "& .MuiOutlinedInput-root": { 
                  backgroundColor: "rgba(31, 39, 54, 0.8)",
                  borderRadius: '8px 0 0 8px',
                  borderRight: 0
                } 
              }}
            />
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={!selectedDb || metadataLoading || !searchQuery.trim()}
              sx={{
                borderRadius: '0 8px 8px 0',
                minWidth: '100px',
                height: 'auto' 
              }}
            >
              {metadataLoading ? <CircularProgress size={24} /> : "Search"}
            </Button>
          </Box>
        </form>
      </Paper>
      
      {!selectedDb ? (
        <Alert severity="info" className="mb-4">
          Please select a database to search its metadata.
        </Alert>
      ) : metadataLoading ? (
        <Box className="flex justify-center py-8">
          <CircularProgress />
        </Box>
      ) : searchResults ? (
        <Box className="space-y-6">
          {/* Table results - handle both formats */}
          {searchResults.tables && searchResults.tables.length > 0 && renderTableResults(searchResults.tables)}
          
          {/* Handle array format directly - this is the format shown in log */}
          {Array.isArray(searchResults) && searchResults.length > 0 && searchResults.some(r => r.type === 'table') && 
            renderTableResults(searchResults.filter(r => r.type === 'table'))}
          
          {/* Column results - handle both formats */}
          {searchResults.columns && searchResults.columns.length > 0 && renderColumnResults(searchResults.columns)}
          
          {/* Handle array format directly */}
          {Array.isArray(searchResults) && searchResults.length > 0 && searchResults.some(r => r.type === 'column') &&
            renderColumnResults(searchResults.filter(r => r.type === 'column'))}
          
          {/* No results message */}
          {(!searchResults.tables || searchResults.tables.length === 0) && 
           (!searchResults.columns || searchResults.columns.length === 0) &&
           !(Array.isArray(searchResults) && searchResults.length > 0) && (
            <Alert severity="info">
              No results found matching your query.
            </Alert>
          )}
        </Box>
      ) : (
        <Alert severity="info">
          Enter a search query and click Search to find tables and columns.
        </Alert>
      )}
    </Box>
  );
};

export default SearchPanel;