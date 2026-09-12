import React from 'react';
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
import StorageIcon from '@mui/icons-material/Storage';

const AddDatabaseDialog = ({
  open,
  onClose,
  loading,
  newDatabaseInfo,
  handleAddDatabaseChange,
  handleAddDatabaseSubmit,
  resetNewDatabaseForm,
  error
}) => {
  const theme = useTheme();

  return (
    <Dialog 
      open={open} 
      onClose={() => {
        onClose();
        resetNewDatabaseForm();
      }}
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
        <StorageIcon sx={{ color: theme.palette.primary.main }} />
        Add New PostgreSQL Database
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
              value={newDatabaseInfo.name}
              onChange={handleAddDatabaseChange}
              required
              error={error && !newDatabaseInfo.name}
              helperText={error && !newDatabaseInfo.name ? 'Display name is required' : ''}
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
              value={newDatabaseInfo.description}
              onChange={handleAddDatabaseChange}
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
              value={newDatabaseInfo.host}
              onChange={handleAddDatabaseChange}
              required
              error={error && !newDatabaseInfo.host}
              helperText={error && !newDatabaseInfo.host ? 'Host is required' : ''}
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
              value={newDatabaseInfo.port}
              onChange={handleAddDatabaseChange}
              required
              error={error && !newDatabaseInfo.port}
              helperText={error && !newDatabaseInfo.port ? 'Port is required' : ''}
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
              value={newDatabaseInfo.database_name}
              onChange={handleAddDatabaseChange}
              required
              error={error && !newDatabaseInfo.database_name}
              helperText={error && !newDatabaseInfo.database_name ? 'Database name is required' : ''}
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
              value={newDatabaseInfo.username}
              onChange={handleAddDatabaseChange}
              required
              error={error && !newDatabaseInfo.username}
              helperText={error && !newDatabaseInfo.username ? 'Username is required' : ''}
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
              label="Password"
              type="password"
              fullWidth
              variant="outlined"
              value={newDatabaseInfo.password}
              onChange={handleAddDatabaseChange}
              required
              error={error && !newDatabaseInfo.password}
              helperText={error && !newDatabaseInfo.password ? 'Password is required' : ''}
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
          onClick={() => {
            onClose();
            resetNewDatabaseForm();
          }} 
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
          onClick={handleAddDatabaseSubmit} 
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
          {loading ? <CircularProgress size={24} /> : 'Add Database'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddDatabaseDialog;
