import contextlib
import importlib.util
import io
import json
from pathlib import Path
import unittest
import urllib.error

spec = importlib.util.spec_from_file_location('probe', Path(__file__).parents[1] / 'scripts/check-test-environment.py')
probe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(probe)

class ProbeTests(unittest.TestCase):
    def test_refuses_production_before_any_request(self):
        class Forbidden:
            def open(self, *_args, **_kwargs):
                raise AssertionError('Network must not be used')
        for env in ({'NEXT_PUBLIC_APP_ENV': 'production', 'NEXT_PUBLIC_SUPABASE_URL': probe.TEST_URL},
                    {'NEXT_PUBLIC_APP_ENV': 'test', 'NEXT_PUBLIC_SUPABASE_URL': 'https://sqlrhvxiluzgeldxcmyf.supabase.co'}):
            with self.assertRaises(ValueError):
                probe.run(env, Forbidden())

    def test_requests_no_rows_and_reports_no_credentials(self):
        class Opener:
            def open(self, req, **kwargs):
                self_test.assertEqual(req.get_method(), 'GET')
                self_test.assertTrue(req.full_url.startswith(probe.TEST_URL + '/rest/v1/'))
                self_test.assertTrue(req.full_url.endswith('?select=*&limit=0'))
                raise urllib.error.HTTPError(req.full_url, 404, 'error', {}, io.BytesIO(b'{"code":"PGRST205","message":"private-data"}'))
        self_test = self
        result = probe.run({'NEXT_PUBLIC_APP_ENV': 'test', 'NEXT_PUBLIC_SUPABASE_URL': probe.TEST_URL,
                            'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY': 'mock-secret'}, Opener())
        self.assertTrue(all(r['result'] == 'TABLE_NOT_IN_SCHEMA_CACHE' for r in result['results']))
        self.assertNotIn('mock-secret', json.dumps(result))
        self.assertNotIn('private-data', json.dumps(result))
        self.assertEqual(result['functional_validation'], 'NOT_EXECUTED')

    def test_permission_denied_is_not_missing_table(self):
        self.assertEqual(probe.classify(401), 'AUTHORIZATION_NOT_VALIDATED')
        self.assertEqual(probe.classify(403), 'AUTHORIZATION_NOT_VALIDATED')
        self.assertNotEqual(probe.classify(200), 'READY')

if __name__ == '__main__':
    unittest.main()
