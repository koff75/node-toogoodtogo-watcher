#!/usr/bin/env node
const {editConfig, resetConfig, configPath} = require('./lib/config');
const {pollBusinesses$} = require('./lib/poller');
const notifier = require('./lib/notifier');

const argv = require('yargs')
    .usage('Usage: toogoodtogo-watcher <command>')
    .command('config', 'Edit the config file.')
    .command('config-reset', 'Reset the config to the default values.')
    .command('config-path', 'Show the path of the config file.')
    .command('watch', 'Watch your favourite busininesses for changes.')
    .demandCommand().argv;

switch (argv._[0]) {
  case 'config':
    editConfig();
    break;

  case 'config-reset':
    resetConfig();
    break;

  case 'config-path':
    configPath();
    break;

  case 'watch':
    // Polling auth + favorites
    pollBusinesses$(notifier.hasListeners$(), true).subscribe(
        (businesses) => notifier.notifyIfChanged(businesses),
        console.error,
    );
    // Polling auth + top ranking based on the location provided
    pollBusinesses$(notifier.hasListeners$(), false).subscribe(
        (businesses) => notifier.notifyOnLocalization(businesses),
        console.error,
    );
    break;
}
