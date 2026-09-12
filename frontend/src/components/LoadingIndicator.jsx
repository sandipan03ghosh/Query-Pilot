import { CircularProgress, Box } from '@mui/material';

const LoadingIndicator = () => {
    return (
        <Box className="flex justify-center my-4">
            <CircularProgress />
        </Box>
    );
};

export default LoadingIndicator;