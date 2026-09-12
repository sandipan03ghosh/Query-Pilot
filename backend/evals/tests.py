from django.test import SimpleTestCase

from evals import comparators


def _res(columns, rows, success=True):
    return {"columns": columns, "rows": rows, "success": success}


class ResultSetsMatchTests(SimpleTestCase):
    def test_same_rows_unordered(self):
        a = _res(["c"], [[1], [2], [3]])
        b = _res(["c"], [[3], [1], [2]])
        self.assertTrue(comparators.result_sets_match(a, b))

    def test_ordered_requires_same_order(self):
        a = _res(["c"], [[1], [2], [3]])
        b = _res(["c"], [[3], [2], [1]])
        self.assertTrue(comparators.result_sets_match(a, b, ordered=False))
        self.assertFalse(comparators.result_sets_match(a, b, ordered=True))

    def test_column_count_mismatch(self):
        a = _res(["c1", "c2"], [[1, 2]])
        b = _res(["c1"], [[1]])
        self.assertFalse(comparators.result_sets_match(a, b))

    def test_column_order_matters(self):
        a = _res(["a", "b"], [[1, 2]])
        b = _res(["b", "a"], [[2, 1]])
        self.assertFalse(comparators.result_sets_match(a, b))

    def test_numeric_type_equivalence(self):
        import decimal
        a = _res(["n"], [[2]])
        b = _res(["n"], [[decimal.Decimal("2.00")]])
        self.assertTrue(comparators.result_sets_match(a, b))

    def test_number_never_equals_string(self):
        a = _res(["n"], [["2.000000"]])
        b = _res(["n"], [[2]])
        self.assertFalse(comparators.result_sets_match(a, b))

    def test_failed_got_never_matches(self):
        a = _res([], [], success=False)
        b = _res(["c"], [])
        self.assertFalse(comparators.result_sets_match(a, b))

    def test_both_empty_match(self):
        a = _res(["c"], [])
        b = _res(["c"], [])
        self.assertTrue(comparators.result_sets_match(a, b))
