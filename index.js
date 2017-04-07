var program = require('commander');
var path = require('path');
var readline = require('readline');
var svnUltimate = require('node-svn-ultimate');

var rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});


// svnUltimate.commands.copy(
// 	'http://svn.liontech.com.tw/svn/liondesignrepo/magaele/core/develop',
// 	'http://svn.liontech.com.tw/svn/liondesignrepo/magaele/core/release/v1.0.0',
// 	{
// 		params: [ '-m "release test"' ]
// 	}, function( err ) {
//     	console.log( "release complete" );

// 	}
// );

program
	.version('0.0.1')
	.usage('[options]')
	.option('-p, --publish', 'publish module', function() {
		rl.question('請問要release的來源目錄？(' + path.resolve() + ')', function(version) {

		  console.log('Thank you for your valuable feedback:' + version );

		  rl.close();
		});
	})
	.option('-h, --help', 'helper')
	.parse(process.argv);

program.on('--help', function(){
  console.log('  Examples:');
  console.log('');
  console.log('    $ custom-help --help');
  console.log('    $ custom-help -h');
  console.log('');
});
if ( !program.rawArgs[2] ) {
	program.help();
}