import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Grid,
  alpha,
  useTheme,
  Zoom
} from '@mui/material';
import StorageIcon from '@mui/icons-material/Storage';
import EditIcon from '@mui/icons-material/Edit';
import QueryStatsIcon from '@mui/icons-material/QueryStats';

const DatabaseOptionsDialog = ({
  open,
  onClose,
  selectedDatabase,
  handleUpdateMetadata,
  handleQueryDatabase
}) => {
  const theme = useTheme();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      TransitionComponent={Zoom}
      TransitionProps={{ timeout: 400 }}
      PaperProps={{
        sx: {
          borderRadius: 4,
          background: 'linear-gradient(135deg, rgba(26, 35, 50, 0.97) 0%, rgba(18, 26, 41, 0.98) 100%)',
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
        {selectedDatabase?.name || 'Database Options'}
      </DialogTitle>
      <DialogContent sx={{ p: 3 }}>
        <Typography variant="body1" sx={{ mb: 3, color: alpha(theme.palette.text.primary, 0.8) }}>
          What would you like to do with this database?
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={handleUpdateMetadata}
              sx={{ 
                py: 2, 
                justifyContent: 'flex-start',
                borderRadius: 3,
                borderWidth: 2,
                borderColor: alpha('#7C4DFF', 0.5),
                color: alpha('#7C4DFF', 0.9),
                backdropFilter: 'blur(5px)',
                '&:hover': {
                  borderWidth: 2,
                  borderColor: '#7C4DFF',
                  background: alpha('#7C4DFF', 0.05),
                  boxShadow: `0 0 20px ${alpha('#7C4DFF', 0.2)}`,
                  transform: 'translateY(-2px)',
                },
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            >
              Update Database Metadata
            </Button>
          </Grid>
          <Grid item xs={12}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<QueryStatsIcon />}
              onClick={handleQueryDatabase}
              sx={{ 
                py: 2, 
                justifyContent: 'flex-start',
                borderRadius: 3,
                borderWidth: 2,
                borderColor: alpha('#03DAC6', 0.5),
                color: alpha('#03DAC6', 0.9),
                backdropFilter: 'blur(5px)',
                '&:hover': {
                  borderWidth: 2,
                  borderColor: '#03DAC6',
                  background: alpha('#03DAC6', 0.05),
                  boxShadow: `0 0 20px ${alpha('#03DAC6', 0.2)}`,
                  transform: 'translateY(-2px)',
                },
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            >
              Query Database
            </Button>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
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
      </DialogActions>
    </Dialog>
  );
};

export default DatabaseOptionsDialog;
