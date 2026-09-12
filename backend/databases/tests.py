from django.test import SimpleTestCase, override_settings

from databases.guardrails import GuardrailPipeline, EXPLAIN_UNAVAILABLE


def _check(sql, *, read_only=True, explain=EXPLAIN_UNAVAILABLE, require_explain=False, config=None):
    return GuardrailPipeline(config).check(
        sql, read_only=read_only, explain=explain, require_explain=require_explain,
    )


class GuardrailPipelineTests(SimpleTestCase):
    def test_plain_select_passes(self):
        r = _check("SELECT id FROM t2s_sample.customers")
        self.assertTrue(r.passed)

    def test_ddl_blocked(self):
        r = _check("DROP TABLE t2s_sample.customers")
        self.assertFalse(r.passed)
        self.assertEqual(r.blocked_rule, "block_ddl")

    def test_write_blocked_when_read_only(self):
        r = _check("DELETE FROM t2s_sample.customers", read_only=True)
        self.assertFalse(r.passed)
        self.assertEqual(r.blocked_rule, "block_writes")

    def test_write_allowed_when_not_read_only(self):
        r = _check("DELETE FROM t2s_sample.customers", read_only=False)
        # still may be blocked by other rules, but not by block_writes
        if not r.passed:
            self.assertNotEqual(r.blocked_rule, "block_writes")

    def test_stacked_statement_blocked(self):
        r = _check("SELECT 1; DROP TABLE t2s_sample.albums")
        self.assertFalse(r.passed)
        self.assertEqual(r.blocked_rule, "single_statement")

    def test_comment_hidden_keyword_blocked(self):
        r = _check("SELECT 1 /* harmless */ ; DROP TABLE x")
        self.assertFalse(r.passed)

    def test_string_literal_keyword_not_blocked(self):
        r = _check("SELECT id FROM t2s_sample.tracks WHERE name = 'DROP TABLE songs'")
        self.assertTrue(r.passed)

    def test_limit_injected(self):
        r = _check("SELECT id FROM t2s_sample.customers")
        self.assertIn("LIMIT 1000", r.sql.upper())

    def test_existing_limit_kept(self):
        r = _check("SELECT id FROM t2s_sample.customers LIMIT 5")
        self.assertEqual(r.sql.upper().count("LIMIT"), 1)

    def test_deep_subquery_blocked(self):
        sql = ("SELECT * FROM (SELECT * FROM (SELECT * FROM (SELECT * FROM "
               "(SELECT id FROM t2s_sample.customers) a) b) c) d")
        r = _check(sql)
        self.assertFalse(r.passed)
        self.assertEqual(r.blocked_rule, "max_subquery_depth")

    def test_require_explain_blocks_when_no_explainer(self):
        r = _check("SELECT id FROM t2s_sample.customers",
                   explain=EXPLAIN_UNAVAILABLE, require_explain=True)
        self.assertFalse(r.passed)
        self.assertEqual(r.blocked_rule, "explain_row_estimate")

    def test_explain_over_cap_blocked(self):
        r = _check("SELECT id FROM t2s_sample.customers",
                   explain=lambda s: 10_000_000, config={"max_scan_rows": 1_000_000})
        self.assertFalse(r.passed)
        self.assertEqual(r.blocked_rule, "explain_row_estimate")

    def test_explain_raises_fails_closed(self):
        def boom(_):
            raise RuntimeError("no")
        r = _check("SELECT id FROM t2s_sample.customers", explain=boom)
        self.assertFalse(r.passed)
        self.assertEqual(r.blocked_rule, "explain_row_estimate")

    @override_settings(IS_PRODUCTION=True)
    def test_production_locks_block_ddl_on(self):
        # config trying to disable block_ddl is ignored in production
        r = _check("DROP TABLE x", config={"block_ddl": False},
                   explain=lambda s: 1, require_explain=False)
        self.assertFalse(r.passed)
        self.assertEqual(r.blocked_rule, "block_ddl")
