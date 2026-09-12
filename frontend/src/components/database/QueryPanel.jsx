import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  TextField, 
  Button, 
  Alert, 
  Paper, 
  CircularProgress
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import api from '../../api';

const QueryPanel = ({ selectedDb, onQueryResult }) => {
  const [query, setQuery] = useState("");
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryError, setQueryError] = useState(null);

  // Handle query execution
  const handleExecuteQuery = async (e) => {
    e.preventDefault();
    if (!selectedDb) {
      setQueryError("Please select a database first");
      return;
    }
    if (!query.trim()) {
      setQueryError("Please enter a query");
      return;
    }
    
    try {
      setQueryLoading(true);
      const response = await api.post(`/api/databases/databases/${selectedDb}/execute_query/`, {
        query: query
      });
      
      setQueryError(null);
      
      // Pass the result back to the parent component
      if (onQueryResult) {
        onQueryResult({
          columns: response.data.columns,
          rows: response.data.rows,
          status: `Executed successfully. ${response.data.rows.length} row(s) returned. Time: ${response.data.execution_time}ms`
        });
      }
    } catch (err) {
      console.error("Query execution error:", err);
      setQueryError(err.response?.data?.message || "Failed to execute query");
      
      // Pass the error back to the parent component
      if (onQueryResult) {
        onQueryResult(null);
      }
    } finally {
      setQueryLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h6" className="mb-4">
        Execute SQL Query
      </Typography>
      
      {queryError && (
        <Alert severity="error" className="mb-4">
          {queryError}
        </Alert>
      )}
      
      <form onSubmit={handleExecuteQuery} className="space-y-4">
        <TextField
          label="SQL Query"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          fullWidth
          multiline
          rows={5}
          variant="outlined"
          placeholder="SELECT * FROM table_name"
          required
          className="font-mono"
          sx={{ 
            "& .MuiOutlinedInput-root": { 
              backgroundColor: "rgba(31, 39, 54, 0.8)" 
            } 
          }}
        />
        
        <Button
          type="submit"
          variant="contained"
          color="primary"
          disabled={queryLoading}
          startIcon={<PlayArrowIcon />}
        >
          {queryLoading ? "Executing..." : "Execute Query"}
        </Button>
      </form>
    </Box>
  );
};

// This component displays the result of a query
export const QueryResultPanel = ({ queryResult }) => {
  if (!queryResult) return null;
  
  return (
    <Paper className="w-full rounded-lg shadow-md overflow-hidden" sx={{ 
      backgroundColor: '#1F2736',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
    }}>
      <Box className="p-4 border-b border-gray-700">
        <Typography variant="subtitle1" className="font-semibold mb-2">
          Results
        </Typography>
        <Typography variant="caption" className="text-gray-400 mb-2 block">
          {queryResult.status}
        </Typography>
      </Box>
      
      {queryResult.columns && queryResult.columns.length > 0 ? (
        <Box className="overflow-x-auto w-full">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-800">
              <tr>
                {queryResult.columns.map((column, idx) => (
                  <th
                    key={idx}
                    className="px-3 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-gray-700 divide-y divide-gray-600">
              {queryResult.rows.map((row, rowIdx) => (
                <tr key={rowIdx} className={rowIdx % 2 === 0 ? "bg-gray-800" : "bg-gray-700"}>
                  {row.map((cell, cellIdx) => (
                    <td
                      key={cellIdx}
                      className="px-3 py-2 text-sm text-gray-300 whitespace-nowrap"
                    >
                      {cell === null ? (
                        <span className="text-gray-400 italic">NULL</span>
                      ) : String(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Box>
      ) : (
        <Typography className="text-center text-gray-400 py-4">
          No results returned
        </Typography>
      )}
    </Paper>
  );
};

export default QueryPanel;