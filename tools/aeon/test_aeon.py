"""Targeted safety tests; run with the dedicated AEON Python environment."""
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import aeon


class SafetyTests(unittest.TestCase):
    def test_authority_fails_closed(self):
        self.assertEqual(aeon.POLICY['bounded'], {})
        self.assertIsNone(aeon.POLICY['deployment_adapter'])
        self.assertIn('production_deployment', aeon.POLICY['executive'])
        self.assertEqual(aeon.POLICY['max_recovery_attempts'], 1)

    def test_engineering_branch_cannot_auto_deploy(self):
        config=json.loads((aeon.REPO/'vercel.json').read_text())
        self.assertIs(config['git']['deploymentEnabled']['aeon/engineering-foundation'],False)

    def test_sensitive_log_values_are_redacted(self):
        self.assertNotIn('sk-proj-abcdefghijklmnop', aeon.safe_text('sk-proj-abcdefghijklmnop'))
        self.assertNotIn('abcdef', aeon.safe_text('Bearer abcdef'))

    def test_empty_institutional_memory_blocks_execution(self):
        with tempfile.TemporaryDirectory() as d, patch.object(aeon, 'ROOT', Path(d)), patch.object(aeon, 'retrieve', return_value=[]):
            supervisor = object.__new__(aeon.Supervisor)
            with self.assertRaisesRegex(RuntimeError, 'required institutional knowledge'):
                supervisor.run({'id': 'aabbccddeeff', 'timeout_seconds': 20, 'objective': 'test'})

    def test_postgresql_queue_and_incident_storage(self):
        with aeon.db() as c, c.transaction():
            c.execute('CREATE TEMP TABLE acceptance_queue(id int PRIMARY KEY, state text, attempts int)')
            c.execute("INSERT INTO acceptance_queue VALUES(1,'queued',0)")
            first = c.execute("UPDATE acceptance_queue SET state='running',attempts=attempts+1 WHERE state='queued' RETURNING *").fetchall()
            second = c.execute("UPDATE acceptance_queue SET state='running',attempts=attempts+1 WHERE state='queued' RETURNING *").fetchall()
            self.assertEqual(len(first), 1)
            self.assertEqual(second, [])
            self.assertEqual(first[0]['attempts'], 1)
        with aeon.db() as c:
            self.assertTrue(c.execute("SELECT pg_try_advisory_lock(2601021) AS held").fetchone()['held'])
            with aeon.db() as other:
                self.assertFalse(other.execute("SELECT pg_try_advisory_lock(2601021) AS held").fetchone()['held'])

    def test_supervisor_rejects_forged_success_and_changed_evidence(self):
        with tempfile.TemporaryDirectory() as d:
            log = Path(d) / 'test.log'
            log.write_text('real check output')
            record = {'exit': 0, 'log': str(log), 'sha256': aeon.digest(log)}
            aeon.verify_evidence({'test': record})
            log.write_text('changed after verification')
            with self.assertRaisesRegex(RuntimeError, 'hash mismatch'):
                aeon.verify_evidence({'test': record})
            with self.assertRaisesRegex(RuntimeError, 'quality gate failed'):
                aeon.verify_evidence({'test': {**record, 'exit': 1}})

    def test_real_worker_cannot_access_production_credentials_or_queue(self):
        with tempfile.TemporaryDirectory(dir=aeon.ROOT) as d:
            root = Path(d)
            work, out = root / 'work', root / 'evidence'
            work.mkdir(); out.mkdir()
            script = "const fs=require('fs'),net=require('net'),assert=require('assert/strict'),cp=require('child_process'); for(const p of ['/home/aeon/.ssh/id_ed25519','/home/aeon/factory/engine/.env','/home/aeon/factory/engineering/runtime/queue.pgpass','/opt/devbox-postgres/README.txt']) assert.throws(()=>fs.readFileSync(p),e=>['EACCES','ENOENT'].includes(e.code),p);const p=cp.spawnSync('/home/aeon/factory/engineering/runtime/pg/usr/lib/postgresql/16/bin/psql',['-h','/home/aeon/factory/engineering/runtime/pgsocket','-p','55432','-U','aeon','-d','aeon','-w','-c','select 1'],{encoding:'utf8'});assert.notEqual(p.status,0);assert.match(p.stderr,/no password supplied/);const n=net.connect(443,'127.0.0.1'); n.on('connect',()=>{throw Error('network accessible')});n.on('error',e=>{assert.equal(e.code,'EACCES'); console.log('file contents, queue authentication and TCP restrictions verified')});"
            result = aeon.sandbox(['node', '-e', script], work, out, timeout=30)
            self.assertEqual(result['exit'], 0)

    def test_launcher_preserves_literal_javascript_interpolation(self):
        with tempfile.TemporaryDirectory(dir=aeon.ROOT) as d:
            work, out = Path(d)/'work', Path(d)/'evidence'
            work.mkdir();out.mkdir()
            result=aeon.sandbox(['node','-e',"process.stdout.write('${AEON_LITERAL_MUST_SURVIVE}')"],work,out,timeout=20)
            self.assertEqual(Path(result['log']).read_text(),'${AEON_LITERAL_MUST_SURVIVE}')


if __name__ == '__main__':
    unittest.main()
