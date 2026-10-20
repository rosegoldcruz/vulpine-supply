"""Regenerate an immutable write-back payload from independently checked evidence."""
import json
import sys
import aeon

job = sys.argv[1]
folder = aeon.ROOT / 'jobs' / job
manifest = json.loads((folder / 'manifest.json').read_text())
if manifest['passed']:
    aeon.verify_evidence(manifest['evidence']['tester']['gates'])
    for name, sha in manifest['visual_hashes'].items():
        if aeon.digest(folder / 'tester-evidence' / name) != sha:
            raise RuntimeError('changed visual evidence')
facts = [f'Candidate commit: {manifest["candidate_sha"]}.',
         f'Supervisor overall passed: {manifest["passed"]}.',
         *[f'{name}: verified exit {record["exit"]}.' for name, record in manifest['evidence']['tester']['gates'].items()],
         f'Independent review passed: {manifest["evidence"]["reviewer"]["answer"]["passed"]}.']
outcome = {
    'job': job, 'facts': facts, 'sources': manifest['sources'],
    'evidence': [f'{folder}/manifest.json SHA256 {aeon.digest(folder / "manifest.json")}',
                 *[f'{r["log"]} SHA256 {r["sha256"]}' for r in manifest['evidence']['tester']['gates'].values() if 'log' in r]],
    'decisions': ['Retrieved AEON Project Continuity before work; selected test-only scope to preserve Vulpine design and production integrations.',
                  'Require independently checked build, test, typecheck, security-scope, visual and review evidence.'],
    'blockers': ['No production deployment approved or performed.', 'Unattended vault-host transport remains unconfigured.'],
    'lessons': ['User systemd namespace settings were not enforced on this host; negative access tests exposed this before completion.',
                'Landlock and queue SCRAM protect scoped work; this runtime is not a hostile-code VM.',
                'Use software rendering and permit read-only hardware enumeration for headless browser verification.',
                'Preserve failed attempts, bound retries, and verify results instead of trusting agent completion claims.']}
target = folder / 'outcome.json'
target.write_text(json.dumps(outcome, indent=2))
aeon.event(job, 'outcome_exported', {'sha256': aeon.digest(target), 'passed': manifest['passed']})
print(str(target))
