import { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Paper,
  Box,
  TextField,
  Button,
  Avatar,
  CircularProgress,
  Alert,
  Snackbar,
  IconButton,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stepper,
  Step,
  StepLabel
} from '@mui/material';
import { jwtDecode } from 'jwt-decode';
import { ACCESS_TOKEN, REFRESH_TOKEN } from '../constants';
import api from '../api';
import Layout from '../components/Layout';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';

function UserProfile() {
  const navigate = useNavigate();
  const [user, setUser] = useState({
    username: '',
    email: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  
  // Password change states
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordChangeStep, setPasswordChangeStep] = useState(0);
  const [passwordChangeLoading, setPasswordChangeLoading] = useState(false);
  const [passwordChangeError, setPasswordChangeError] = useState(null);
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState(false);
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        setLoading(true);
        
        // Try to get basic info from JWT token
        const token = localStorage.getItem(ACCESS_TOKEN);
        if (token) {
          try {
            const decoded = jwtDecode(token);
            setUser(prev => ({
              ...prev,
              username: decoded.username || '',
            }));
          } catch (error) {
            console.error('Error decoding token:', error);
          }
        }
        
        // Get detailed user info from API
        const response = await api.get('/api/user/me/');
        setUser({
          username: response.data.username,
          email: response.data.email || '',
        });
        
      } catch (error) {
        console.error('Error fetching user profile:', error);
        setError('Failed to load user profile. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchUserProfile();
  }, []);
  
  const handleChange = (e) => {
    setUser({
      ...user,
      [e.target.name]: e.target.value,
    });
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    
    try {
      await api.patch('/api/user/me/', {
        email: user.email,
      });
      setSuccess(true);
    } catch (error) {
      console.error('Error updating profile:', error);
      setError(error.response?.data?.detail || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };
  
  // Password change handlers
  const handleOpenPasswordDialog = () => {
    setPasswordDialogOpen(true);
    setPasswordChangeStep(0);
    setPasswordChangeError(null);
    setOtp('');
    setNewPassword('');
    setConfirmPassword('');
  };
  
  const handleClosePasswordDialog = () => {
    setPasswordDialogOpen(false);
    setPasswordChangeError(null);
  };
  
  const handleRequestOtp = async () => {
    setPasswordChangeLoading(true);
    setPasswordChangeError(null);
    
    try {
      await api.post('/api/user/request-password-change/');
      setPasswordChangeStep(1);
    } catch (error) {
      console.error('Error requesting OTP:', error);
      setPasswordChangeError(error.response?.data?.detail || 'Failed to send verification code');
    } finally {
      setPasswordChangeLoading(false);
    }
  };
  
  const handleVerifyOtp = async () => {
    if (!otp) {
      setPasswordChangeError('Please enter the verification code');
      return;
    }
    
    setPasswordChangeLoading(true);
    setPasswordChangeError(null);
    
    try {
      await api.post('/api/user/verify-otp/', { otp });
      setPasswordChangeStep(2);
    } catch (error) {
      console.error('Error verifying OTP:', error);
      setPasswordChangeError(error.response?.data?.detail || 'Failed to verify code');
    } finally {
      setPasswordChangeLoading(false);
    }
  };
  
  const handleSetNewPassword = async () => {
    // Validate passwords
    if (!newPassword) {
      setPasswordChangeError('Please enter a new password');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setPasswordChangeError('Passwords do not match');
      return;
    }
    
    setPasswordChangeLoading(true);
    setPasswordChangeError(null);
    
    try {
      const response = await api.post('/api/user/set-new-password/', { new_password: newPassword });
      
      // Update tokens if provided
      if (response.data.access) {
        localStorage.setItem(ACCESS_TOKEN, response.data.access);
      }
      if (response.data.refresh) {
        localStorage.setItem(REFRESH_TOKEN, response.data.refresh);
      }
      
      setPasswordChangeSuccess(true);
      setTimeout(() => {
        setPasswordDialogOpen(false);
        setPasswordChangeSuccess(false);
      }, 2000);
    } catch (error) {
      console.error('Error setting new password:', error);
      setPasswordChangeError(error.response?.data?.detail || 'Failed to change password');
    } finally {
      setPasswordChangeLoading(false);
    }
  };
  
  if (loading) {
    return (
      <>
        <Navbar />
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
          <CircularProgress />
        </Box>
      </>
    );
  }
  
  return (
    <>
      <Navbar />
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Box display="flex" alignItems="center" mb={3}>
          <IconButton 
            onClick={() => navigate('/databases')} 
            color="primary" 
            aria-label="back to databases" 
            sx={{ mr: 2 }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" component="h1" gutterBottom>
            User Profile
          </Typography>
        </Box>
        
        <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
            <Avatar 
              sx={{ 
                width: 80, 
                height: 80, 
                mr: 3, 
                fontSize: '2rem',
                bgcolor: 'primary.main' 
              }}
            >
              {user.username ? user.username.charAt(0).toUpperCase() : 'U'}
            </Avatar>
            <Box>
              <Typography variant="h5" component="h2" gutterBottom>
                Account Settings
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Manage your account information
              </Typography>
            </Box>
          </Box>
          
          {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
          
          <form onSubmit={handleSubmit}>
            <TextField
              margin="normal"
              fullWidth
              label="Username"
              name="username"
              value={user.username}
              disabled
              variant="outlined"
              sx={{ mb: 3 }}
              helperText="Username cannot be changed"
            />
            
            <TextField
              margin="normal"
              fullWidth
              label="Email Address"
              name="email"
              value={user.email}
              onChange={handleChange}
              variant="outlined"
              sx={{ mb: 3 }}
            />
            
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={saving}
              sx={{ mt: 2, py: 1.5, mr: 2 }}
            >
              {saving ? <CircularProgress size={24} /> : 'Save Changes'}
            </Button>
            
            <Button
              variant="outlined"
              size="large"
              sx={{ mt: 2, py: 1.5 }}
              onClick={handleOpenPasswordDialog}
            >
              Change Password
            </Button>
          </form>
        </Paper>
      </Container>
      
      {/* Password Change Dialog */}
      <Dialog 
        open={passwordDialogOpen} 
        onClose={handleClosePasswordDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Change Password</DialogTitle>
        <DialogContent>
          {passwordChangeSuccess ? (
            <Alert severity="success" sx={{ mt: 2 }}>
              Password changed successfully!
            </Alert>
          ) : (
            <>
              <Stepper activeStep={passwordChangeStep} sx={{ my: 3 }}>
                <Step>
                  <StepLabel>Request Verification</StepLabel>
                </Step>
                <Step>
                  <StepLabel>Verify Code</StepLabel>
                </Step>
                <Step>
                  <StepLabel>Set New Password</StepLabel>
                </Step>
              </Stepper>
              
              {passwordChangeError && (
                <Alert severity="error" sx={{ mb: 3 }}>
                  {passwordChangeError}
                </Alert>
              )}
              
              {passwordChangeStep === 0 && (
                <DialogContentText>
                  To change your password, we'll send a verification code to your email address: <strong>{user.email}</strong>
                </DialogContentText>
              )}
              
              {passwordChangeStep === 1 && (
                <>
                  <DialogContentText sx={{ mb: 2 }}>
                    Please enter the verification code sent to your email address.
                  </DialogContentText>
                  <TextField
                    autoFocus
                    margin="dense"
                    label="Verification Code"
                    fullWidth
                    variant="outlined"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="Enter 6-digit code"
                  />
                </>
              )}
              
              {passwordChangeStep === 2 && (
                <>
                  <DialogContentText sx={{ mb: 2 }}>
                    Enter and confirm your new password.
                  </DialogContentText>
                  <TextField
                    margin="dense"
                    label="New Password"
                    type="password"
                    fullWidth
                    variant="outlined"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    sx={{ mb: 2 }}
                  />
                  <TextField
                    margin="dense"
                    label="Confirm New Password"
                    type="password"
                    fullWidth
                    variant="outlined"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </>
              )}
            </>
          )}
        </DialogContent>
        
        <DialogActions sx={{ px: 3, pb: 3 }}>
          {!passwordChangeSuccess && (
            <>
              <Button onClick={handleClosePasswordDialog} color="primary">
                Cancel
              </Button>
              
              {passwordChangeStep === 0 && (
                <Button 
                  onClick={handleRequestOtp} 
                  variant="contained" 
                  color="primary"
                  disabled={passwordChangeLoading}
                >
                  {passwordChangeLoading ? <CircularProgress size={24} /> : 'Request Verification Code'}
                </Button>
              )}
              
              {passwordChangeStep === 1 && (
                <Button 
                  onClick={handleVerifyOtp} 
                  variant="contained" 
                  color="primary"
                  disabled={passwordChangeLoading}
                >
                  {passwordChangeLoading ? <CircularProgress size={24} /> : 'Verify Code'}
                </Button>
              )}
              
              {passwordChangeStep === 2 && (
                <Button 
                  onClick={handleSetNewPassword} 
                  variant="contained" 
                  color="primary"
                  disabled={passwordChangeLoading}
                >
                  {passwordChangeLoading ? <CircularProgress size={24} /> : 'Change Password'}
                </Button>
              )}
            </>
          )}
        </DialogActions>
      </Dialog>
      
      <Snackbar 
        open={success} 
        autoHideDuration={6000} 
        onClose={() => setSuccess(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSuccess(false)} 
          severity="success" 
          variant="filled"
        >
          Profile updated successfully
        </Alert>
      </Snackbar>
    </>
  );
}

export default UserProfile;