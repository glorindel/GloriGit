const git = require('./tools/git.js');

async function test() {
  try {
    const stashes = await git.getStashes();
    console.log('Stashes:', JSON.stringify(stashes, null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
