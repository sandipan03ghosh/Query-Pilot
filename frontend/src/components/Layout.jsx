import React from 'react';
import { 
    Box,
    Container, 
    Typography 
} from '@mui/material';
import Navbar from './Navbar';

const Layout = ({ children }) => {
    return (
        <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            minHeight: '100vh', 
            bgcolor: 'background.default',
            color: 'text.primary'
        }}>
            <Navbar />
            
            <Container component="main" sx={{ flexGrow: 1, py: 3 }}>
                {children}
            </Container>
            
            <Box component="footer" sx={{ 
                py: 2, 
                mt: 'auto', 
                backgroundColor: 'background.paper', 
                borderTop: '1px solid', 
                borderColor: 'divider' 
            }}>
                <Container maxWidth="lg">
                    <Typography variant="body2" color="text.secondary" align="center">
                        © {new Date().getFullYear()} LLM Query System
                    </Typography>
                </Container>
            </Box>
        </Box>
    );
};

export default Layout;
