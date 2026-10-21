"""Adapter integration/security tests against a disposable PostgreSQL schema.

No production jobs, chat history or model calls are created by this suite.
"""
import http.client
import importlib.util
import json
from pathlib import Path
import tempfile
import threading
import unittest
import uuid
from unittest.mock import patch
import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
import aeon
import console as chat


class ConsoleTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp=tempfile.TemporaryDirectory()
        cls.root=Path(cls.temp.name)
        cls.schema='console_test_'+uuid.uuid4().hex
        with aeon.db() as c:
            c.execute(f'CREATE SCHEMA {cls.schema}')
        cls.dbpatch=patch.object(aeon,'db',lambda:psycopg.connect(aeon.DSN,row_factory=dict_row,autocommit=True,options=f'-csearch_path={cls.schema}'))
        cls.dbpatch.start()
        cls.rootpatch=patch.object(aeon,'ROOT',cls.root)
        cls.rootpatch.start()
        cls.storepatch=patch.object(chat,'STORE',cls.root/'chat')
        cls.storepatch.start()
        with aeon.db() as c:
            c.execute((aeon.SOURCE/'schema.sql').read_text())
        chat.initialize()
        cls.token=(chat.STORE/'operator-token').read_text()
        cls.server=chat.ThreadingHTTPServer(('127.0.0.1',0),chat.Handler)
        cls.server.login_lock=threading.Lock();cls.server.failed_logins=[]
        cls.thread=threading.Thread(target=cls.server.serve_forever,daemon=True);cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown();cls.server.server_close()
        with aeon.db() as c:
            c.execute(f'DROP SCHEMA {cls.schema} CASCADE')
        cls.dbpatch.stop();cls.rootpatch.stop();cls.storepatch.stop();cls.temp.cleanup()

    def setUp(self):
        with aeon.db() as c:
            c.execute('TRUNCATE chat_turns,chat_messages,chat_actions,chat_rooms,tasks,jobs,events,approvals CASCADE')
            c.execute("INSERT INTO chat_rooms(id,name) VALUES('factory','Test')")

    def request(self,method,path,data=None,authenticated=True,headers=None):
        h={'Host':'127.0.0.1:8766','Content-Type':'application/json'}
        if authenticated:h['Authorization']='Bearer '+self.token
        h.update(headers or {})
        conn=http.client.HTTPConnection('127.0.0.1',self.server.server_port)
        conn.request(method,path,body=json.dumps(data) if data is not None else None,headers=h)
        r=conn.getresponse();body=r.read();info=dict(r.getheaders());conn.close()
        return r.status,json.loads(body) if info.get('Content-Type','').startswith('application/json') else body,info

    def msg(self,content,nonce=None):
        return chat.submit({'room':'factory','content':content,'request_id':nonce or str(uuid.uuid4())})

    def preview(self):
        with patch.object(aeon,'command',return_value='a'*40):self.msg('/run')
        with aeon.db() as c:return c.execute('SELECT id FROM chat_actions').fetchone()['id']

    def test_unauthenticated_api_denied(self):
        for method,path,data in [('GET','/api/state',None),('POST','/api/messages',{'room':'factory','content':'attack'}),('POST','/api/decision',{})]:
            self.assertEqual(self.request(method,path,data,False)[0],401)

    def test_host_and_cross_origin_denied(self):
        self.assertEqual(self.request('GET','/api/state',headers={'Host':'evil.test:8766'})[0],403)
        self.assertEqual(self.request('POST','/api/messages',{},headers={'Origin':'https://evil.test'})[0],403)

    def test_login_cookie_and_security_headers(self):
        status,result,h=self.request('POST','/api/login',{'token':self.token},False)
        self.assertEqual(status,200)
        self.assertIn('HttpOnly',h['Set-Cookie']);self.assertIn('SameSite=Strict',h['Set-Cookie'])
        status,_,h=self.request('GET','/')
        self.assertEqual(status,200);self.assertIn("script-src 'self'",h['Content-Security-Policy'])
        self.assertEqual(h['Cache-Control'],'no-store')

    def test_invalid_json_and_body_size(self):
        self.assertEqual(self.request('POST','/api/messages',[])[0],400)
        self.assertEqual(self.request('POST','/api/messages',{'x':'a'*12001})[0],413)

    def test_idempotent_submission_and_durable_history(self):
        nonce=str(uuid.uuid4());first=self.msg('hello',nonce);again=self.msg('hello',nonce)
        self.assertEqual(first['message'],again['message']);self.assertTrue(again['duplicate'])
        self.assertEqual(len(chat.snapshot('factory')['messages']),1)
        with aeon.db() as c:self.assertEqual(c.execute('SELECT count(*) AS n FROM chat_turns').fetchone()['n'],1)

    def test_mentions_and_unknown_role(self):
        self.msg('@everyone Explain the real runtime')
        with aeon.db() as c:self.assertEqual({r['role'] for r in c.execute('SELECT role FROM chat_turns')},set(chat.ROLES))
        with self.assertRaises(chat.Problem):self.msg('@Researcher unsupported')

    def test_queue_and_rolling_budget_fail_closed(self):
        self.msg('@everyone a');self.msg('@everyone b')
        with self.assertRaises(chat.Problem):self.msg('excess')
        self.msg('/status')
        with aeon.db() as c:
            c.execute("UPDATE chat_turns SET state='done'")
            mid=c.execute('SELECT id FROM chat_messages LIMIT 1').fetchone()['id']
            for i in range(32):c.execute("INSERT INTO chat_turns(message,role,state) VALUES(%s,%s,'done')",(mid,f'test-{i}'))
        with self.assertRaises(chat.Problem):self.msg('over daily cap')
        self.msg('/status')

    def test_no_factory_job_without_confirmation(self):
        aid=self.preview()
        with aeon.db() as c:self.assertEqual(c.execute('SELECT count(*) AS n FROM jobs').fetchone()['n'],0)
        self.assertEqual(chat.decide(aid,'reject')['state'],'rejected')
        with self.assertRaises(chat.Problem):chat.decide(aid,'approve')

    def test_confirmed_action_atomic_and_single_use(self):
        aid=self.preview()
        with patch.object(aeon,'command',return_value='a'*40):r=chat.decide(aid,'approve')
        with aeon.db() as c:
            job=c.execute('SELECT * FROM jobs WHERE id=%s',(r['job'],)).fetchone()
            self.assertEqual(job['objective'],chat.OBJECTIVE);self.assertEqual(job['state'],'queued')
            self.assertEqual(c.execute('SELECT count(*) AS n FROM tasks').fetchone()['n'],3)
            self.assertEqual(c.execute('SELECT count(*) AS n FROM approvals').fetchone()['n'],0)
        with self.assertRaises(chat.Problem):chat.decide(aid,'approve')

    def test_changed_revision_or_scope_refused(self):
        aid=self.preview()
        with patch.object(aeon,'command',return_value='b'*40):
            with self.assertRaises(chat.Problem):chat.decide(aid,'approve')
        with aeon.db() as c:c.execute("UPDATE chat_actions SET payload=jsonb_set(payload,'{scope}','[\"production\"]') WHERE id=%s",(aid,))
        with self.assertRaises(chat.Problem):chat.decide(aid,'approve')

    def test_cancel_only_queued_turns(self):
        self.msg('hello')
        with aeon.db() as c:tid=c.execute('SELECT id FROM chat_turns').fetchone()['id']
        self.assertEqual(chat.cancel_turn(tid)['state'],'cancelled')
        with self.assertRaises(chat.Problem):chat.cancel_turn(tid)

    def test_restart_marks_inflight_interrupted(self):
        self.msg('hello')
        with aeon.db() as c:c.execute("UPDATE chat_turns SET state='running'")
        chat.initialize()
        with aeon.db() as c:self.assertEqual(c.execute('SELECT state FROM chat_turns').fetchone()['state'],'interrupted')
        self.assertIn('interrupted',chat.snapshot('factory')['messages'][-1]['content'])

    def test_no_arbitrary_terminal_files_or_deploy(self):
        for path in ['/api/computer/terminal','/api/computer/files','/api/deploy','/api/bots']:
            self.assertEqual(self.request('POST',path,{'command':'false'})[0],404)

    def test_log_hash_and_path_confinement(self):
        jid='123456789abc';folder=self.root/'jobs'/jid;out=folder/'tester-evidence';out.mkdir(parents=True)
        log=out/'test.log';log.write_text('real test output\n')
        data={'candidate_sha':'a'*40,'evidence':{'tester':{'gates':{'test':{'log':str(log),'sha256':aeon.digest(log),'exit':0}}}}}
        (folder/'manifest.json').write_text(json.dumps(data))
        self.assertTrue(chat.evidence(jid,'test')['verified'])
        log.write_text('tampered');self.assertFalse(chat.evidence(jid,'test')['verified'])
        log.unlink();log.symlink_to(self.root/'chat'/'operator-token')
        with self.assertRaises(chat.Problem):chat.evidence(jid,'test')
        with self.assertRaises(chat.Problem):chat.evidence('../secret','manifest')

    def test_redaction_preserves_json_and_xss_remains_data(self):
        self.msg('/status')
        text='<img src=x onerror=alert(1)> password=hidden'
        with aeon.db() as c:chat.post(c,'factory','operator',text)
        snapshot=chat.snapshot('factory')
        self.assertIn('<img',snapshot['messages'][-1]['content'])
        self.assertNotIn('hidden',snapshot['messages'][-1]['content'])
        json.dumps(snapshot)

    def test_chat_log_integrity_and_missing_record(self):
        folder=chat.STORE/'turn-99';folder.mkdir(exist_ok=True)
        log=folder/'command-test.log';log.write_text('recorded execution')
        with aeon.db() as c:chat.post(c,'factory','orchestrator','reply',meta={'turn':99,'source':'codex_execution','log_sha256':aeon.digest(log)})
        self.assertTrue(chat.chat_evidence('99')['verified'])
        log.write_text('changed');self.assertFalse(chat.chat_evidence('99')['verified'])
        with self.assertRaises(chat.Problem):chat.chat_evidence('100')
        with self.assertRaises(chat.Problem):chat.chat_evidence('../token')

    def test_model_failure_is_recorded_without_success(self):
        self.msg('hello')
        stop=threading.Event()
        def failed(*args,**kwargs):
            stop.set()
            raise RuntimeError('test model unavailable')
        with patch.object(aeon,'sandbox',side_effect=failed):chat.chat_worker(stop)
        with aeon.db() as c:self.assertEqual(c.execute('SELECT state FROM chat_turns').fetchone()['state'],'failed')
        self.assertEqual(chat.snapshot('factory')['messages'][-1]['state'],'failed')

    def test_factory_queue_and_daily_budget_enforced(self):
        aid=self.preview()
        with aeon.db() as c:c.execute("INSERT INTO jobs(id,objective,base_sha) VALUES('existing','test','sha')")
        with self.assertRaises(chat.Problem):chat.decide(aid,'approve')
        with aeon.db() as c:
            c.execute("UPDATE jobs SET state='awaiting_review'")
            for _ in range(3):c.execute("INSERT INTO events(kind,detail) VALUES('chat_operator_approved','{}')")
        with self.assertRaises(chat.Problem):chat.decide(aid,'approve')

    def test_worker_retry_uses_remaining_deadline(self):
        from unittest.mock import MagicMock
        job={'id':'deadline-test'}
        with aeon.db() as c:
            c.execute("INSERT INTO jobs(id,objective,base_sha) VALUES(%s,'test','sha')",(job['id'],))
            c.execute("INSERT INTO tasks(job,role) VALUES(%s,'tester')",(job['id'],))
        supervisor=object.__new__(aeon.Supervisor)
        process,pipe=MagicMock(),MagicMock();process.pid=123
        supervisor.workers={'tester':(process,pipe)}
        now=[0.0]
        pipe.poll.side_effect=lambda timeout:(now.__setitem__(0,now[0]+6) or True)
        pipe.recv.side_effect=[{'ok':False,'error':'worker unavailable'},{'ok':True,'result':{'passed':True}}]
        with patch.object(aeon.time,'monotonic',side_effect=lambda:now[0]),patch.object(aeon.sp,'run'),patch.object(supervisor,'start'):
            self.assertEqual(supervisor.execute(job,'tester',{},10),{'passed':True})
        self.assertEqual([args.args[0] for args in pipe.poll.call_args_list],[10.0,4.0])

    def test_exhausted_deadline_does_not_retry(self):
        from unittest.mock import MagicMock
        job={'id':'deadline-exhausted'}
        with aeon.db() as c:
            c.execute("INSERT INTO jobs(id,objective,base_sha) VALUES(%s,'test','sha')",(job['id'],))
            c.execute("INSERT INTO tasks(job,role) VALUES(%s,'tester')",(job['id'],))
        supervisor=object.__new__(aeon.Supervisor)
        process,pipe=MagicMock(),MagicMock();process.pid=123
        supervisor.workers={'tester':(process,pipe)}
        now=[0.0]
        pipe.poll.side_effect=lambda timeout:(now.__setitem__(0,10.0) or False)
        with patch.object(aeon.time,'monotonic',side_effect=lambda:now[0]),patch.object(aeon.sp,'run'),patch.object(supervisor,'start') as restart:
            with self.assertRaisesRegex(RuntimeError,'deadline'):supervisor.execute(job,'tester',{},10)
            restart.assert_not_called()
        self.assertEqual(pipe.poll.call_count,1)


if __name__=='__main__':unittest.main(verbosity=2)
