import { useState, useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  Container,
  Paper,
  Typography,
  Box,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Alert,
} from '@mui/material';
import api from '../api';
import Layout from '../components/Layout';

const NODE_WIDTH = 200;
const GRID_COLUMNS = 4;
const H_SPACING = 260;
const V_SPACING = 120;

// Simple dependency-free grid layout — no auto-layout library needed. Not as
// visually optimal as a layered graph layout, but keeps this page's only
// dependencies to what's already installed (reactflow, already present).
function layoutGrid(nodes) {
  return nodes.map((node, index) => ({
    ...node,
    position: {
      x: (index % GRID_COLUMNS) * H_SPACING,
      y: Math.floor(index / GRID_COLUMNS) * V_SPACING,
    },
  }));
}

function SemanticGraphFlow({ databaseId }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modelVersion, setModelVersion] = useState(null);

  useEffect(() => {
    if (!databaseId) return;
    setLoading(true);
    api.getSemanticGraph(databaseId)
      .then((res) => {
        const { nodes: rawNodes, edges: rawEdges, model_version } = res.data;
        setModelVersion(model_version);

        const flowNodes = (rawNodes || []).map((n) => ({
          id: n.id,
          data: { label: `${n.label} (${n.type})` },
          position: { x: 0, y: 0 },
          style: {
            background: n.type === 'table' ? '#7C4DFF' : '#03DAC6',
            color: '#fff',
            borderRadius: 8,
            fontSize: 12,
            padding: 8,
            width: NODE_WIDTH,
          },
        }));

        const flowEdges = (rawEdges || []).map((e, i) => ({
          id: `e${i}`,
          source: e.source,
          target: e.target,
          label: e.similarity.toFixed(2),
          animated: true,
          style: { stroke: '#7C4DFF', strokeWidth: 1.5 },
          markerEnd: { type: MarkerType.ArrowClosed },
        }));

        setNodes(layoutGrid(flowNodes));
        setEdges(flowEdges);
        setError('');
      })
      .catch((err) => setError(err.response?.data?.error || err.response?.data?.detail || 'Failed to load semantic graph.'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [databaseId]);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;
  if (error) return <Alert severity="info">{error}</Alert>;
  if (nodes.length === 0) return <Alert severity="info">No semantic relationships computed yet for this database.</Alert>;

  return (
    <Box sx={{ height: 600, border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
      {modelVersion && (
        <Typography variant="caption" sx={{ position: 'absolute', zIndex: 5, m: 1 }} color="text.secondary">
          Model: {modelVersion}
        </Typography>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </Box>
  );
}

function SemanticGraph() {
  const [databases, setDatabases] = useState([]);
  const [selectedDb, setSelectedDb] = useState('');

  useEffect(() => {
    api.getDatabases().then((res) => {
      setDatabases(res.data);
      if (res.data.length > 0) setSelectedDb(res.data[0].id);
    }).catch(() => setDatabases([]));
  }, []);

  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography variant="h4" sx={{ mb: 3 }}>Semantic Graph</Typography>
        <Paper sx={{ p: 3 }}>
          <FormControl size="small" sx={{ minWidth: 240, mb: 3 }}>
            <InputLabel>Database</InputLabel>
            <Select value={selectedDb} label="Database" onChange={(e) => setSelectedDb(e.target.value)}>
              {databases.map((db) => (
                <MenuItem key={db.id} value={db.id}>{db.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          {selectedDb && <SemanticGraphFlow databaseId={selectedDb} />}
        </Paper>
      </Container>
    </Layout>
  );
}

export default SemanticGraph;
