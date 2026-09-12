import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  List, 
  ListItem, 
  ListItemText, 
  ListItemButton, 
  IconButton, 
  Button, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  TextField,
  Divider,
  Tooltip,
  Fab,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  FormHelperText
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import DatabaseIcon from '@mui/icons-material/Storage';
import api from '../api';
import LoadingIndicator from './LoadingIndicator';

function SessionSelector({ currentSessionId, onSessionSelect, fullHeight = false, databaseId = null }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [newSessionTitle, setNewSessionTitle] = useState('');
  const [editingSession, setEditingSession] = useState(null);
  const [databases, setDatabases] = useState([]);
  const [selectedDatabase, setSelectedDatabase] = useState(null);
  const [databaseError, setDatabaseError] = useState('');

  // Fetch user sessions
  useEffect(() => {
    fetchSessions();
    loadDatabases(); // Load databases when component mounts
  }, [databaseId]);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      let response;
      if (databaseId) {
        // Filter sessions by database ID if provided
        response = await api.getSessionsByDatabase(databaseId);
      } else {
        // Otherwise, get all sessions
        response = await api.getSessions();
      }
      setSessions(response.data);
    } catch (error) {
      console.error('Error fetching sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load available databases
  const loadDatabases = async () => {
    try {
      const response = await api.getDatabases();
      setDatabases(response.data);
    } catch (error) {
      console.error('Error loading databases:', error);
      // Set empty array if we can't load databases
      setDatabases([]);
    }
  };

  const handleCreateSession = async () => {
    // Validate database selection
    if (!selectedDatabase) {
      setDatabaseError('Please select a database for this session');
      return;
    }

    try {
      const response = await api.createSession(newSessionTitle || 'New Session', selectedDatabase);
      setSessions([response.data, ...sessions]);
      onSessionSelect(response.data.id);
      
      // Reset form
      setNewSessionTitle('');
      setSelectedDatabase(null);
      setDatabaseError('');
      setCreateDialogOpen(false);
    } catch (error) {
      console.error('Error creating session:', error);
    }
  };

  const handleUpdateSession = async () => {
    if (!editingSession) return;
    
    try {
      await api.updateSessionTitle(editingSession.id, newSessionTitle);
      setSessions(sessions.map(s => 
        s.id === editingSession.id ? { ...s, title: newSessionTitle } : s
      ));
      setEditDialogOpen(false);
      setEditingSession(null);
      setNewSessionTitle('');
    } catch (error) {
      console.error('Error updating session:', error);
    }
  };

  const handleDeleteSession = async (sessionId) => {
    if (!confirm('Are you sure you want to delete this session?')) return;
    
    try {
      await api.deleteSession(sessionId);
      setSessions(sessions.filter(s => s.id !== sessionId));
      
      // If the current session was deleted, select another one if available
      if (sessionId === currentSessionId && sessions.length > 1) {
        const remainingSessions = sessions.filter(s => s.id !== sessionId);
        if (remainingSessions.length > 0) {
          onSessionSelect(remainingSessions[0].id);
        }
      }
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  };

  const openEditDialog = (session) => {
    setEditingSession(session);
    setNewSessionTitle(session.title);
    setEditDialogOpen(true);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: fullHeight ? '100%' : 'auto', py: 4 }}>
        <LoadingIndicator />
      </Box>
    );
  }

  return (
    <Box 
      sx={{ 
        color: 'text.primary',
        display: 'flex',
        flexDirection: 'column',
        height: fullHeight ? '100%' : 'auto'
      }}
    >
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        mb: 2,
        position: 'relative'
      }}>
        <Typography variant="h6" sx={{ fontSize: '1.1rem', fontWeight: 500 }}>Your Sessions</Typography>
        <Button 
          startIcon={<AddIcon />} 
          variant="contained" 
          size="small"
          onClick={() => setCreateDialogOpen(true)}
          sx={{
            borderRadius: 8,
            textTransform: 'none',
            fontSize: '0.8rem',
            py: 0.5,
            px: 1.5
          }}
        >
          New Session
        </Button>
      </Box>
      
      {sessions.length === 0 ? (
        <Box 
          sx={{ 
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: fullHeight ? '100%' : '200px',
            borderRadius: 2, // Rounded corners for empty state box
            bgcolor: 'background.default',
            p: 2
          }}
        >
          <Typography variant="body2" sx={{ fontStyle: 'italic', textAlign: 'center', color: 'text.secondary' }}>
            No sessions yet. Create your first session to get started!
          </Typography>
          <Fab 
            color="primary" 
            size="medium" 
            onClick={() => setCreateDialogOpen(true)}
            sx={{ mt: 2 }}
          >
            <AddIcon />
          </Fab>
        </Box>
      ) : (
        <List 
          dense 
          disablePadding 
          sx={{ 
            flexGrow: 1,
            overflow: 'auto',
            bgcolor: 'background.default',
            borderRadius: 2, // Rounded corners for the list container
            '& .MuiListItemButton-root': {
              borderLeft: '3px solid transparent',
              py: 1.2,
              transition: 'all 0.2s ease',
              borderRadius: '12px', // Rounded corners for list items
              my: 0.5 // Add some vertical spacing between items
            },
            '& .MuiListItemButton-root:hover': {
              bgcolor: 'rgba(144, 202, 249, 0.08)'
            },
            '& .MuiListItemButton-root.Mui-selected': {
              bgcolor: 'rgba(144, 202, 249, 0.12)',
              borderLeft: '3px solid',
              borderLeftColor: 'primary.main'
            }
          }}
        >
          {sessions.map((session) => (
            <ListItem
              key={session.id}
              disablePadding
              secondaryAction={
                <Box sx={{ 
                  display: 'flex', 
                  opacity: 0.6, 
                  transition: 'opacity 0.2s ease', 
                  '&:hover': { opacity: 1 },
                  mr: 1 // Add right margin for better spacing
                }}>
                  <Tooltip title="Edit session title">
                    <IconButton edge="end" onClick={() => openEditDialog(session)} size="small" sx={{ color: 'text.secondary', mx: 0.5 }}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete session">
                    <IconButton edge="end" onClick={() => handleDeleteSession(session.id)} size="small" sx={{ color: 'text.secondary', mx: 0.5 }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              }
            >
              <ListItemButton 
                selected={session.id === currentSessionId}
                onClick={() => onSessionSelect(session.id)}
                dense
                sx={{
                  px: 2
                }}
              >
                <ListItemText 
                  primary={session.title} 
                  secondary={
                    <React.Fragment>
                      <Typography variant="caption" component="span" sx={{ color: 'text.secondary' }}>
                        {formatDate(session.updated_at)}
                      </Typography>
                      <Typography 
                        variant="caption" 
                        component="span" 
                        sx={{ 
                          ml: 1, 
                          color: 'text.secondary',
                          border: '1px solid',
                          borderColor: 'divider',
                          px: 0.8,
                          py: 0.2,
                          borderRadius: 4,
                          fontSize: '0.65rem'
                        }}
                      >
                        {session.query_count} {session.query_count === 1 ? 'query' : 'queries'}
                      </Typography>
                    </React.Fragment>
                  }
                  primaryTypographyProps={{ 
                    color: 'text.primary',
                    fontWeight: session.id === currentSessionId ? 500 : 400,
                    fontSize: '0.95rem'
                  }}
                  secondaryTypographyProps={{ 
                    fontSize: '0.75rem'
                  }}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      )}

      {/* Create Session Dialog */}
      <Dialog 
        open={createDialogOpen} 
        onClose={() => setCreateDialogOpen(false)}
        PaperProps={{
          sx: {
            bgcolor: 'background.paper',
            color: 'text.primary',
            borderRadius: 2,
            overflow: 'hidden'
          }
        }}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle sx={{ pb: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
          Create New Session
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <TextField
            autoFocus
            margin="dense"
            label="Session Title"
            type="text"
            fullWidth
            variant="outlined"
            value={newSessionTitle}
            onChange={(e) => setNewSessionTitle(e.target.value)}
            placeholder="New Session"
          />
          <FormControl fullWidth margin="dense" error={!!databaseError}>
            <InputLabel id="database-select-label">Select Database</InputLabel>
            <Select
              labelId="database-select-label"
              value={selectedDatabase || ''}
              onChange={(e) => {
                const selectedDb = databases.find(db => db.id === e.target.value);
                setSelectedDatabase(selectedDb);
                setDatabaseError('');
              }}
              label="Select Database"
              renderValue={(selected) => {
                return (
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <DatabaseIcon fontSize="small" sx={{ mr: 1, color: 'secondary.main' }} />
                    {selectedDatabase ? selectedDatabase.name : ''}
                  </Box>
                );
              }}
            >
              {databases.map((db) => (
                <MenuItem key={db.id} value={db.id}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <DatabaseIcon fontSize="small" sx={{ mr: 1, color: 'secondary.main' }} />
                    {db.name}
                  </Box>
                </MenuItem>
              ))}
            </Select>
            {databaseError && <FormHelperText>{databaseError}</FormHelperText>}
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button 
            onClick={() => setCreateDialogOpen(false)} 
            variant="text"
            sx={{ color: 'text.secondary' }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleCreateSession} 
            variant="contained"
            sx={{ borderRadius: 8, px: 3 }}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Session Dialog */}
      <Dialog 
        open={editDialogOpen} 
        onClose={() => setEditDialogOpen(false)}
        PaperProps={{
          sx: {
            bgcolor: 'background.paper',
            color: 'text.primary',
            borderRadius: 2
          }
        }}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle sx={{ pb: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
          Edit Session Title
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <TextField
            autoFocus
            margin="dense"
            label="Session Title"
            type="text"
            fullWidth
            variant="outlined"
            value={newSessionTitle}
            onChange={(e) => setNewSessionTitle(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button 
            onClick={() => setEditDialogOpen(false)}
            variant="text"
            sx={{ color: 'text.secondary' }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleUpdateSession} 
            variant="contained"
            sx={{ borderRadius: 8, px: 3 }}
          >
            Update
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default SessionSelector;

