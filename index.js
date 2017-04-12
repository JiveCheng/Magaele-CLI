var promise = require('promise');
var program = require('commander');
var path = require('path');
var url = require('url');
var readline = require('readline');
var svnUltimate = require('node-svn-ultimate');
var deepExtend = require('deep-extend');

var rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});

var MAGAELELIB = function(options) {
	this.localPath = path.resolve();
	this.repositoryUrl = options.repositoryUrl;
	this.moduleLocalRoot = '';
	this.moduleRemoteRoot = '';
	this.moduelReleaseRelativeRoot = '.';
};

MAGAELELIB.DEFAULTS = {
	localPath: path.resolve(),
	repositoryUrl: 'http://svn.liontech.com.tw/svn/liondesignrepo/magaele/'
};

MAGAELELIB.prototype.svnGetModuleRoot = function( remoteLocal ) {
	var returnPath;
	if ( typeof remoteLocal === 'string' ) {
		svnUltimate.commands.list(this.repositoryUrl, function(err, json) {
			// console.log(this);
			var currentLocationArray = path.resolve().split(path.sep);
			var loadRemoteModules = MAGALIB.listRemoteModules(json.list.entry);
			var currentMatchRemote = currentLocationArray.filter(function(string) {
				return loadRemoteModules.indexOf(string) !== -1;
			});
			if ( currentMatchRemote.length === 1 ) {
				if ( remoteLocal === 'local' ) {
					path = currentLocationArray.slice( 0, currentLocationArray.indexOf( currentMatchRemote.toString() ) + 1 ).join(path.sep);
				} else if ( remoteLocal === 'remote' ) {
					path = url.resolve(MAGALIB.repositoryUrl, currentMatchRemote.toString());
				}
			} else if ( currentMatchRemote.length > 1 ) {
				MAGALIB.logError('Mateched tow string:', currentMatchRemote);
			} else {
				MAGALIB.logError(0);
			}
		});
	}
	return returnPath;
};

MAGAELELIB.prototype.listRemoteModules = function( data ) {
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
	// console.log(list);
	return list;
};

MAGAELELIB.prototype.loadReleaseList = function( data ) {
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

MAGAELELIB.prototype.versionCompare = function( v1, v2, options ) {
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

MAGAELELIB.prototype.defaultNextVersion = function( lastV ) {
	var versionParts = lastV.split('.');
	var vArr = [
		versionParts[0],
		parseInt(versionParts[1]),
		parseInt(versionParts[2]) + 1
	];
	return vArr.join('.');
};

MAGAELELIB.prototype.logError = function( string, value ) {
	var logString;
	if ( typeof string === 'number' ) {
		switch ( string ) {
			case 0:
				string = 'error: There is no module in this folder';
			break;
			case 1:
				string = 'error: This folder has not yet push to remote';
			break;
			case 2:
				string = 'error: There are files yet to push to remote';
			break;
		}
		console.log( string );
	} else if ( !!string && !!value ) {
		console.log( string, value );
	} else {
		console.log( string );
	}
	process.exit(1);
};

MAGAELELIB.prototype.svnGetLocalStatus = function() {
	var self = this;
	svnUltimate.commands.status('./', function(err, json) {
		console.log(JSON.stringify(json, null, 2));
		if ( !!json.target.entry ) {
			if ( Array.isArray(json.target.entry) ) {
				var hasModified = json.target.entry.find(function(item) {
					return item['wc-status'].$.item === 'modified';
				});
				if ( !hasModified ) {
					self.svnGetInitData();
				} else {
					MAGALIB.logError(2);
				}
			} else {

				MAGALIB.logError(1);
			}
		} else {
			MAGALIB.logError(0);
		}
	});
};

MAGAELELIB.prototype.svnGetInitData = function() {
	MAGALIB.moduleLocalRoot = MAGALIB.svnGetModuleRoot('local');
	svnUltimate.commands.list( MAGALIB.repositoryUrl, function(err, json) {
		

		// console.log(currentModuleRootPath);
		console.log( MAGALIB );
		
	} );
};
// RELEASE VSERSION ON REMOTE
/*svnUltimate.commands.copy(
	'http://svn.liontech.com.tw/svn/liondesignrepo/magaele/core/develop',
	'http://svn.liontech.com.tw/svn/liondesignrepo/magaele/core/release/v1.0.0',
	{
		params: [ '-m "release test"' ]
	}, function( err ) {
		console.log( "release complete" );

	}
);*/

var MAGALIB = new MAGAELELIB( function( EXTENDEDOPTS, DEFAULTS, NEW ){

	deepExtend( EXTENDEDOPTS, DEFAULTS, NEW );
	return EXTENDEDOPTS;
}({}, MAGAELELIB.DEFAULTS, {}) );

// DEFINE COMMANDER
program
	.version('0.0.1')
	.option('-p, --publish', 'publish module', function() {
		var Q = {

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
			rl.question('請問本次要release的版本號為？(' + MAGALIB.defaultNextVersion( lastVersion ) + ')', function(userVersion) {
				console.log(lastVersion, defaultNextVersion, userVersion);
			});
		};
		MAGALIB.svnGetLocalStatus();
		// GET REMOTE ALL RELEASE VERSION
		/*svnUltimate.commands.list('http://svn.liontech.com.tw/svn/liondesignrepo/magaele/core/release', function(err2, json) {
			var loadReleaseList = MAGALIB.loadReleaseList(json.list.entry);
			// console.log(loadReleaseList);
			// questionReleasePath( questionVersion.bind(this, loadReleaseList[loadReleaseList.length - 1]) );
		});*/

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