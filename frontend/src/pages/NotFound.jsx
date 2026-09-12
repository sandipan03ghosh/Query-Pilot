import { Box, Typography, Button, Container, Paper } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import LogoutIcon from '@mui/icons-material/Logout';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';

function NotFound() {
    const navigate = useNavigate();
    
    return (
        <Layout>
            <Container maxWidth="md" sx={{ mt: 8 }}>
                <Paper 
                    elevation={3} 
                    sx={{ 
                        p: 6, 
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: 'center',
                        bgcolor: 'background.paper',
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: 'divider'
                    }}
                >
                    <Box sx={{ display: 'flex', width: '100%', justifyContent: 'flex-end', mb: 2 }}>
                        <Button
                            variant="outlined"
                            startIcon={<LogoutIcon />}
                            onClick={() => navigate('/logout')}
                            size="small"
                        >
                            Sign Out
                        </Button>
                    </Box>
                    
                    <ErrorOutlineIcon sx={{ fontSize: 80, color: 'error.main' }} />
                    <Typography variant="h3" sx={{ mt: 3, mb: 2, textAlign: 'center', color: 'text.primary' }}>
                        404 Not Found
                    </Typography>
                    <Typography variant="body1" sx={{ mb: 4, textAlign: 'center', color: 'text.secondary' }}>
                        The page you're looking for doesn't exist!
                    </Typography>
                    <Button 
                        variant="contained" 
                        color="primary" 
                        onClick={() => navigate('/')}
                        size="large"
                    >
                        Back to Home
                    </Button>
                </Paper>
            </Container>
        </Layout>
    );
}

export default NotFound;