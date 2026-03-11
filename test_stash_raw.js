const { execFile } = require('child_process');

execFile('git', ['stash', 'list', '--format={"index":"%gd","hash":"%H","shortHash":"%h","date":"%aI","message":"%s"}'], (err, stdout, stderr) => {
  console.log('STDOUT:', stdout);
  console.log('STDERR:', stderr);
  console.log('ERR:', err);
});
