#!/usr/bin/env node

var program = require('commander');

var pull = require('./lib/pull');
var push = require('./lib/push');
let id = process.argv[3]
program.version('1.0.0')
program.command('pull').description('pull').action(pull)
program.command('push').description('push').action(push)
program.command('set').description('set pageId to local').action(() => {
    pull(id)
})
program.command('watch').description('watch the file changes').action(() => {
    push('watch')
})
if (!process.argv.slice(2).length) {
  program.outputHelp();
}

program.parse(process.argv)
//require('babel-polyfill');
//require('babel-register');
//require('./lib/index.js');
