import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Box, Button, CircularProgress, Typography, Paper, TextField, Divider, IconButton, Tooltip } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SaveIcon from '@mui/icons-material/Save';
import HistoryIcon from '@mui/icons-material/History';
import * as api from '../api';
import { DatabaseIcon } from '../components/Icons';
import NotFound from './NotFound';
import Navbar from '../components/Navbar';

function Query() {
  const location = useLocation();
  const navigate = useNavigate();
  const { sessionId, database } = location.state || {};
  
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [queryHistory, setQueryHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  
  const editorRef = useRef(null);

  // Redirect if no session or database is provided
  useEffect(() => {
    if (!sessionId || !database) {
      navigate('/databases');
      return;
    }
    
    const fetchSessionDetails = async () => {
      try {
        const response = await api.getSessionById(sessionId);
        setSession(response.data);
        // Load the last query if available
        if (response.data.last_query) {
          setQuery(response.data.last_query);
        } else {
          // Set a default starter query based on the database
          setQuery(`-- Connected to: ${database.name}\n-- Try a query like:\nSELECT * FROM information_schema.tables LIMIT 10;`);
        }
        
        // Load query history
        loadQueryHistory();
      } catch (error) {
        console.error('Error loading session:', error);
        setError('Failed to load session details. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchSessionDetails();
  }, [sessionId, database, navigate]);

  const loadQueryHistory = async () => {
    try {
      // This would ideally fetch the query history for this session from the backend
      // For now, we'll just initialize with an empty array or mock data
      // const response = await api.getQueryHistory(sessionId);
      // setQueryHistory(response.data);
      setQueryHistory([]); // Replace with actual API call when available
    } catch (error) {
      console.error('Error loading query history:', error);
    }
  };

  const handleQueryChange = (e) => {
    setQuery(e.target.value);
  };

  const executeQuery = async () => {
    if (!query.trim()) return;
    
    setExecuting(true);
    setError(null);
    
    try {
      // console.log('Executing query:', query);
      // console.log('Database ID:', database.id);
      
      const response = await api.executeSqlQuery(database.id, query);
      // console.log('Query execution response:', response);
      setResults(response.data);
      
      // Add to history
      setQueryHistory([
        { 
          id: Date.now(), 
          query, 
          timestamp: new Date().toISOString(),
          results: response.data 
        },
        ...queryHistory
      ]);
      
      // Save the query to the session
      await api.updateSession(sessionId, { last_query: query });
    } catch (error) {
      console.error('Error executing query:', error);
      console.error('Error response data:', error.response?.data);
      console.error('Error status:', error.response?.status);
      console.error('Error headers:', error.response?.headers);
      setError(error.response?.data?.error || error.response?.data?.detail || 'Failed to execute query. Please check your syntax and try again.');
    } finally {
      setExecuting(false);
    }
  };

  const handleHistoryItemClick = (item) => {
    setQuery(item.query);
    setShowHistory(false);
    // Optionally also set results if you want to show previous results
    // setResults(item.results);
  };

  const goBack = () => {
    navigate('/sessions', { state: { database } });
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
          <CircularProgress />
          <Typography variant="h6" sx={{ ml: 2 }}>
            Loading your session...
          </Typography>
        </Box>
      </>
    );
  }

  if (error && !session) {
    return (
      <>
        <Navbar />
        <NotFound message="Session not found or error loading session" />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <Box sx={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Back button and title header */}
        <Box 
          sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            bgcolor: 'background.paper', 
            borderBottom: '1px solid',
            borderColor: 'divider',
            p: 2,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <IconButton 
              color="primary" 
              onClick={goBack} 
              sx={{ mr: 1 }}
              aria-label="back to sessions"
            >
              <ArrowBackIcon />
            </IconButton>
            <Typography variant="h5">
              {session?.title || 'Query Session'}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <DatabaseIcon sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="body1" color="text.secondary">
              {database?.name || 'Unknown Database'}
            </Typography>
          </Box>
        </Box>

        {/* Main content */}
        <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
          {/* Query editor */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 2, overflow: 'hidden' }}>
            <Paper sx={{ 
              flex: 1, 
              display: 'flex', 
              flexDirection: 'column', 
              overflow: 'hidden',
              border: '1px solid #ddd'
            }}>
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                p: 1, 
                borderBottom: '1px solid #ddd',
                bgcolor: '#f5f5f5'
              }}>
                <Typography variant="body2" fontWeight="bold">SQL Editor</Typography>
                <Box>
                  <Tooltip title="Run Query">
                    <IconButton 
                      color="primary" 
                      onClick={executeQuery}
                      disabled={executing || !query.trim()}
                    >
                      {executing ? <CircularProgress size={24} /> : <PlayArrowIcon />}
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Save Query">
                    <IconButton 
                      onClick={() => api.updateSession(sessionId, { last_query: query })}
                      disabled={!query.trim()}
                    >
                      <SaveIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Query History">
                    <IconButton onClick={() => setShowHistory(!showHistory)}>
                      <HistoryIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
              
              <TextField
                inputRef={editorRef}
                multiline
                fullWidth
                value={query}
                onChange={handleQueryChange}
                variant="outlined"
                placeholder="Enter your SQL query here..."
                sx={{ 
                  flex: 1,
                  '& .MuiOutlinedInput-root': {
                    height: '100%',
                    '& textarea': {
                      height: '100% !important',
                      fontFamily: 'monospace',
                      fontSize: '14px',
                      lineHeight: '1.5',
                      padding: '16px'
                    },
                    '& fieldset': {
                      border: 'none'
                    }
                  }
                }}
              />
            </Paper>
            
            {/* Results area */}
            <Paper sx={{ 
              mt: 2, 
              height: '50%', 
              overflowX: 'auto',
              overflowY: 'auto',
              p: 2
            }}>
              <Typography variant="body2" fontWeight="bold" gutterBottom>
                Results {results && `(${results.rows?.length || 0} rows)`}
              </Typography>
              
              {error && (
                <Paper sx={{ p: 2, mb: 2, bgcolor: '#ffebee', color: '#c62828' }}>
                  <Typography variant="body2" fontFamily="monospace" whiteSpace="pre-wrap">
                    {error}
                  </Typography>
                </Paper>
              )}
              
              {results && !error && (
                <Box sx={{ overflowX: 'auto' }}>
                  <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                    <thead>
                      <tr>
                        {results.columns?.map((column, index) => (
                          <th 
                            key={index} 
                            style={{ 
                              textAlign: 'left', 
                              padding: '8px', 
                              borderBottom: '1px solid #ddd',
                              backgroundColor: '#f5f5f5'
                            }}
                          >
                            {column}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {results.rows?.map((row, rowIndex) => (
                        <tr key={rowIndex}>
                          {row.map((cell, cellIndex) => (
                            <td 
                              key={cellIndex} 
                              style={{ 
                                padding: '8px', 
                                borderBottom: '1px solid #ddd',
                                fontFamily: 'monospace',
                                fontSize: '14px'
                              }}
                            >
                              {cell === null ? 
                                <span style={{ color: '#999', fontStyle: 'italic' }}>NULL</span> : 
                                String(cell)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Box>
              )}
              
              {!results && !error && (
                <Typography variant="body2" color="textSecondary">
                  Execute a query to see results
                </Typography>
              )}
            </Paper>
          </Box>
          
          {/* History sidebar */}
          {showHistory && (
            <Paper sx={{ 
              width: 300, 
              p: 2, 
              borderLeft: '1px solid #ddd',
              overflowY: 'auto'
            }}>
              <Typography variant="h6" gutterBottom>
                Query History
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              {queryHistory.length === 0 ? (
                <Typography variant="body2" color="textSecondary">
                  No query history yet
                </Typography>
              ) : (
                queryHistory.map((item) => (
                  <Paper 
                    key={item.id}
                    sx={{ 
                      p: 1, 
                      mb: 1, 
                      cursor: 'pointer',
                      '&:hover': { bgcolor: '#f5f5f5' }
                    }}
                    onClick={() => handleHistoryItemClick(item)}
                  >
                    <Typography variant="body2" noWrap sx={{ fontFamily: 'monospace' }}>
                      {item.query.substring(0, 50)}{item.query.length > 50 ? '...' : ''}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {new Date(item.timestamp).toLocaleString()}
                    </Typography>
                  </Paper>
                ))
              )}
            </Paper>
          )}
        </Box>
      </Box>
    </>
  );
}

export default Query;