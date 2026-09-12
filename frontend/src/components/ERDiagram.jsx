import React, { useEffect, useState, useCallback } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  MarkerType,
  Position,
  Handle
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Button,
  Tooltip,
  IconButton
} from '@mui/material';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import FitScreenIcon from '@mui/icons-material/FitScreen';
import RefreshIcon from '@mui/icons-material/Refresh';
import api from '../api';
import ErrorBoundary from './ErrorBoundary';

// Custom node for tables in the ER diagram
const TableNode = ({ data }) => {
  return (
    <Paper 
      elevation={3} 
      sx={{
        padding: 1,
        borderRadius: 1,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: 'linear-gradient(180deg, rgba(124, 77, 255, 0.05) 0%, rgba(31, 39, 54, 0.9) 25%)'
      }}
    >
      {/* Add connection handles to all sides of the node */}
      <Handle type="source" position={Position.Top} id="top" style={{ background: '#7C4DFF' }} />
      <Handle type="source" position={Position.Right} id="right" style={{ background: '#7C4DFF' }} />
      <Handle type="source" position={Position.Bottom} id="bottom" style={{ background: '#7C4DFF' }} />
      <Handle type="source" position={Position.Left} id="left" style={{ background: '#7C4DFF' }} />
      
      <Handle type="target" position={Position.Top} id="top-target" style={{ background: '#03DAC6', top: 10, left: '50%' }} />
      <Handle type="target" position={Position.Right} id="right-target" style={{ background: '#03DAC6', right: 10, top: '50%' }} />
      <Handle type="target" position={Position.Bottom} id="bottom-target" style={{ background: '#03DAC6', bottom: 10, left: '50%' }} />
      <Handle type="target" position={Position.Left} id="left-target" style={{ background: '#03DAC6', left: 10, top: '50%' }} />
      
      <Typography variant="subtitle1" fontWeight="bold" sx={{ 
        borderBottom: '1px solid rgba(255,255,255,0.1)', 
        pb: 0.5, 
        mb: 0.5,
        color: 'primary.main' 
      }}>
        {data.label}
      </Typography>
      
      <Box sx={{ overflow: 'auto', maxHeight: '250px' }}>
        {data.columns && data.columns.map((column, index) => (
          <Box 
            key={index} 
            sx={{ 
              display: 'flex', 
              alignItems: 'center',
              mb: 0.5,
              px: 0.5,
              borderRadius: 0.5,
              backgroundColor: column.is_primary_key ? 'rgba(124, 77, 255, 0.1)' : 
                              column.is_foreign_key ? 'rgba(3, 218, 198, 0.1)' : 
                              'transparent',
            }}
          >
            {column.is_primary_key && (
              <Tooltip title="Primary Key">
                <Box 
                  component="span" 
                  sx={{ 
                    color: 'primary.main', 
                    marginRight: 0.5, 
                    fontSize: '0.7rem',
                    fontWeight: 'bold'
                  }}
                >
                  PK
                </Box>
              </Tooltip>
            )}
            
            {column.is_foreign_key && (
              <Tooltip title="Foreign Key">
                <Box 
                  component="span" 
                  sx={{ 
                    color: 'secondary.main', 
                    marginRight: 0.5, 
                    fontSize: '0.7rem',
                    fontWeight: 'bold'
                  }}
                >
                  FK
                </Box>
              </Tooltip>
            )}
            
            <Typography 
              variant="body2" 
              sx={{ 
                fontSize: '0.85rem',
                fontWeight: column.is_primary_key || column.is_foreign_key ? 'medium' : 'normal',
              }}
            >
              {column.name}
            </Typography>
            
            <Typography 
              variant="caption" 
              sx={{ 
                ml: 0.5, 
                color: 'text.secondary', 
                fontSize: '0.7rem'
              }}
            >
              ({column.type})
            </Typography>
          </Box>
        ))}
      </Box>
    </Paper>
  );
};

// Define node types
const nodeTypes = {
  tableNode: TableNode,
};

// Inner component that uses the react-flow hooks
const ERDiagramFlow = ({ databaseId, onRefreshClick = null }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // We'll use direct access to ReactFlow's instance instead of useReactFlow hook
  const reactFlowInstance = React.useRef(null);

  const fetchERDiagram = useCallback(async () => {
    if (!databaseId) return;

    setLoading(true);
    setError(null);
    try {
      const response = await api.getERDiagram(databaseId);
      // console.log('ER Diagram response:', response.data);
      
      // Check if response.data has nodes and edges directly or nested in diagram_data
      let diagramData = response.data;
      
      // If the data is directly in the response (not nested in diagram_data)
      if (response.data.nodes && response.data.edges) {
        const { nodes: diagramNodes, edges: diagramEdges } = response.data;
        
        // Process nodes to ensure they have the right format for ReactFlow
        const processedNodes = diagramNodes.map(node => ({
          ...node,
          // Ensure position is properly formatted
          position: {
            x: node.position?.x || 0,
            y: node.position?.y || 0
          },
          // Additional styling
          style: {
            ...node.style,
            width: node.width || 220,
            height: node.height || 200
          }
        }));
        
        // Process edges to ensure they have the right format for ReactFlow - fix the handle ID issue
        const processedEdges = diagramEdges.map((edge, index) => {
          // Determine which handles to use based on relative positions
          const sourceNode = processedNodes.find(n => n.id === edge.source);
          const targetNode = processedNodes.find(n => n.id === edge.target);
          
          let sourceHandleId = 'right';
          let targetHandleId = 'left-target';
          
          if (sourceNode && targetNode) {
            const sourceX = sourceNode.position.x;
            const sourceY = sourceNode.position.y;
            const targetX = targetNode.position.x;
            const targetY = targetNode.position.y;
            
            // Calculate angle between nodes to determine the best handles
            const angle = Math.atan2(targetY - sourceY, targetX - sourceX) * (180 / Math.PI);
            
            // Select appropriate handles based on angle
            if (angle > -45 && angle <= 45) {
              // Target is to the right
              sourceHandleId = 'right';
              targetHandleId = 'left-target';
            } else if (angle > 45 && angle <= 135) {
              // Target is below
              sourceHandleId = 'bottom';
              targetHandleId = 'top-target';
            } else if ((angle > 135 && angle <= 180) || (angle >= -180 && angle <= -135)) {
              // Target is to the left
              sourceHandleId = 'left';
              targetHandleId = 'right-target';
            } else {
              // Target is above
              sourceHandleId = 'top';
              targetHandleId = 'bottom-target';
            }
          }
          
          return {
            id: edge.id || `edge-${edge.source}-${edge.target}-${index}`,
            source: edge.source,
            target: edge.target,
            // Use dynamically assigned handles
            sourceHandle: sourceHandleId,
            targetHandle: targetHandleId,
            label: edge.label || edge.data?.label || '',
            type: 'default',
            animated: true,
            style: { 
              stroke: '#7C4DFF', 
              strokeWidth: 2 
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 20,
              height: 20,
              color: '#7C4DFF',
            },
            zIndex: 5,
            labelStyle: { fill: '#f8f8f8', fontWeight: 500 },
            labelBgStyle: { fill: 'rgba(124, 77, 255, 0.4)' }
          };
        });
        
        setNodes(processedNodes);
        setEdges(processedEdges);
        
        // Fit the view to show all nodes
        setTimeout(() => {
          if (reactFlowInstance.current) {
            reactFlowInstance.current.fitView({ padding: 0.5 });
          }
        }, 50);
      }
      // If the data is nested in diagram_data
      else if (response.data?.diagram_data?.nodes && response.data?.diagram_data?.edges) {
        const { nodes: diagramNodes, edges: diagramEdges } = response.data.diagram_data;
        
        // Process nodes to ensure they have the right format for ReactFlow
        const processedNodes = diagramNodes.map(node => ({
          ...node,
          // Ensure position is properly formatted
          position: {
            x: node.position?.x || 0,
            y: node.position?.y || 0
          },
          // Additional styling
          style: {
            ...node.style,
            width: node.width || 220,
            height: node.height || 200
          }
        }));
        
        // Process edges to ensure they have the right format for ReactFlow - fix the handle ID issue
        const processedEdges = diagramEdges.map((edge, index) => {
          // Determine which handles to use based on relative positions
          const sourceNode = processedNodes.find(n => n.id === edge.source);
          const targetNode = processedNodes.find(n => n.id === edge.target);
          
          let sourceHandleId = 'right';
          let targetHandleId = 'left-target';
          
          if (sourceNode && targetNode) {
            const sourceX = sourceNode.position.x;
            const sourceY = sourceNode.position.y;
            const targetX = targetNode.position.x;
            const targetY = targetNode.position.y;
            
            // Calculate angle between nodes to determine the best handles
            const angle = Math.atan2(targetY - sourceY, targetX - sourceX) * (180 / Math.PI);
            
            // Select appropriate handles based on angle
            if (angle > -45 && angle <= 45) {
              // Target is to the right
              sourceHandleId = 'right';
              targetHandleId = 'left-target';
            } else if (angle > 45 && angle <= 135) {
              // Target is below
              sourceHandleId = 'bottom';
              targetHandleId = 'top-target';
            } else if ((angle > 135 && angle <= 180) || (angle >= -180 && angle <= -135)) {
              // Target is to the left
              sourceHandleId = 'left';
              targetHandleId = 'right-target';
            } else {
              // Target is above
              sourceHandleId = 'top';
              targetHandleId = 'bottom-target';
            }
          }
          
          return {
            id: edge.id || `edge-${edge.source}-${edge.target}-${index}`,
            source: edge.source,
            target: edge.target,
            // Use dynamically assigned handles
            sourceHandle: sourceHandleId,
            targetHandle: targetHandleId,
            label: edge.label || edge.data?.label || '',
            type: 'default',
            animated: true,
            style: { 
              stroke: '#7C4DFF', 
              strokeWidth: 2 
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 20,
              height: 20,
              color: '#7C4DFF',
            },
            zIndex: 5,
            labelStyle: { fill: '#f8f8f8', fontWeight: 500 },
            labelBgStyle: { fill: 'rgba(124, 77, 255, 0.4)' }
          };
        });
        
        setNodes(processedNodes);
        setEdges(processedEdges);
        
        // Fit the view to show all nodes
        setTimeout(() => {
          if (reactFlowInstance.current) {
            reactFlowInstance.current.fitView({ padding: 0.5 });
          }
        }, 50);
      }
      else {
        setError('Invalid ER diagram data format received from server');
        console.error('Invalid ER diagram data:', response.data);
      }
    } catch (err) {
      setError(`Failed to load ER diagram: ${err.message}`);
      console.error('Error fetching ER diagram:', err);
    } finally {
      setLoading(false);
    }
  }, [databaseId, setNodes, setEdges]);

  // Load ER diagram when the component mounts or when databaseId changes
  useEffect(() => {
    fetchERDiagram();
  }, [databaseId, fetchERDiagram]);

  const handleRefresh = () => {
    fetchERDiagram();
    if (onRefreshClick) onRefreshClick();
  };

  const handleZoomIn = () => {
    if (reactFlowInstance.current) {
      reactFlowInstance.current.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (reactFlowInstance.current) {
      reactFlowInstance.current.zoomOut();
    }
  };

  const handleFitView = () => {
    if (reactFlowInstance.current) {
      reactFlowInstance.current.fitView({ padding: 0.5 });
    }
  };

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      onInit={(instance) => {
        reactFlowInstance.current = instance;
      }}
      fitView
      attributionPosition="bottom-right"
      defaultEdgeOptions={{
        type: 'default',
        animated: true,
        style: { stroke: '#7C4DFF', strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#7C4DFF',
        }
      }}
      connectionLineStyle={{ stroke: '#7C4DFF' }}
      deleteKeyCode={null} // Prevent accidental deletion of edges/nodes
      fitViewOptions={{ padding: 0.5 }}
    >
      <Background />
      <Controls />
      <MiniMap 
        style={{ 
          backgroundColor: 'rgba(31, 39, 54, 0.8)',
          maskColor: 'rgba(124, 77, 255, 0.2)'
        }} 
      />
      <Panel position="top-right">
        <Box sx={{ 
          display: 'flex', 
          gap: 1, 
          backgroundColor: 'rgba(31, 39, 54, 0.8)', 
          borderRadius: 1,
          p: 0.5
        }}>
          <Tooltip title="Zoom In">
            <IconButton size="small" onClick={handleZoomIn}>
              <ZoomInIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Zoom Out">
            <IconButton size="small" onClick={handleZoomOut}>
              <ZoomOutIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Fit View">
            <IconButton size="small" onClick={handleFitView}>
              <FitScreenIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Refresh">
            <IconButton size="small" onClick={handleRefresh}>
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Panel>
    </ReactFlow>
  );
};

// Wrapper component that provides the ReactFlow context and error boundary
const ERDiagram = (props) => {
  const [refreshKey, setRefreshKey] = useState(0);
  
  const handleReset = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <Box sx={{ 
      width: '100%', 
      height: 600, 
      position: 'relative',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 1,
      overflow: 'hidden'
    }}>
      {props.databaseId ? (
        <ErrorBoundary onReset={handleReset}>
          <ReactFlowProvider key={refreshKey}>
            {props.loading ? (
              <Box sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100%',
                flexDirection: 'column',
                gap: 2
              }}>
                <CircularProgress />
                <Typography variant="body2" color="text.secondary">
                  Loading ER diagram...
                </Typography>
              </Box>
            ) : props.error ? (
              <Box sx={{ p: 2 }}>
                <Alert severity="error" sx={{ mb: 2 }}>
                  {props.error}
                </Alert>
                <Button 
                  variant="outlined" 
                  startIcon={<RefreshIcon />}
                  onClick={handleReset}
                >
                  Try Again
                </Button>
              </Box>
            ) : (
              <ERDiagramFlow {...props} />
            )}
          </ReactFlowProvider>
        </ErrorBoundary>
      ) : (
        <Box sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
          flexDirection: 'column',
          gap: 2
        }}>
          <Alert severity="info" sx={{ width: '80%' }}>
            Please select a database to view its ER diagram.
          </Alert>
        </Box>
      )}
    </Box>
  );
};

export default ERDiagram;