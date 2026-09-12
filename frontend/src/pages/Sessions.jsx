import { useState, useEffect } from 'react';
import { 
  Typography, 
  Box, 
  Paper, 
  Container, 
  Button, 
  TextField, 
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  Divider,
  IconButton,
  Tooltip,
  Alert,
  Snackbar,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Breadcrumbs,
  Link
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import LogoutIcon from '@mui/icons-material/Logout';
import DatabaseIcon from '@mui/icons-material/Storage';
import HomeIcon from '@mui/icons-material/Home';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api';
import LoadingIndicator from '../components/LoadingIndicator';
import Navbar from '../components/Navbar';

function Sessions() {
  const navigate = useNavigate();
  const location = useLocation();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [newSessionTitle, setNewSessionTitle] = useState('');
  const [editingSession, setEditingSession] = useState(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');
  const [error, setError] = useState(null);
  
  // Get selected database from location state or localStorage
  const [selectedDatabase, setSelectedDatabase] = useState(() => {
    if (location.state?.database) {
      return location.state.database;
    } else {
      const storedDb = localStorage.getItem('selectedDatabase');
      return storedDb ? JSON.parse(storedDb) : null;
    }
  });

  // Redirect to database selection if no database is selected
  useEffect(() => {
    if (!selectedDatabase) {
      navigate('/');
      return;
    }
    
    // Store in localStorage for persistence
    if (location.state?.database) {
      localStorage.setItem('selectedDatabase', JSON.stringify(location.state.database));
    }
    
    fetchSessions();
  }, [selectedDatabase]);

  const fetchSessions = async () => {
    if (!selectedDatabase) return;
    
    setLoading(true);
    try {
      // Call API with database filter
      const response = await api.getSessionsByDatabase(selectedDatabase.id);
      setSessions(response.data);
    } catch (error) {
      console.error('Error fetching sessions:', error);
      showSnackbar('Could not load your sessions. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSession = async () => {
    if (!selectedDatabase) {
      showSnackbar('No database selected', 'error');
      return;
    }

    try {
      const response = await api.createSession(newSessionTitle || 'New Session', selectedDatabase);
      
      setSessions([response.data, ...sessions]);
      
      // Reset form
      setNewSessionTitle('');
      setCreateDialogOpen(false);
      
      showSnackbar('Session created successfully');
    } catch (error) {
      console.error('Error creating session:', error);
      showSnackbar('Could not create session. Please try again.', 'error');
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
      
      showSnackbar('Session updated successfully');
    } catch (error) {
      console.error('Error updating session:', error);
      showSnackbar('Could not update session. Please try again.', 'error');
    }
  };

  const handleDeleteSession = async (sessionId) => {
    if (!confirm('Are you sure you want to delete this session?')) return;
    
    try {
      await api.deleteSession(sessionId);
      setSessions(sessions.filter(s => s.id !== sessionId));
      
      showSnackbar('Session deleted successfully');
    } catch (error) {
      console.error('Error deleting session:', error);
      showSnackbar('Could not delete session. Please try again.', 'error');
    }
  };

  const openEditDialog = (session) => {
    setEditingSession(session);
    setNewSessionTitle(session.title);
    setEditDialogOpen(true);
  };

  const handleSelectSession = (session) => {
    // Navigate to the query page with the selected session
    navigate('/query', { state: { sessionId: session.id, database: selectedDatabase } });
  };

  // Handle session selection
  const handleSessionSelect = (session) => {
    navigate(`/query/${session.id}`);
  };

  const showSnackbar = (message, severity = 'success') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
          <LoadingIndicator />
          <Typography variant="h6" sx={{ ml: 2 }}>
            Loading your sessions...
          </Typography>
        </Box>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <Container maxWidth="md" sx={{ pt: 4 }}>
        <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
          {/* Back button and title */}
          <Box display="flex" alignItems="center" mb={3}>
            <IconButton 
              onClick={() => navigate('/databases')} 
              color="primary" 
              aria-label="back to databases" 
              sx={{ mr: 2 }}
            >
              <ArrowBackIcon />
            </IconButton>
            <Typography variant="h4" component="h1" gutterBottom sx={{ color: 'primary.main' }}>
              Query Sessions
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 4 }}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setCreateDialogOpen(true)}
              sx={{ py: 1.5, px: 3, borderRadius: 2 }}
            >
              New Session
            </Button>
          </Box>

          <Box sx={{ bgcolor: 'background.paper', p: 2, mb: 3, borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', color: 'text.secondary' }}>
              <DatabaseIcon sx={{ mr: 1 }} />
              {selectedDatabase?.name || 'Current Database'}
              {selectedDatabase?.description && (
                <Typography variant="body2" component="span" sx={{ ml: 1, color: 'text.secondary' }}>
                  - {selectedDatabase.description}
                </Typography>
              )}
            </Typography>
          </Box>

          {sessions.length === 0 ? (
            <Box sx={{ 
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              p: 8,
              bgcolor: 'background.default',
              borderRadius: 2
            }}>
              <Typography variant="h6" sx={{ mb: 2, color: 'text.secondary' }}>
                No sessions found for this database
              </Typography>
              <Typography variant="body1" sx={{ mb: 3, color: 'text.secondary', textAlign: 'center' }}>
                Create your first session to get started with querying this database
              </Typography>
              <Button
                variant="contained"
                size="large"
                startIcon={<AddIcon />}
                onClick={() => setCreateDialogOpen(true)}
              >
                Create New Session
              </Button>
            </Box>
          ) : (
            <List sx={{ bgcolor: 'background.default', borderRadius: 2 }}>
              {sessions.map((session) => (
                <ListItem 
                  key={session.id}
                  disablePadding
                  secondaryAction={
                    <Box sx={{ display: 'flex' }}>
                      <Tooltip title="Edit session title">
                        <IconButton onClick={(e) => {
                          e.stopPropagation();
                          openEditDialog(session);
                        }}>
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete session">
                        <IconButton onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSession(session.id);
                        }}>
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  }
                  divider
                >
                  <ListItemButton onClick={() => handleSessionSelect(session)} sx={{ py: 2 }}>
                    <ListItemText
                      primary={
                        <Typography variant="h6" sx={{ fontSize: '1.1rem' }}>
                          {session.title}
                        </Typography>
                      }
                      secondary={
                        <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                          <Typography variant="body2" color="text.secondary">
                            Last updated: {formatDate(session.updated_at)}
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          )}
        </Paper>
      </Container>

      {/* Create Session Dialog */}
      <Dialog 
        open={createDialogOpen} 
        onClose={() => setCreateDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Create New Session</DialogTitle>
        <DialogContent>
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
            sx={{ mb: 2, mt: 1 }}
          />
          <Box sx={{ display: 'flex', alignItems: 'center', p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
            <DatabaseIcon sx={{ mr: 2, color: 'primary.main' }} />
            <Typography>
              {selectedDatabase?.name || 'Selected Database'}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreateDialogOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreateSession} variant="contained">
            Create Session
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Session Dialog */}
      <Dialog 
        open={editDialogOpen} 
        onClose={() => setEditDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Edit Session</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Session Title"
            type="text"
            fullWidth
            variant="outlined"
            value={newSessionTitle}
            onChange={(e) => setNewSessionTitle(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditDialogOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleUpdateSession} variant="contained">
            Update
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSnackbarOpen(false)} 
          severity={snackbarSeverity} 
          variant="filled"
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </>
  );
}

export default Sessions;