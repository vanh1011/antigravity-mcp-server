#!/usr/bin/env node
// Stand-in for the Antigravity CLI used by the tests. It mimics the parts of
// agy's print mode that the server relies on.
const args = process.argv.slice(2);

if (args[0] === '--help') {
  console.error('Usage of agy:');
  process.exit(0);
}

if (args[0] === 'models') {
  console.log('fake-flash\tFake Flash (Medium)');
  console.log('fake-pro\tFake Pro (High)');
  process.exit(0);
}

const prompt = args[args.indexOf('--print') + 1];
const result = (extra) =>
  JSON.stringify({
    conversation_id: 'conv-123',
    status: 'SUCCESS',
    response: '',
    duration_seconds: 1.5,
    num_turns: 1,
    usage: { total_tokens: 42 },
    ...extra,
  });

if (prompt === 'FAIL') {
  console.log(
    result({ conversation_id: '', status: 'ERROR', error: 'model boom is not recognized' }),
  );
  process.exit(1);
}
if (prompt === 'GARBAGE') {
  console.log('this is not json');
  process.exit(2);
}
if (prompt === 'PARTIAL') {
  console.error('[agy] print timeout after 1s with turn in progress; returning partial output');
  console.log(result({ response: 'half an answer' }));
  process.exit(0);
}
if (prompt === 'DENIED') {
  console.error(
    'jetski: no output produced — a tool required the "read_url" permission that headless mode cannot prompt for, so it was auto-denied. Add an allow-rule under permissions.allow in settings.json (e.g. read_url(<target>)).',
  );
  console.log(result({ response: '' }));
  process.exit(0);
}
if (prompt === 'EMPTY') {
  console.log(result({ response: '' }));
  process.exit(0);
}
if (prompt === 'HANG') {
  setTimeout(() => {}, 60_000);
} else {
  console.log('warning: something agy likes to print first');
  if (prompt === 'WARN') {
    console.error('warning: --mode auto is not available for this account');
  }
  // Echo argv and working directory so tests can check what the server passed.
  console.log(result({ response: JSON.stringify({ args, cwd: process.cwd() }) }));
}
