var program = require('commander');
var path = require('path');
var readline = require('readline');
var svnUltimate = require('node-svn-ultimate');

var rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});

var svnSetting = {
	repositoryUrl: 'http://svn.liontech.com.tw/svn/liondesignrepo/magaele/'
};
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
	.option('-p, --publish', 'publish module', function() {
		var currentLocationArray = path.resolve().split(path.sep);
		var loadReleaseList = function( data ) {
			// console.log(JSON.stringify(data, null, 2), Array.isArray(data));
			var list = [];
			var dirMatchRegex = /v\d+.\d+.\d+/;
			var conditionName;
			var conditionDir;
			if ( Array.isArray(data) ) {
				for (var i = 0; i < data.length; i++) {
					conditionName = dirMatchRegex.test(data[i].name);
					conditionDir = data[i].$.kind === 'dir';
					if ( conditionName && conditionDir ) {
						list.push(data[i].name);
					}
				}
			} else if ( typeof data === 'object' ) {
				conditionName = dirMatchRegex.test(data.name);
				conditionDir = data.$.kind === 'dir';
				if ( conditionName && conditionDir ) {
					list.push(data.name);
				}
			}
			return list;
		};
		var loadRemoteModules = function( data ) {
			// console.log(JSON.stringify(data, null, 2), Array.isArray(data));
			var list = [];
			var conditionDir;
			if ( Array.isArray(data) ) {
				for (var i = 0; i < data.length; i++) {
					conditionDir = data[i].$.kind === 'dir';
					if ( conditionDir ) {
						list.push(data[i].name);
					}
				}
			} else if ( typeof data === 'object' ) {
				conditionDir = data.$.kind === 'dir';
				if ( conditionDir ) {
					list.push(data.name);
				}
			}
			return list;
		};
		var questionReleasePath = function( nextHandler ) {
			rl.question('請問將要release的來源develop目錄？(' + path.resolve() + ')', function(userPath) {
				var p = userPath || path.resolve();
				var pathVerify = /([a-zA-Z]:)?(\\[\sa-zA-Z0-9_-]+)+\\?/.test(p);
				if ( pathVerify ) {
					console.log('你將要release的目錄為：' + p );
					nextHandler();
				} else {
					console.log('你輸入的不是一個目錄路徑');
				}
			});
		};
		var questionVersion = function ( lastVersion, nextHandler ) {
			var versionCompare = function( v1, v2, options ) {
				var lexicographical = options && options.lexicographical,
						zeroExtend = options && options.zeroExtend,
						v1parts = v1.split('.'),
						v2parts = v2.split('.');

				function isValidPart(x) {
					return (lexicographical ? /^\d+[A-Za-z]*$/ : /^\d+$/).test(x);
				}

				if (!v1parts.every(isValidPart) || !v2parts.every(isValidPart)) {
					return NaN;
				}

				if (zeroExtend) {
					while (v1parts.length < v2parts.length) v1parts.push("0");
					while (v2parts.length < v1parts.length) v2parts.push("0");
				}

				if (!lexicographical) {
					v1parts = v1parts.map(Number);
					v2parts = v2parts.map(Number);
				}

				for (var i = 0; i < v1parts.length; ++i) {
					if (v2parts.length == i) {
						return 1;
					}

					if (v1parts[i] == v2parts[i]) {
						continue;
					}
					else if (v1parts[i] > v2parts[i]) {
						return 1;
					}
					else {
						return -1;
					}
				}

				if (v1parts.length != v2parts.length) {
					return -1;
				}

				return 0;
			};
			var defaultNextVersion = function( lastV ) {
				var versionParts = lastV.split('.');
				var vArr = [
					versionParts[0],
					parseInt(versionParts[1]),
					parseInt(versionParts[2]) + 1
				];
				return vArr.join('.');
			}( lastVersion );
			rl.question('請問本次要release的版本號為？(' + defaultNextVersion + ')', function(userVersion) {

				console.log(lastVersion, defaultNextVersion, userVersion);
			});
		};

		svnUltimate.commands.list(svnSetting.repositoryUrl, function(err, json) {
			loadRemoteModules = loadRemoteModules(json.list.entry);
			var currentMatchRemote = currentLocationArray.filter(function(string) {
				return loadRemoteModules.indexOf(string) !== -1;
			});
			if ( currentMatchRemote.length === 1 ) {
				var currentModuleRootPath = currentLocationArray.slice( 0, currentLocationArray.indexOf( currentMatchRemote.toString() ) + 1 ).join(path.sep);
				
			} else if ( currentMatchRemote.length > 1 ) {
				console.log('mateched tow string:', currentMatchRemote);
			} else {
				console.log('error');
			}
			console.log(currentModuleRootPath);
		});
		// svnUltimate.commands.list('http://svn.liontech.com.tw/svn/liondesignrepo/magaele/core/release', function(err2, json) {
		// 	loadReleaseList = loadReleaseList(json.list.entry);
		// 	// console.log(loadReleaseList);
		// 	// questionReleasePath( questionVersion.bind(this, loadReleaseList[loadReleaseList.length - 1]) );
		// });

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