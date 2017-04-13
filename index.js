var Promise = require('promise');
var program = require('commander');
var path = require('path');
var url = require('url');
var urljoin = require('url-join');
var readline = require('readline');
var svnUltimate = require('node-svn-ultimate');
var deepExtend = require('deep-extend');

var rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});

var MAGAELELIB = function(options) {
	this.localPathRegex = options.localPathRegex;
	this.remotePathRegex = options.remotePathRegex;
	this.standardSvnFlow = options.standardSvnFlow;
	this.localPath = options.localPath;
	this.repositoryUrl = options.repositoryUrl;
	this.moduleLocalRoot = '';
	this.moduleRemoteRoot = '';
	this.moduelDevelopRelativeRoot = '.';
	this.moduelReleaseRelativeRoot = '.';
	this.moduleRemoteDevelopPath = '';
	this.moduleRemoteReleasePath = '';
	this.moduleReleaseVersionList = [];
	this.moduleReleaseLastVersion = '';
};

MAGAELELIB.DEFAULTS = {
	localPath: path.resolve(),
	localPathRegex: /([A-Z|a-z]:\\[^*|"<>?\n]*)|(\\\\.*?\\.*)/,
	remotePathRegex: /(http[s]?:\/\/)?([^\/\s]+\/)(.*)/,
	repositoryUrl: 'http://svn.liontech.com.tw/svn/liondesignrepo/magaele/',
	standardSvnFlow: false,
};

MAGAELELIB.prototype.listRemoteToArray = function( data, kindFilter ) {
	// console.log(JSON.stringify(data, null, 2), Array.isArray(data));
	var list = [];
	var conditionDir;
	if ( Array.isArray(data) ) {
		for (var i = 0; i < data.length; i++) {
			conditionDir = data[i].$.kind === kindFilter;
			if ( !!kindFilter && conditionDir ) {
				list.push(data[i].name);
			} else {
				list.push(data[i].name);
			}
		}
	} else if ( typeof data === 'object' ) {
		conditionDir = data.$.kind === kindFilter;
		if ( !!kindFilter && conditionDir ) {
			list.push(data.name);
		} else {
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
			case 3:
				string = 'error: System error';
			break;
			case 4:
				string = 'error: There are files yet to add to remote:\n' + value;
			break;
			case 5:
				string = 'error: The operation is interrupted by the user';
			break;
			case 6:
				string = 'error: Commit log is required';
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
	return new Promise(function(resolve, reject){
		svnUltimate.commands.status('./', function(err, json) {
			// console.log(JSON.stringify(err, null, 2), JSON.stringify(json, null, 2));
			var modifieds, unversions, deleteds;
			if ( !!err && err !== null ) {
				reject(err);
				self.logError(3);
			} else {
				// console.log(self.localPathRegex.test(self.moduleLocalRoot));
				if ( !!json && !!json.target.entry ) {
					if ( Array.isArray(json.target.entry) ) {
						modifieds = json.target.entry.filter(function(item) {
							return item['wc-status'].$.item === 'modified';
						}).map(function(obj) {
							return obj.$.path;
						});
						unversions = json.target.entry.filter(function(item) {
							return item['wc-status'].$.item === 'unversioned';
						}).map(function(obj) {
							return obj.$.path;
						});
						deleteds = json.target.entry.filter(function(item) {
							return item['wc-status'].$.item === 'deleted';
						}).map(function(obj) {
							return obj.$.path;
						});
						// console.log(modifieds, unversions, deleteds);

						if ( !!unversions && unversions.length > 0 ) {
							resolve( {
								status: 'hasUnversioned',
								files: unversions
							} );
						} else if ( !!deleteds && unversions.length > 0) {
							resolve( {
								status: 'hasDeleted',
								files: deleteds
							} );
						} else if ( !!modifieds && modifieds.length > 0 ) {
							resolve( {
								status: 'hasModified',
								files: modifieds
							} );
						}
					} else if ( typeof json.target.entry === 'object' ) {
						if ( json.target.entry['wc-status'].$.item === 'modified' ) {
							modifieds = json.target.entry.$.path;
						} else if( json.target.entry['wc-status'].$.item === 'unversioned' ) {
							unversions = json.target.entry.$.path;
						} else if( json.target.entry['wc-status'].$.item === 'deleted' ) {
							deleteds = json.target.entry.$.path;
						}
						// console.log(modifieds, unversions, deleteds);
						if ( !!unversions ) {
							resolve( {
								status: 'hasUnversioned',
								files: unversions
							} );
						} else if ( !!deleteds ) {
							resolve( {
								status: 'hasDeleted',
								files: deleteds
							} );
						} else if ( !!modifieds ) {
							resolve( {
								status: 'hasModified',
								files: modifieds
							} );
						}
					} else {
						self.logError(1);
					}
				} else if ( self.localPathRegex.test(self.moduleLocalRoot) ) {
					resolve({
						status: 'READY',
						files: null
					});
				} else {
					self.logError(0);
				}
			}
		});
	});
};

MAGAELELIB.prototype.svnGetList = function( dirOption ) {
	var self = this,
		dir;
	if ( typeof dirOption === 'string' && dirOption === 'ROOTPATH' ) {
		dir = this.repositoryUrl;
	} else {
		dir = dirOption;
	}
	return new Promise(function(resolve, reject){
		svnUltimate.commands.list(dir, function(err, json) {
			// console.log(JSON.stringify(err, null, 2), JSON.stringify(json, null, 2));
			var currentLocationArray, loadRemoteModules, currentMatchRemote;
			if ( !!err && err !== null ) {
				reject(err);
				self.logError(3);
			} else {
				if ( dirOption === 'ROOTPATH' ) {
					currentLocationArray = path.resolve().split(path.sep);
					loadRemoteModules = self.listRemoteToArray(json.list.entry, 'dir');
					currentMatchRemote = currentLocationArray.filter(function(string) {
						return loadRemoteModules.indexOf(string) !== -1;
					});
					// console.log(currentLocationArray, loadRemoteModules, currentMatchRemote);
					if ( currentMatchRemote.length === 1 ) {
						resolve( {
							localPath: currentLocationArray.slice( 0, currentLocationArray.indexOf( currentMatchRemote.toString() ) + 1 ).join(path.sep),
							remotePath: url.resolve(self.repositoryUrl, currentMatchRemote.toString())
						} );
					} else if ( currentMatchRemote.length > 1 ) {
						self.logError('Mateched tow string:', currentMatchRemote);
					} else {
						self.logError(0);
					}					
				} else {
					loadRemoteList = self.listRemoteToArray(json.list.entry);
					resolve( loadRemoteList );
				}
			}
		});
	});
};

MAGAELELIB.prototype.svnCommit = function( logString ) {
	return new Promise(function(resolve, reject) {
		svnUltimate.commands.commit('./', {
			params: [ '-m "' + logString + '"' ]
		}, function(err, json) {
			if ( !!err && err !== null ) {
				reject(err);
				self.logError(3);
			} else {
				console.log(json);
				resolve( true );
			}
		});
	});
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

MAGAELELIB.prototype.questionNeedCommit = function( needCommitFiles ) {
	return new Promise(function(resolve, reject){
		rl.question('還有檔案未Commit：\n' + needCommitFiles + '\n要Commit嗎？(y/n)', function( answer ) {
			if ( answer === 'y' || answer === 'yes' ) {
				resolve( true );
			} else {
				reject( false );
			}
		});
	});
};

MAGAELELIB.prototype.questionCommitLog = function() {
	return new Promise(function(resolve, reject){
		rl.question('請問這次Commit的Log？', function( logString ) {
			if ( !!logString && logString.length > 4 ) {
				resolve( logString );
			} else {
				reject( false );
			}
		});
	});
};

MAGAELELIB.prototype.questionReadyRelease = function() {
	var self = this;
	// console.log(self, self.moduleRemoteRoot);
	return new Promise(function(resolve, reject){
		var developPath = urljoin( self.moduleRemoteRoot, self.moduelDevelopRelativeRoot );
		rl.question('可以發佈了！請問你的develop目錄？(' + developPath + ')', function( pathAnswer ) {
			if ( !!pathAnswer && pathAnswer.length > 0 ) {
				resolve( url.resolve( developPath, pathAnswer ) );
			} else {
				resolve( developPath );
			}
		});
	});
};

MAGAELELIB.prototype.questionReleasePath = function() {
	var self = this;
	return new Promise(function(resolve, reject){
		var releasePath = urljoin( self.moduleRemoteRoot, self.moduelReleaseRelativeRoot );
		rl.question('請確認你的release目錄(' + releasePath + ')', function( pathAnswer ) {
			if ( !!pathAnswer && pathAnswer.length > 0 ) {
				resolve( url.resolve( releasePath, pathAnswer ) );
			} else {
				resolve( releasePath );
			}
		});
	});
};

MAGAELELIB.prototype.questionReleaseVersion = function() {
	var self = this;
	return new Promise(function(resolve, reject){
		var releasePath = urljoin( self.moduleRemoteRoot, self.moduelReleaseRelativeRoot );
		rl.question('請問本次要release的版本號為？(' + MAGALIB.defaultNextVersion( lastVersion ) + ')', function(userVersion) {
			console.log(lastVersion, defaultNextVersion, userVersion);
		});
	});
};

var MAGALIB = new MAGAELELIB( function( EXTENDEDOPTS, DEFAULTS, NEW ){
	deepExtend( EXTENDEDOPTS, DEFAULTS, NEW );
	return EXTENDEDOPTS;
}({}, MAGAELELIB.DEFAULTS, {}) );

// DEFINE COMMANDER
program
	.version('0.0.1')
	.option('-p, --publish', 'publish module', function() {
		MAGALIB.svnGetList('ROOTPATH').then(function( returnPath ) {
			// console.log('ROOTPATH:',returnPath);
			MAGALIB.moduleLocalRoot = returnPath.localPath;
			MAGALIB.moduleRemoteRoot = returnPath.remotePath;
			return MAGALIB.svnGetList( MAGALIB.moduleRemoteRoot );
		}).then(function( remoteList ) {
			// console.log('remoteList:', remoteList);
			if ( remoteList.indexOf('develop') !== -1 ) {
				MAGALIB.moduelDevelopRelativeRoot = '/develop';
				MAGALIB.moduelReleaseRelativeRoot = '/release';
				MAGALIB.standardSvnFlow = true;
			} else {
				MAGALIB.moduelDevelopRelativeRoot = '/';
				MAGALIB.moduelReleaseRelativeRoot = '/';
			}
			return MAGALIB.svnGetLocalStatus();
		}).then(function( status ) {
			// console.log('status:', status);
			if ( status.status === 'hasUnversioned' ) {
				MAGALIB.logError(4, status.files);
			} else if ( status.status === 'hasDeleted' ) {
				MAGALIB.logError(4, status.files);
			} else if ( status.status === 'hasModified' ) {
				MAGALIB.questionNeedCommit( status.files ).then(function( answer ) {
					// console.log( answer );
					return MAGALIB.questionCommitLog();
				}, function( answer ) {
					MAGALIB.logError(5);
				}).then(function( logString ) {
					// console.log( logString );
					return MAGALIB.svnCommit( logString );
				}, function( err ) {
					MAGALIB.logError(6);
				}).then(function( commitSuccess ) {
					console.log( commitSuccess );
				});
			} else if ( status.status === 'READY' ) {
				return MAGALIB.questionReadyRelease();
			} else {
				MAGALIB.logError(3, status.files);
			}
		}).then(function( developPath ) {
			// console.log(developPath);
			MAGALIB.moduleRemoteDevelopPath = developPath;
			return MAGALIB.questionReleasePath();
		}).then(function( releasePath ) {
			// console.log(releasePath);
			MAGALIB.moduleRemoteReleasePath = releasePath;
			return MAGALIB.svnGetList( MAGALIB.moduleRemoteReleasePath );
		}).then(function( versionArray ) {
			// console.log(versionArray);
			MAGALIB.moduleReleaseVersionList = versionArray;
			MAGALIB.moduleReleaseLastVersion = versionArray[versionArray.length - 1];
			return MAGALIB.questionReleaseVersion();
		});
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
};