import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  CircularProgress,
  alpha,
  useTheme,
  Zoom
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';

const UpdateDatabaseDialog = ({
  open,
  onClose,
  loading,
  selectedDatabase,
  handleUpdateDatabase
}) => {
  const theme = useTheme();
  const [databaseInfo, setDatabaseInfo] = useState({
    name: '',
    description: '',
    host: '',
    port: '',
    database_name: '',
    username: '',
    password: '',
  });
  
  const [error, setError] = useState(null);

  useEffect(() => {
    if (selectedDatabase) {
      setDatabaseInfo({
        name: selectedDatabase.name || '',
        description: selectedDatabase.description || '',
        host: selectedDatabase.host || '',
        port: selectedDatabase.port || '',
        database_name: selectedDatabase.database_name || '',
        username: selectedDatabase.username || '',
        password: '', // Don't populate password for security reasons
      });
    }
  }, [selectedDatabase]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setDatabaseInfo({
      ...databaseInfo,
      [name]: value
    });
  };

  const handleSubmit = () => {
    if (validateForm()) {
      handleUpdateDatabase(databaseInfo);
    }
  };

  const validateForm = () => {
    if (!databaseInfo.name.trim()) {
      setError('Database name is required');
      return false;
    }
    if (!databaseInfo.host.trim()) {
      setError('Host is required');
      return false;
    }
    if (!databaseInfo.database_name.trim()) {
      setError('Database name is required');
      return false;
    }
    if (!databaseInfo.username.trim()) {
      setError('Username is required');
      return false;
    }
    return true;
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      TransitionComponent={Zoom}
      TransitionProps={{ timeout: 400 }}
      PaperProps={{
        sx: {
          borderRadius: 4,
          background: 'linear-gradient(135deg, rgba(26, 35, 50, 0.97) 0%, rgba(20, 24, 40, 0.98) 100%)',
          backgroundImage: 'linear-gradient(135deg, rgba(124, 77, 255, 0.02) 0%, rgba(3, 218, 198, 0.02) 100%)',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(30px)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: 'linear-gradient(90deg, #7C4DFF, #03DAC6)',
            borderRadius: '4px 4px 0 0'
          }
        }
      }}
    >
      <DialogTitle sx={{ 
        p: 3, 
        color: '#fff',
        fontWeight: 'bold',
        background: alpha(theme.palette.background.paper, 0.1),
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid',
        borderColor: alpha(theme.palette.divider, 0.1),
        display: 'flex',
        alignItems: 'center',
        gap: 2
      }}>
        <EditIcon sx={{ color: theme.palette.primary.main }} />
        Update Database: {selectedDatabase?.name}
      </DialogTitle>
      <DialogContent sx={{ p: 3, mt: 1 }}>
        <Grid container spacing={2} sx={{ mt: 0 }}>
          <Grid item xs={12} sm={6}>
            <TextField
              autoFocus
              margin="dense"
              name="name"
              label="Database Display Name"
              type="text"
              fullWidth
              variant="outlined"
              value={databaseInfo.name}
              onChange={handleChange}
              required
              error={error && !databaseInfo.name}
              helperText={error && !databaseInfo.name ? 'Display name is required' : ''}
              sx={{
                '& .MuiOutlinedInput-root': {
                  '& fieldset': {
                    borderColor: alpha(theme.palette.primary.main, 0.3),
                    transition: 'border-color 0.3s'
                  },
                  '&:hover fieldset': {
                    borderColor: alpha(theme.palette.primary.main, 0.6)
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: theme.palette.primary.main,
                    borderWidth: 2,
                    boxShadow: `0 0 8px ${alpha(theme.palette.primary.main, 0.4)}`
                  }
                }
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              margin="dense"
              name="description"
              label="Description (Optional)"
              type="text"
              fullWidth
              variant="outlined"
              value={databaseInfo.description}
              onChange={handleChange}
              sx={{
                '& .MuiOutlinedInput-root': {
                  '& fieldset': {
                    borderColor: alpha(theme.palette.primary.main, 0.3),
                    transition: 'border-color 0.3s'
                  },
                  '&:hover fieldset': {
                    borderColor: alpha(theme.palette.primary.main, 0.6)
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: theme.palette.primary.main,
                    borderWidth: 2,
                    boxShadow: `0 0 8px ${alpha(theme.palette.primary.main, 0.4)}`
                  }
                }
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              margin="dense"
              name="host"
              label="Host"
              type="text"
              fullWidth
              variant="outlined"
              value={databaseInfo.host}
              onChange={handleChange}
              required
              error={error && !databaseInfo.host}
              helperText={error && !databaseInfo.host ? 'Host is required' : ''}
              sx={{
                '& .MuiOutlinedInput-root': {
                  '& fieldset': {
                    borderColor: alpha(theme.palette.primary.main, 0.3),
                    transition: 'border-color 0.3s'
                  },
                  '&:hover fieldset': {
                    borderColor: alpha(theme.palette.primary.main, 0.6)
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: theme.palette.primary.main,
                    borderWidth: 2,
                    boxShadow: `0 0 8px ${alpha(theme.palette.primary.main, 0.4)}`
                  }
                }
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              margin="dense"
              name="port"
              label="Port"
              type="text"
              fullWidth
              variant="outlined"
              value={databaseInfo.port}
              onChange={handleChange}
              required
              error={error && !databaseInfo.port}
              helperText={error && !databaseInfo.port ? 'Port is required' : ''}
              sx={{
                '& .MuiOutlinedInput-root': {
                  '& fieldset': {
                    borderColor: alpha(theme.palette.primary.main, 0.3),
                    transition: 'border-color 0.3s'
                  },
                  '&:hover fieldset': {
                    borderColor: alpha(theme.palette.primary.main, 0.6)
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: theme.palette.primary.main,
                    borderWidth: 2,
                    boxShadow: `0 0 8px ${alpha(theme.palette.primary.main, 0.4)}`
                  }
                }
              }}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              margin="dense"
              name="database_name"
              label="Database Name"
              type="text"
              fullWidth
              variant="outlined"
              value={databaseInfo.database_name}
              onChange={handleChange}
              required
              error={error && !databaseInfo.database_name}
              helperText={error && !databaseInfo.database_name ? 'Database name is required' : ''}
              sx={{
                '& .MuiOutlinedInput-root': {
                  '& fieldset': {
                    borderColor: alpha(theme.palette.primary.main, 0.3),
                    transition: 'border-color 0.3s'
                  },
                  '&:hover fieldset': {
                    borderColor: alpha(theme.palette.primary.main, 0.6)
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: theme.palette.primary.main,
                    borderWidth: 2,
                    boxShadow: `0 0 8px ${alpha(theme.palette.primary.main, 0.4)}`
                  }
                }
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              margin="dense"
              name="username"
              label="Username"
              type="text"
              fullWidth
              variant="outlined"
              value={databaseInfo.username}
              onChange={handleChange}
              required
              error={error && !databaseInfo.username}
              helperText={error && !databaseInfo.username ? 'Username is required' : ''}
              sx={{
                '& .MuiOutlinedInput-root': {
                  '& fieldset': {
                    borderColor: alpha(theme.palette.primary.main, 0.3),
                    transition: 'border-color 0.3s'
                  },
                  '&:hover fieldset': {
                    borderColor: alpha(theme.palette.primary.main, 0.6)
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: theme.palette.primary.main,
                    borderWidth: 2,
                    boxShadow: `0 0 8px ${alpha(theme.palette.primary.main, 0.4)}`
                  }
                }
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              margin="dense"
              name="password"
              label="Password (leave empty to keep current)"
              type="password"
              fullWidth
              variant="outlined"
              value={databaseInfo.password}
              onChange={handleChange}
              sx={{
                '& .MuiOutlinedInput-root': {
                  '& fieldset': {
                    borderColor: alpha(theme.palette.primary.main, 0.3),
                    transition: 'border-color 0.3s'
                  },
                  '&:hover fieldset': {
                    borderColor: alpha(theme.palette.primary.main, 0.6)
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: theme.palette.primary.main,
                    borderWidth: 2,
                    boxShadow: `0 0 8px ${alpha(theme.palette.primary.main, 0.4)}`
                  }
                }
              }}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3, pt: 2, justifyContent: 'space-between' }}>
        <Button 
          onClick={onClose}
          color="inherit"
          sx={{
            borderRadius: 2,
            px: 3,
            py: 1,
            color: alpha(theme.palette.text.primary, 0.8),
            '&:hover': {
              backgroundColor: alpha(theme.palette.background.paper, 0.1),
            }
          }}
        >
          Cancel
        </Button>
        <Button 
          onClick={handleSubmit}
          variant="contained"
          disabled={loading}
          sx={{
            borderRadius: 2,
            px: 4,
            py: 1,
            background: 'linear-gradient(45deg, #7C4DFF, #03DAC6)',
            boxShadow: '0 4px 12px rgba(124, 77, 255, 0.4)',
            '&:hover': {
              boxShadow: '0 6px 18px rgba(124, 77, 255, 0.6)',
            }
          }}
        >
          {loading ? <CircularProgress size={24} /> : 'Update Database'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default UpdateDatabaseDialog;
