var path = require('path');
var url = require('url');
var fs = require('fs');
var exec = require('child_process').exec;
var Promise = require('promise');
var program = require('commander');
var urljoin = require('url-join');
var readline = require('readline');
var deepExtend = require('deep-extend');

var Publisher = require('gitflow-publisher');
var GitflowNpmPublisher = require('gitflow-publisher-npm');

var publisher = new Publisher();

// DEFINE COMMANDER
program
	.version('0.0.1')
	.option('-p, --publish', 'publish module', function() {
		var prepareRelease = function() {

		};
		var startRelease = function() {

		};
		var startCommit = function( status ) {

		};
		var startInit = function() {

		};
		publisher.use(new GitflowNpmPublisher({
		    name: '@magaele/core',
		  	registry: 'ltc-04407-0125.lionmail.com:4873'
		}));
		publisher.publish({
			branch: 'develop',
			commit: true,
			release: true,
			checkout: true
		});

	})
	.option('-l, --list', 'module list', function() {
		
	})
	.option('-c, --create', 'create module', function() {
		
	})
	.parse(process.argv);

program.on('--help', function(){
	console.log('  Examples:');
	console.log('');
	console.log('    $ magaele --publish');
	console.log('    $ magaele -p');
	console.log('');
});
if ( !program.rawArgs[2] ) {
	program.help();
}