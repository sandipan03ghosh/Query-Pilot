import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Alert,
  CircularProgress,
  alpha,
  useTheme,
  Zoom
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';

const DeleteDatabaseDialog = ({
  open,
  onClose,
  databaseToDelete,
  handleDeleteDatabase,
  loading
}) => {
  const theme = useTheme();

  return (
    <Dialog
      open={open}
      onClose={() => {
        onClose();
      }}
      fullWidth
      maxWidth="sm"
      TransitionComponent={Zoom}
      TransitionProps={{ timeout: 400 }}
      PaperProps={{
        sx: {
          borderRadius: 4,
          background: 'linear-gradient(135deg, rgba(34, 35, 48, 0.97) 0%, rgba(25, 26, 45, 0.98) 100%)',
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
            background: 'linear-gradient(90deg, #FF5252, #FF1744)',
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
        gap: 1
      }}>
        <DeleteIcon color="error" /> Delete Database
      </DialogTitle>
      <DialogContent sx={{ p: 3 }}>
        <Alert 
          severity="warning" 
          variant="filled" 
          sx={{ 
            mb: 3,
            borderRadius: 2
          }}
        >
          This action cannot be undone
        </Alert>
        <Typography variant="body1" sx={{ color: alpha(theme.palette.text.primary, 0.9) }}>
          Are you sure you want to delete the database <strong>"{databaseToDelete?.name}"</strong>?
        </Typography>
        <Typography variant="body2" sx={{ mt: 2, color: alpha(theme.palette.text.secondary, 0.8) }}>
          This will permanently delete the database connection from the system. All sessions and queries associated with this database will also be removed. This action cannot be reversed.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3, pt: 1, justifyContent: 'space-between' }}>
        <Button 
          onClick={() => {
            onClose();
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
          onClick={handleDeleteDatabase} 
          variant="contained"
          color="error"
          disabled={loading}
          sx={{
            borderRadius: 2,
            px: 4,
            py: 1,
            background: 'linear-gradient(45deg, #FF5252, #FF1744)',
            boxShadow: '0 4px 12px rgba(255, 82, 82, 0.4)',
            '&:hover': {
              boxShadow: '0 6px 18px rgba(255, 82, 82, 0.6)',
              background: 'linear-gradient(45deg, #FF1744, #FF5252)',
            }
          }}
        >
          {loading ? <CircularProgress size={24} /> : 'Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DeleteDatabaseDialog;
