import { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Tabs,
  Tab,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Button,
  CircularProgress,
  Alert,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid,
  LineChart, Line, Legend,
  Tooltip as RechartsTooltip, ResponsiveContainer,
} from 'recharts';
import api from '../api';
import Layout from '../components/Layout';

const COLORS = ['#7C4DFF', '#03DAC6', '#FF9800', '#E91E63', '#43A047'];

const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`);

function EvaluationTab() {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getEvalRuns({ limit: 50 })
      .then((res) => { setRuns(res.data.results || res.data || []); setError(''); })
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load eval runs.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (runs.length === 0) {
    return (
      <Typography color="text.secondary">
        No eval runs yet. Run <code>python manage.py run_evals --database-id &lt;id&gt;</code>.
      </Typography>
    );
  }

  // Oldest -> newest for the trend line.
  const chartData = [...runs].reverse().map((r, i) => ({
    label: `#${r.id}`,
    idx: i,
    execution_accuracy: r.execution_accuracy,
    guardrail_block_rate: r.guardrail_block_rate,
    hallucination_recall: r.hallucination_recall,
  }));

  const latest = runs[0];

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3 }}>
        {[
          ['Execution accuracy', latest.execution_accuracy],
          ['Destructive ops blocked', latest.guardrail_block_rate],
          ['Hallucination recall', latest.hallucination_recall],
          ['False blocks', latest.guardrail_false_block_rate],
        ].map(([label, value]) => (
          <Paper key={label} variant="outlined" sx={{ p: 2, minWidth: 180, flex: '1 1 180px' }}>
            <Typography variant="caption" color="text.secondary">{label}</Typography>
            <Typography variant="h5" fontWeight={700}>{pct(value)}</Typography>
          </Paper>
        ))}
      </Box>

      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={chartData} margin={{ top: 8, right: 24, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" />
          <YAxis domain={[0, 1]} tickFormatter={pct} />
          <RechartsTooltip formatter={(v) => pct(v)} />
          <Legend />
          <Line type="monotone" dataKey="execution_accuracy" name="Execution accuracy" stroke={COLORS[0]} strokeWidth={2} connectNulls />
          <Line type="monotone" dataKey="guardrail_block_rate" name="Guardrail block rate" stroke={COLORS[4]} strokeWidth={2} connectNulls />
          <Line type="monotone" dataKey="hallucination_recall" name="Hallucination recall" stroke={COLORS[2]} strokeWidth={2} connectNulls />
        </LineChart>
      </ResponsiveContainer>

      <Table size="small" sx={{ mt: 3 }}>
        <TableHead>
          <TableRow>
            <TableCell>Run</TableCell>
            <TableCell>When</TableCell>
            <TableCell>Subset</TableCell>
            <TableCell>Retrieval</TableCell>
            <TableCell align="right">Few-shot</TableCell>
            <TableCell align="right">Cases</TableCell>
            <TableCell align="right">Exec acc</TableCell>
            <TableCell align="right">Exact SQL</TableCell>
            <TableCell align="right">Block rate</TableCell>
            <TableCell align="right">Rule acc</TableCell>
            <TableCell align="right">Halluc recall</TableCell>
            <TableCell align="right">Halluc FPR</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {runs.map((r) => (
            <TableRow key={r.id}>
              <TableCell>#{r.id}</TableCell>
              <TableCell>{new Date(r.created_at).toLocaleString()}</TableCell>
              <TableCell>{r.subset}</TableCell>
              <TableCell>{r.retrieval_mode || '—'}</TableCell>
              <TableCell align="right">{r.few_shot_count}</TableCell>
              <TableCell align="right">{r.n_cases}</TableCell>
              <TableCell align="right">{pct(r.execution_accuracy)}</TableCell>
              <TableCell align="right">{pct(r.sql_exact_match_rate)}</TableCell>
              <TableCell align="right">{pct(r.guardrail_block_rate)}</TableCell>
              <TableCell align="right">{pct(r.guardrail_rule_accuracy)}</TableCell>
              <TableCell align="right">{pct(r.hallucination_recall)}</TableCell>
              <TableCell align="right">{pct(r.hallucination_fpr)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}

function ModelVersionsTab() {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activatingId, setActivatingId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const response = await api.getModelVersions();
      setVersions(response.data.results || response.data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load model versions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleActivate = async (id) => {
    setActivatingId(id);
    try {
      await api.activateModelVersion(id);
      await load();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to activate model version.');
    } finally {
      setActivatingId(null);
    }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>;

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {versions.length === 0 ? (
        <Typography color="text.secondary">
          No embedding model imported. Retrieval uses keyword ranking by default;
          to enable vector retrieval, import a model directory with{' '}
          <code>python manage.py import_model_version --path ...</code> and activate it.
        </Typography>
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Version</TableCell>
              <TableCell>Base model</TableCell>
              <TableCell>Dimension</TableCell>
              <TableCell>Imported</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {versions.map((v) => (
              <TableRow key={v.id}>
                <TableCell>{v.version_tag}</TableCell>
                <TableCell>{v.base_model_name}</TableCell>
                <TableCell>{v.dimension}</TableCell>
                <TableCell>{new Date(v.imported_at).toLocaleString()}</TableCell>
                <TableCell>
                  {v.is_active
                    ? <Chip label="Active" color="success" size="small" />
                    : <Chip label="Inactive" size="small" variant="outlined" />}
                </TableCell>
                <TableCell align="right">
                  {!v.is_active && (
                    <Button
                      size="small"
                      variant="outlined"
                      disabled={activatingId === v.id}
                      onClick={() => handleActivate(v.id)}
                    >
                      {activatingId === v.id ? 'Activating…' : 'Activate'}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Box>
  );
}

function ExperimentsTab() {
  const [experiments, setExperiments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const response = await api.getExperiments();
        setExperiments(response.data.results || response.data);
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to load experiment runs.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>;
  if (error) return <Alert severity="error">{error}</Alert>;

  if (experiments.length === 0) {
    return (
      <Typography color="text.secondary">
        No experiment runs imported yet. Run <code>python manage.py import_experiment_run --metadata-path ...</code> after a Colab training run.
      </Typography>
    );
  }

  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableCell>Run ID</TableCell>
          <TableCell>Status</TableCell>
          <TableCell>Metrics</TableCell>
          <TableCell>Finished</TableCell>
          <TableCell>Notebook</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {experiments.map((run) => (
          <TableRow key={run.id}>
            <TableCell>{run.run_id}</TableCell>
            <TableCell>
              <Chip
                size="small"
                label={run.status}
                color={run.status === 'completed' ? 'success' : run.status === 'failed' ? 'error' : 'default'}
              />
            </TableCell>
            <TableCell>
              {Object.entries(run.metrics || {}).map(([k, v]) => `${k}: ${typeof v === 'number' ? v.toFixed(3) : v}`).join(', ') || '—'}
            </TableCell>
            <TableCell>{run.finished_at ? new Date(run.finished_at).toLocaleString() : '—'}</TableCell>
            <TableCell>
              {run.colab_notebook_url
                ? <a href={run.colab_notebook_url} target="_blank" rel="noreferrer">Open</a>
                : '—'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function DatabaseSelector({ databases, selectedDb, onChange }) {
  return (
    <FormControl size="small" sx={{ minWidth: 240, mb: 2 }}>
      <InputLabel>Database</InputLabel>
      <Select value={selectedDb || ''} label="Database" onChange={(e) => onChange(e.target.value)}>
        {databases.map((db) => (
          <MenuItem key={db.id} value={db.id}>{db.name}</MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

function DriftMetricsTab({ databases }) {
  const [selectedDb, setSelectedDb] = useState(databases[0]?.id || '');
  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!selectedDb) return;
    setLoading(true);
    api.getDriftMetrics(selectedDb)
      .then((res) => { setMetrics(res.data.results || res.data); setError(''); })
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load drift metrics.'))
      .finally(() => setLoading(false));
  }, [selectedDb]);

  return (
    <Box>
      <DatabaseSelector databases={databases} selectedDb={selectedDb} onChange={setSelectedDb} />
      {loading && <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>}
      {error && <Alert severity="error">{error}</Alert>}
      {!loading && !error && metrics.length === 0 && (
        <Typography color="text.secondary">
          No drift metrics yet. Run <code>python manage.py compute_drift_metrics</code> to compute them.
        </Typography>
      )}
      {!loading && metrics.map((m) => (
        <Alert key={m.id} severity={m.threshold_breached ? 'warning' : 'info'} sx={{ mb: 1 }}>
          <strong>{m.metric_type}</strong>: {m.value.toFixed(3)}
          {m.recommendation && <> — {m.recommendation}</>}
        </Alert>
      ))}
    </Box>
  );
}

function EmbeddingEvolutionTab({ databases }) {
  const [selectedDb, setSelectedDb] = useState(databases[0]?.id || '');
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!selectedDb) return;
    setLoading(true);
    api.getEmbeddingProjection(selectedDb)
      .then((res) => { setPoints(res.data.points || []); setError(''); })
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load embedding projection.'))
      .finally(() => setLoading(false));
  }, [selectedDb]);

  const tablePoints = points.filter((p) => p.type === 'table');
  const columnPoints = points.filter((p) => p.type === 'column');

  return (
    <Box>
      <DatabaseSelector databases={databases} selectedDb={selectedDb} onChange={setSelectedDb} />
      {loading && <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>}
      {error && <Alert severity="error">{error}</Alert>}
      {!loading && !error && points.length === 0 && (
        <Typography color="text.secondary">
          No embeddings to visualize yet for this database under the active model version.
        </Typography>
      )}
      {!loading && points.length > 0 && (
        <ResponsiveContainer width="100%" height={420}>
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" dataKey="x" name="PC1" />
            <YAxis type="number" dataKey="y" name="PC2" />
            <ZAxis range={[60, 60]} />
            <RechartsTooltip cursor={{ strokeDasharray: '3 3' }} />
            <Scatter name="Tables" data={tablePoints} fill={COLORS[0]} />
            <Scatter name="Columns" data={columnPoints} fill={COLORS[1]} />
          </ScatterChart>
        </ResponsiveContainer>
      )}
    </Box>
  );
}

function ModelMonitoring() {
  const [tab, setTab] = useState(0);
  const [databases, setDatabases] = useState([]);

  useEffect(() => {
    api.getDatabases().then((res) => setDatabases(res.data)).catch(() => setDatabases([]));
  }, []);

  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography variant="h4" sx={{ mb: 3 }}>Evaluation &amp; Monitoring</Typography>
        <Paper sx={{ p: 3 }}>
          <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 3 }}>
            <Tab label="Evaluation" />
            <Tab label="Model Versions" />
            <Tab label="Experiments" />
            <Tab label="Drift Metrics" />
            <Tab label="Embedding Evolution" />
          </Tabs>
          {tab === 0 && <EvaluationTab />}
          {tab === 1 && <ModelVersionsTab />}
          {tab === 2 && <ExperimentsTab />}
          {tab === 3 && <DriftMetricsTab databases={databases} />}
          {tab === 4 && <EmbeddingEvolutionTab databases={databases} />}
        </Paper>
      </Container>
    </Layout>
  );
}

export default ModelMonitoring;
