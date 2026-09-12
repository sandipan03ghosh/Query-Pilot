import { useState, useEffect } from 'react';
import { 
  Typography, 
  Box, 
  Paper, 
  CircularProgress,
  Grid,
  alpha,
  useTheme,
  Divider,
  Snackbar,
  Alert
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import LogoutIcon from '@mui/icons-material/Logout';
import StorageIcon from '@mui/icons-material/Storage';
import DashboardIcon from '@mui/icons-material/Dashboard';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import Navbar from '../components/Navbar';
import { motion } from 'framer-motion';

// Import custom components
import DatabaseCard from '../components/database/DatabaseCard';
import AddDatabaseDialog from '../components/database/AddDatabaseDialog';
import UpdateDatabaseDialog from '../components/database/UpdateDatabaseDialog';
import DeleteDatabaseDialog from '../components/database/DeleteDatabaseDialog';
import DatabaseOptionsDialog from '../components/database/DatabaseOptionsDialog';
import { 
  MotionBox, 
  MotionPaper, 
  MotionButton, 
  MotionContainer, 
  MotionTypography 
} from '../components/database/MotionComponents';

// Import animation variants
import { containerVariants, itemVariants } from '../components/database/AnimationVariants';

function DatabaseSelection() {
  const theme = useTheme();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [databases, setDatabases] = useState([]);
  const [selectedDatabase, setSelectedDatabase] = useState(null);
  
  // Dialog states
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [optionsDialogOpen, setOptionsDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [databaseToDelete, setDatabaseToDelete] = useState(null);
  
  // Form state
  const [newDatabaseInfo, setNewDatabaseInfo] = useState({
    name: '',
    description: '',
    host: '',
    port: '5432',
    database_name: '',
    username: '',
    password: '',
    ssl_enabled: false
  });
  
  // Errors and messages
  const [error, setError] = useState(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');

  // Fetch databases on component mount
  useEffect(() => {
    fetchDatabases();
  }, []);

  const fetchDatabases = async () => {
    setLoading(true);
    try {
      const response = await api.getDatabases();
      setDatabases(response.data);
    } catch (error) {
      console.error('Error fetching databases:', error);
      showSnackbar('Failed to fetch databases', 'error');
    } finally {
      setTimeout(() => {
        setLoading(false);
      }, 800); // Small delay to show the loading animation
    }
  };

  const handleAddDatabaseChange = (e) => {
    const { name, value } = e.target;
    setNewDatabaseInfo({
      ...newDatabaseInfo,
      [name]: value
    });
  };

  const handleAddDatabaseSubmit = async () => {
    if (!validateDatabaseForm()) {
      return;
    }
    
    setLoading(true);
    try {
      const response = await api.createDatabase(newDatabaseInfo);
      setDatabases([...databases, response.data]);
      setAddDialogOpen(false);
      resetNewDatabaseForm();
      showSnackbar(`Database "${newDatabaseInfo.name}" added successfully`, 'success');
    } catch (error) {
      console.error('Error adding database:', error);
      setError(error.response?.data?.message || 'Error adding database');
      showSnackbar('Failed to add database', 'error');
    } finally {
      setLoading(false);
    }
  };

  const validateDatabaseForm = () => {
    if (!newDatabaseInfo.name.trim()) {
      setError('Database name is required');
      return false;
    }
    if (!newDatabaseInfo.host.trim()) {
      setError('Host is required');
      return false;
    }
    if (!newDatabaseInfo.database_name.trim()) {
      setError('Database name is required');
      return false;
    }
    if (!newDatabaseInfo.username.trim()) {
      setError('Username is required');
      return false;
    }
    if (!newDatabaseInfo.password.trim()) {
      setError('Password is required');
      return false;
    }
    return true;
  };

  const resetNewDatabaseForm = () => {
    setNewDatabaseInfo({
      name: '',
      description: '',
      host: '',
      port: '5432',
      database_name: '',
      username: '',
      password: '',
      ssl_enabled: false
    });
    setError(null);
  };

  const handleSelectDatabase = (database) => {
    setSelectedDatabase(database);
    // Store selected database in localStorage for access across the app
    localStorage.setItem('selectedDatabase', JSON.stringify(database));
    setOptionsDialogOpen(true);
  };

  const handleUpdateMetadata = () => {
    setOptionsDialogOpen(false);
    // Navigate to the metadata manager page with the selected database info
    navigate(`../db-tester`);
  };

  const handleUpdateDatabase = async (updatedInfo) => {
    if (!selectedDatabase) return;
    
    setLoading(true);
    try {
      const response = await api.updateDatabase(selectedDatabase.id, updatedInfo);
      
      // Update the local state with updated database
      setDatabases(databases.map(db => 
        db.id === selectedDatabase.id ? response.data : db
      ));
      
      // Show success message
      showSnackbar(`Database "${updatedInfo.name}" updated successfully`, 'success');
      
      // Update the selected database in localStorage
      localStorage.setItem('selectedDatabase', JSON.stringify(response.data));
      
      // Close the dialog
      setUpdateDialogOpen(false);
    } catch (error) {
      console.error('Error updating database:', error);
      showSnackbar('Failed to update database', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleQueryDatabase = () => {
    navigate('/sessions', { state: { database: selectedDatabase } });
    setOptionsDialogOpen(false);
  };

  const handleDeleteDatabase = async () => {
    if (!databaseToDelete) return;
    
    setLoading(true);
    try {
      await api.deleteDatabase(databaseToDelete.id);
      
      // Update the local state to remove the deleted database
      setDatabases(databases.filter(db => db.id !== databaseToDelete.id));
      
      // Show success message
      showSnackbar(`Database "${databaseToDelete.name}" deleted successfully`, 'success');
      
      // Close the dialog and reset state
      setDeleteDialogOpen(false);
      setDatabaseToDelete(null);
    } catch (error) {
      console.error('Error deleting database:', error);
      showSnackbar('Failed to delete database', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openDeleteDialog = (db, event) => {
    // Stop propagation to prevent the list item click from triggering
    event.stopPropagation();
    setDatabaseToDelete(db);
    setDeleteDialogOpen(true);
  };

  const showSnackbar = (message, severity = 'success') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  return (
    <>
      <Navbar />
      <Box
        component="main"
        sx={{
          minHeight: '100vh',
          padding: theme => `calc(${theme.spacing(8)} + 70px) 0 ${theme.spacing(4)}`,
          width: '100%',
          background: 'radial-gradient(circle at top right, rgba(124, 77, 255, 0.03), rgba(0, 0, 0, 0.15))',
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            width: '300px',
            height: '300px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(124, 77, 255, 0.1) 0%, rgba(124, 77, 255, 0) 70%)',
            filter: 'blur(80px)',
            top: '5%',
            right: '5%',
            transform: 'translate(50%, -50%)',
            zIndex: 0,
          },
          '&::after': {
            content: '""',
            position: 'absolute',
            width: '250px',
            height: '250px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(3, 218, 198, 0.08) 0%, rgba(3, 218, 198, 0) 70%)',
            filter: 'blur(60px)',
            bottom: '10%',
            left: '5%',
            transform: 'translate(-50%, 50%)',
            zIndex: 0,
          }
        }}
      >
        <MotionContainer 
          maxWidth="lg" 
          component={motion.div}
          initial="hidden"
          animate="visible"
          variants={containerVariants}
        >
          <MotionPaper
            variants={itemVariants}
            elevation={3} 
            sx={{ 
              p: 4, 
              borderRadius: 4,
              position: 'relative',
              overflow: 'hidden',
              background: 'rgba(26, 35, 50, 0.8)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              zIndex: 1,
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '5px',
                background: 'linear-gradient(90deg, #7C4DFF, #03DAC6, #64FFDA)',
                backgroundSize: '200% 100%',
                animation: 'gradient-animation 4s linear infinite',
                '@keyframes gradient-animation': {
                  '0%': { backgroundPosition: '0% 0%' },
                  '100%': { backgroundPosition: '200% 0%' },
                }
              }
            }}
          >
            <MotionBox 
              variants={itemVariants}
              sx={{ 
                display: 'flex', 
                flexDirection: { xs: 'column', md: 'row' },
                justifyContent: 'space-between', 
                alignItems: { xs: 'flex-start', md: 'center' }, 
                mb: 4 
              }}
            >
              <MotionTypography 
                variant="h4" 
                component="h1" 
                sx={{ 
                  fontWeight: 'bold',
                  background: 'linear-gradient(45deg, #7C4DFF, #03DAC6)',
                  backgroundSize: '200% auto',
                  animation: 'gradient-text-animation 4s infinite linear',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  mb: { xs: 2, md: 0 },
                  '@keyframes gradient-text-animation': {
                    '0%': { backgroundPosition: '0% center' },
                    '100%': { backgroundPosition: '200% center' },
                  }
                }}
              >
                Database Management
              </MotionTypography>
              
              <MotionButton
                component={motion.button}
                whileHover={{ 
                  scale: 1.05, 
                  boxShadow: '0 0 20px rgba(124, 77, 255, 0.5)'
                }}
                whileTap={{ scale: 0.95 }}
                transition={{
                  type: "spring",
                  stiffness: 400,
                  damping: 10
                }}
                variant="outlined"
                startIcon={<LogoutIcon />}
                onClick={() => navigate('/logout')}
                sx={{ 
                  py: 1.5, 
                  px: 3, 
                  borderRadius: 3,
                  borderWidth: 2,
                  borderColor: alpha(theme.palette.primary.main, 0.5),
                  background: alpha(theme.palette.background.paper, 0.2),
                  backdropFilter: 'blur(10px)',
                  '&:hover': {
                    borderWidth: 2,
                    borderColor: theme.palette.primary.main,
                  }
                }}
              >
                Sign Out
              </MotionButton>
            </MotionBox>
            
            <MotionBox
              variants={itemVariants}
              sx={{
                display: 'flex', 
                justifyContent: 'center', 
                gap: 3, 
                mb: 5,
                flexWrap: 'wrap',
              }}
            >
              <MotionButton
                component={motion.button}
                whileHover={{ 
                  scale: 1.05, 
                  boxShadow: '0 10px 25px rgba(124, 77, 255, 0.5)'
                }}
                whileTap={{ scale: 0.95 }}
                transition={{
                  type: "spring",
                  stiffness: 400,
                  damping: 10
                }}
                variant="contained"
                size="large"
                startIcon={<AddIcon />}
                onClick={() => setAddDialogOpen(true)}
                sx={{ 
                  py: 1.8, 
                  px: 4, 
                  borderRadius: 3,
                  fontSize: '1.1rem',
                  boxShadow: '0 8px 15px rgba(124, 77, 255, 0.3)',
                }}
              >
                Add New Database
              </MotionButton>
              
              <MotionButton
                component={motion.button}
                whileHover={{ 
                  scale: 1.05, 
                  boxShadow: '0 10px 25px rgba(3, 218, 198, 0.5)'
                }}
                whileTap={{ scale: 0.95 }}
                transition={{
                  type: "spring",
                  stiffness: 400,
                  damping: 10
                }}
                variant="contained"
                color="secondary"
                size="large"
                startIcon={<DashboardIcon />}
                onClick={() => navigate('/dashboard')}
                sx={{ 
                  py: 1.8, 
                  px: 4, 
                  borderRadius: 3,
                  fontSize: '1.1rem',
                  boxShadow: '0 8px 15px rgba(3, 218, 198, 0.3)',
                }}
              >
                Dashboard
              </MotionButton>
            </MotionBox>

            <MotionBox variants={itemVariants} sx={{ mt: 5 }}>
              <MotionBox 
                sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  mb: 3, 
                  background: alpha(theme.palette.background.paper, 0.3),
                  backdropFilter: 'blur(8px)',
                  borderRadius: 3,
                  p: 2,
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)',
                }}
              >
                <MotionBox
                  component={motion.div}
                  animate={{ 
                    rotate: [0, 10, 0, -10, 0],
                    scale: [1, 1.1, 1, 1.1, 1],
                  }}
                  transition={{ 
                    repeat: Infinity, 
                    repeatDelay: 5,
                    duration: 1.5
                  }}
                >
                  <StorageIcon sx={{ 
                    mr: 2, 
                    fontSize: 32, 
                    color: theme.palette.primary.main,
                    filter: 'drop-shadow(0 2px 5px rgba(124, 77, 255, 0.4))'
                  }} />
                </MotionBox>
                <Typography variant="h5" sx={{ 
                  color: 'text.primary',
                  fontWeight: 600,
                  letterSpacing: '0.5px',
                }}>
                  Your Databases
                </Typography>
              </MotionBox>
              <Divider sx={{ 
                mb: 4,
                borderColor: alpha(theme.palette.divider, 0.1),
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
              }} />
              
              {loading ? (
                <MotionBox 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  sx={{ 
                    display: 'flex', 
                    justifyContent: 'center', 
                    alignItems: 'center', 
                    py: 12,
                    flexDirection: 'column',
                    gap: 3
                  }}
                >
                  <motion.div
                    animate={{
                      scale: [1, 1.2, 1],
                      rotate: [0, 180, 360],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  >
                    <CircularProgress size={70} thickness={4} sx={{
                      color: theme.palette.primary.main,
                      '& .MuiCircularProgress-circle': {
                        strokeLinecap: 'round',
                      }
                    }} />
                  </motion.div>
                  <MotionTypography
                    variant="h6"
                    animate={{
                      opacity: [0.6, 1, 0.6],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                    sx={{ color: alpha(theme.palette.text.primary, 0.7) }}
                  >
                    Loading your databases...
                  </MotionTypography>
                </MotionBox>
              ) : databases.length === 0 ? (
                <MotionPaper
                  variants={itemVariants}
                  elevation={0}
                  sx={{ 
                    py: 8, 
                    px: 4, 
                    textAlign: 'center', 
                    borderRadius: 4,
                    background: alpha(theme.palette.background.paper, 0.2),
                    backdropFilter: 'blur(8px)',
                    border: '1px dashed',
                    borderColor: alpha(theme.palette.divider, 0.4)
                  }}
                >
                  <MotionBox
                    component={motion.div}
                    animate={{ 
                      y: [0, -10, 0],
                      scale: [1, 1.05, 1],
                    }}
                    transition={{ 
                      repeat: Infinity, 
                      repeatDelay: 1.5,
                      duration: 2
                    }}
                    sx={{ mb: 3 }}
                  >
                    <StorageIcon sx={{ 
                      fontSize: 80,
                      color: alpha(theme.palette.primary.main, 0.5),
                      filter: 'drop-shadow(0 4px 8px rgba(124, 77, 255, 0.3))'
                    }} />
                  </MotionBox>
                  
                  <Typography variant="h5" sx={{ 
                    color: alpha(theme.palette.text.primary, 0.9),
                    fontWeight: 600,
                    mb: 2,
                    background: 'linear-gradient(45deg, #7C4DFF, #03DAC6)',
                    backgroundSize: '200% auto',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}>
                    No databases available yet
                  </Typography>
                  <Typography variant="body1" sx={{ 
                    color: alpha(theme.palette.text.secondary, 0.9),
                    maxWidth: '600px',
                    mx: 'auto',
                    mb: 4,
                    lineHeight: 1.6
                  }}>
                    Get started by adding a new database connection to begin querying your data with natural language.
                    Add PostgreSQL databases to explore with AI-powered natural language queries.
                  </Typography>
                  <MotionButton
                    component={motion.button}
                    whileHover={{ 
                      scale: 1.05, 
                      boxShadow: '0 10px 25px rgba(124, 77, 255, 0.5)'
                    }}
                    whileTap={{ scale: 0.95 }}
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 10
                    }}
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => setAddDialogOpen(true)}
                    size="large"
                    sx={{ 
                      py: 1.5, 
                      px: 4, 
                      borderRadius: 3,
                      fontSize: '1rem',
                      boxShadow: '0 8px 15px rgba(124, 77, 255, 0.3)',
                    }}
                  >
                    Add Your First Database
                  </MotionButton>
                </MotionPaper>
              ) : (
                <MotionBox
                  component={motion.div}
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                >
                  <Grid container spacing={3}>
                    {databases.map((db, index) => (
                      <Grid item xs={12} sm={6} md={4} key={db.id}>
                        <DatabaseCard 
                          db={db}
                          index={index}
                          handleSelectDatabase={handleSelectDatabase}
                          handleQueryDatabase={handleQueryDatabase}
                          openDeleteDialog={openDeleteDialog}
                        />
                      </Grid>
                    ))}
                  </Grid>
                </MotionBox>
              )}
            </MotionBox>
          </MotionPaper>
        </MotionContainer>
      </Box>

      {/* Add Database Dialog */}
      <AddDatabaseDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        loading={loading}
        newDatabaseInfo={newDatabaseInfo}
        handleAddDatabaseChange={handleAddDatabaseChange}
        handleAddDatabaseSubmit={handleAddDatabaseSubmit}
        resetNewDatabaseForm={resetNewDatabaseForm}
        error={error}
      />

      {/* Database Options Dialog */}
      <DatabaseOptionsDialog
        open={optionsDialogOpen}
        onClose={() => setOptionsDialogOpen(false)}
        selectedDatabase={selectedDatabase}
        handleUpdateMetadata={handleUpdateMetadata}
        handleQueryDatabase={handleQueryDatabase}
      />

      {/* Update Database Dialog */}
      <UpdateDatabaseDialog
        open={updateDialogOpen}
        onClose={() => setUpdateDialogOpen(false)}
        loading={loading}
        selectedDatabase={selectedDatabase}
        handleUpdateDatabase={handleUpdateDatabase}
      />

      {/* Delete Database Dialog */}
      <DeleteDatabaseDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        databaseToDelete={databaseToDelete}
        handleDeleteDatabase={handleDeleteDatabase}
        loading={loading}
      />

      {/* Snackbar for messages */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSnackbarOpen(false)} 
          severity={snackbarSeverity} 
          variant="filled"
          sx={{ 
            width: '100%', 
            borderRadius: 2,
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
          }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </>
  );
}

export default DatabaseSelection;
