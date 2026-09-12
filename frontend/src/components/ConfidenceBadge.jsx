import React, { useState } from "react";
import {
  Box,
  Chip,
  Collapse,
  IconButton,
  LinearProgress,
  Stack,
  Tooltip,
  Typography,
  Alert,
  AlertTitle,
  useTheme,
  alpha,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import VerifiedIcon from "@mui/icons-material/Verified";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ShieldIcon from "@mui/icons-material/Shield";

// Colour band for a 0-100 confidence score.
function scoreColor(theme, score) {
  if (score == null) return theme.palette.text.disabled;
  if (score >= 75) return theme.palette.success.main;
  if (score >= 55) return theme.palette.warning.main;
  return theme.palette.error.main;
}

function SignalBar({ label, value, weight, used }) {
  const theme = useTheme();
  const pct = value == null ? 0 : Math.round(value * 100);
  return (
    <Box sx={{ opacity: used ? 1 : 0.45 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.25 }}>
        <Typography variant="caption" sx={{ fontWeight: 500 }}>
          {label}
          {weight != null && (
            <Typography component="span" variant="caption" color="text.secondary">
              {"  "}·{" "}weight {weight}
            </Typography>
          )}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {value == null ? "not run" : `${pct}%`}
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={pct}
        sx={{
          height: 6,
          borderRadius: 3,
          bgcolor: alpha(theme.palette.divider, 0.4),
          "& .MuiLinearProgress-bar": {
            borderRadius: 3,
            bgcolor:
              pct >= 75
                ? theme.palette.success.main
                : pct >= 45
                ? theme.palette.warning.main
                : theme.palette.error.main,
          },
        }}
      />
    </Box>
  );
}

/**
 * Confidence + verification summary for a generated query.
 *
 * Props:
 *   confidence        { score, breakdown: {name: {label, value, weight, used}}, flags: [] }
 *   verification      { back_translation, sanity_pass_rate, schema_coverage,
 *                       multi_query_agreement, warnings: [] }
 *   guardrailWarnings [{ rule, message }]
 *
 * All fields optional — nothing renders if there is no signal at all.
 */
const ConfidenceBadge = ({ confidence, verification, guardrailWarnings }) => {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  const score = confidence?.score ?? null;
  const breakdown = confidence?.breakdown || {};
  const flags = confidence?.flags || [];
  const vWarnings = verification?.warnings || [];
  const gWarnings = guardrailWarnings || [];

  const hasAnything =
    score != null ||
    Object.keys(breakdown).length > 0 ||
    vWarnings.length > 0 ||
    gWarnings.length > 0;
  if (!hasAnything) return null;

  const color = scoreColor(theme, score);
  const label =
    score == null
      ? "Confidence: n/a"
      : `Confidence ${score}/100`;
  const lowConfidence = flags.includes("low_confidence") || (score != null && score < 55);

  return (
    <Box
      sx={{
        px: 3,
        py: 1.5,
        borderBottom: "1px solid",
        borderColor: alpha(theme.palette.divider, 0.3),
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
        <Chip
          icon={lowConfidence ? <WarningAmberIcon /> : <VerifiedIcon />}
          label={label}
          size="small"
          sx={{
            fontWeight: 600,
            color,
            borderColor: alpha(color, 0.5),
            bgcolor: alpha(color, 0.12),
            "& .MuiChip-icon": { color },
          }}
          variant="outlined"
        />
        {gWarnings.length > 0 && (
          <Chip
            icon={<ShieldIcon />}
            label={`${gWarnings.length} guardrail note${gWarnings.length > 1 ? "s" : ""}`}
            size="small"
            variant="outlined"
            sx={{
              color: theme.palette.info.main,
              borderColor: alpha(theme.palette.info.main, 0.4),
              "& .MuiChip-icon": { color: theme.palette.info.main },
            }}
          />
        )}
        {flags
          .filter((f) => f !== "low_confidence")
          .map((f) => (
            <Chip
              key={f}
              label={f.replace(/_/g, " ")}
              size="small"
              variant="outlined"
              sx={{
                color: theme.palette.warning.main,
                borderColor: alpha(theme.palette.warning.main, 0.4),
              }}
            />
          ))}
        {Object.keys(breakdown).length > 0 && (
          <Tooltip title={open ? "Hide signals" : "Show signals"}>
            <IconButton size="small" onClick={() => setOpen((v) => !v)}>
              {open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {(vWarnings.length > 0 || gWarnings.length > 0) && (
        <Stack spacing={1} sx={{ mt: 1.5 }}>
          {vWarnings.map((w, i) => (
            <Alert key={`v${i}`} severity="warning" variant="outlined" sx={{ py: 0.25 }}>
              {w}
            </Alert>
          ))}
          {gWarnings.map((w, i) => (
            <Alert key={`g${i}`} severity="info" variant="outlined" sx={{ py: 0.25 }}>
              <AlertTitle sx={{ mb: 0, fontSize: "0.8rem" }}>{w.rule}</AlertTitle>
              {w.message}
            </Alert>
          ))}
        </Stack>
      )}

      <Collapse in={open} unmountOnExit>
        <Stack spacing={1.25} sx={{ mt: 1.5 }}>
          {Object.entries(breakdown).map(([name, sig]) => (
            <SignalBar
              key={name}
              label={sig.label || name}
              value={sig.value}
              weight={sig.weight}
              used={sig.used}
            />
          ))}
          {verification?.back_translation?.restated_question && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
              The SQL reads as: “{verification.back_translation.restated_question}”
              {verification.back_translation.method
                ? ` (${verification.back_translation.method.replace(/_/g, " ")})`
                : ""}
            </Typography>
          )}
        </Stack>
      </Collapse>
    </Box>
  );
};

export default ConfidenceBadge;
