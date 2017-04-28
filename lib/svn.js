var path = require('path');
var url = require('url');
var fs = require('fs');
var exec = require('child_process').exec;
var Promise = require('promise');
var program = require('commander');
var urljoin = require('url-join');
var readline = require('readline');
var svnUltimate = require('node-svn-ultimate');
var deepExtend = require('deep-extend');

var rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});

var MAGAELESVNLIB = function(options) {
	this.localPathRegex = options.localPathRegex;
	this.remotePathRegex = options.remotePathRegex;
	this.standardSvnFlow = options.standardSvnFlow;
	this.localPath = options.localPath;
	this.repositoryUrl = options.repositoryUrl;
	this.moduleName = '';
	this.moduleLocalRoot = '';
	this.moduleRemoteRoot = '';
	this.moduelDevelopRelativeRoot = '.';
	this.moduelReleaseRelativeRoot = '.';
	this.moduleLocalDevelopPath = '';
	this.moduleRemoteDevelopPath = '';
	this.moduleLocalReleasePath = '';
	this.moduleRemoteReleasePath = '';
	this.moduleReleaseVersionList = [];
	this.moduleReleaseLastVersion = '';
	this.moduleReleaseNextVersion = '';
	this.versionMatchRegex = options.versionMatchRegex;
};

MAGAELESVNLIB.DEFAULTS = {
	localPath: path.resolve(),
	localPathRegex: /([A-Z|a-z]:\\[^*|"<>?\n]*)|(\\\\.*?\\.*)/,
	remotePathRegex: /(http[s]?:\/\/)?([^\/\s]+\/)(.*)/,
	versionMatchRegex: /v\d+.\d+.\d+/,
	repositoryUrl: 'http://svn.liontech.com.tw/svn/liondesignrepo/magaele/',
	standardSvnFlow: false,
};

MAGAELESVNLIB.prototype.listRemoteToArray = function( data, kindFilter ) {
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

MAGAELESVNLIB.prototype.loadReleaseList = function( data ) {
	// console.log(JSON.stringify(data, null, 2), Array.isArray(data));
	var list = [];
	var dirMatchRegex = this.versionMatchRegex;
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

MAGAELESVNLIB.prototype.versionCompare = function( v1, v2, options ) {
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

MAGAELESVNLIB.prototype.defaultNextVersion = function( lastV ) {
	var versionParts = lastV.split('.');
	var vArr = [
		versionParts[0],
		parseInt(versionParts[1]),
		parseInt(versionParts[2]) + 1
	];
	return vArr.join('.');
};

MAGAELESVNLIB.prototype.hasPackageJson = function( pathString ) {
	var targetPath = function(dirPath, fileName){
		var dir = dirPath;
		return path.join( dir, './package.json' );
	}(pathString || this.moduleLocalDevelopPath);
	return fs.existsSync( targetPath );
};

MAGAELESVNLIB.prototype.logError = function( string, value ) {
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

MAGAELESVNLIB.prototype.npmPublish = function( targetPath ) {
	var self = this;
	return new Promise(function(resolve, reject){
		// console.log( path.join( self.moduleLocalReleasePath, self.moduleReleaseNextVersion ) );
		exec( 'npm publish ' + path.join( self.moduleLocalReleasePath, self.moduleReleaseNextVersion ), function( error, stdout, stderr ) {
			if (error) {
				reject( false );
			} else {
				resolve( true );
			}
		} );
	});
};

MAGAELESVNLIB.prototype.svnGetLocalStatus = function() {
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
						} else {
							self.logError(3);
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
						} else {
							self.logError(3);
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

MAGAELESVNLIB.prototype.svnGetModuleRoot = function() {
	var self = this;
	return new Promise(function(resolve, reject){
		svnUltimate.commands.list(self.repositoryUrl, function(err, json) {
			// console.log(JSON.stringify(err, null, 2), JSON.stringify(json, null, 2));
			var currentLocationArray, loadRemoteModules, currentMatchRemote;
			if ( !!err && err !== null ) {
				reject(err);
				self.logError(3);
			} else {
				currentLocationArray = path.resolve().split(path.sep);
				loadRemoteModules = self.listRemoteToArray(json.list.entry, 'dir');
				currentMatchRemote = currentLocationArray.filter(function(string) {
					return loadRemoteModules.indexOf(string) !== -1;
				});
				// console.log(currentLocationArray, loadRemoteModules, currentMatchRemote);
				if ( currentMatchRemote.length === 1 ) {
					self.moduleName = currentMatchRemote;
					resolve( {
						localPath: currentLocationArray.slice( 0, currentLocationArray.indexOf( currentMatchRemote.toString() ) + 1 ).join(path.sep),
						remotePath: url.resolve(self.repositoryUrl, currentMatchRemote.toString())
					} );
				} else if ( currentMatchRemote.length > 1 ) {
					self.logError('Mateched tow string:', currentMatchRemote);
				} else {
					self.logError(0);
				}
			}
		});
	});
};

MAGAELESVNLIB.prototype.svnGetList = function( dirOption ) {
	var self = this,
		dir = dirOption || this.repositoryUrl;
	return new Promise(function(resolve, reject){
		svnUltimate.commands.list(dir, function(err, json) {
			// console.log(JSON.stringify(err, null, 2), JSON.stringify(json, null, 2));
			var loadRemoteList;
			if ( !!err && err !== null ) {
				reject(err);
				self.logError(3);
			} else {
				loadRemoteList = self.listRemoteToArray(json.list.entry);
				resolve( loadRemoteList );
			}
		});
	});
};

MAGAELESVNLIB.prototype.svnCommit = function( logString ) {
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

MAGAELESVNLIB.prototype.svnRelease = function( targetUrl ) {
	// RELEASE VSERSION ON REMOTE
	var self = this;
	return new Promise(function(resolve, reject) {
		if ( !targetUrl ) {
			reject( false );
		}
		svnUltimate.commands.copy(
			self.moduleRemoteDevelopPath,
			targetUrl,
			{
				params: [ '-m "release module ' + self.moduleName + ' ' + self.moduleReleaseNextVersion + '"' ]
			}, function( err, json ) {
				resolve( targetUrl );
			}
		);
	});
};

MAGAELESVNLIB.prototype.svnUpdate = function( targetPath ) {
	// RELEASE VSERSION ON REMOTE
	var self = this;
	return new Promise(function(resolve, reject) {
		if ( !targetPath ) {
			reject( false );
		}
		svnUltimate.commands.update(
			targetPath,
			{
				depth: 'infinity'
			}, function( err ) {
				if ( !!err ) {
					reject( err );
				} else {
					resolve( true );
				}
			}
		);
	});
};

MAGAELESVNLIB.prototype.packageJsonEditor = function( object ) {
	var self = this;
	return new Promise(function(resolve, reject) {
		fs.readFile(path.join(self.moduleLocalDevelopPath, 'package.json'), function (err, data) {
			var jsonData;
			var nextVersion = object.version || self.moduleReleaseNextVersion;
			if ( err ) {
				reject( '開啟package.json錯誤！' );
			} else{
				jsonData = JSON.parse(data);
				deepExtend( jsonData, object );
				resolve(jsonData);
			}
		});
	});
};

MAGAELESVNLIB.prototype.packageJsonSaver = function( data ) {
	var self = this;
	return new Promise(function(resolve, reject) {
		fs.writeFile( path.join(self.moduleLocalDevelopPath, 'package.json') , JSON.stringify(data, null, 2), function( err ) {
			if( err ) {
				reject( false );
			} else {
				resolve( true );
			}
		} );
	});
};

MAGAELESVNLIB.prototype.questionNeedCommit = function( needCommitFiles ) {
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

MAGAELESVNLIB.prototype.questionCommitLog = function() {
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

MAGAELESVNLIB.prototype.questionReadyRelease = function() {
	var self = this;
	// console.log(self, self.moduleRemoteRoot);
	return new Promise(function(resolve, reject){
		var developRemotePath = urljoin( self.moduleRemoteRoot, self.moduelDevelopRelativeRoot );
		var developLocalPath = path.join( self.moduleLocalRoot, self.moduelDevelopRelativeRoot );
		// console.log(developRemotePath, developLocalPath);
		rl.question('可以發佈了！請問你的develop目錄？(' + developRemotePath + ')', function( pathAnswer ) {
			if ( !!pathAnswer && pathAnswer.length > 0 ) {
				resolve( {
					remote: url.resolve( developRemotePath, pathAnswer ),
					local: path.resolve( developLocalPath, pathAnswer )
				} );
			} else {
				resolve( {
					remote: developRemotePath,
					local: developLocalPath
				} );
			}
		});
	});
};

MAGAELESVNLIB.prototype.questionReleasePath = function() {
	var self = this;
	return new Promise(function(resolve, reject){
		var releaseRemotePath = urljoin( self.moduleRemoteRoot, self.moduelReleaseRelativeRoot );
		var releaseLocalPath = path.join( self.moduleLocalRoot, self.moduelReleaseRelativeRoot );
		// console.log(releaseRemotePath, releaseLocalPath);
		rl.question('請確認你的release目錄(' + releaseRemotePath + ')', function( pathAnswer ) {
			if ( !!pathAnswer && pathAnswer.length > 0 ) {
				resolve( {
					remote: url.resolve( releaseRemotePath, pathAnswer ),
					local: path.resolve( releaseLocalPath, pathAnswer )
				} );
			} else {
				resolve( {
					remote: releaseRemotePath,
					local: releaseLocalPath
				} );
			}
		});
	});
};

MAGAELESVNLIB.prototype.questionReleaseVersion = function() {
	var self = this;
	return new Promise(function(resolve, reject){
		var lastVersion = MAGALIB.moduleReleaseLastVersion;
		var defaultNextVersion = MAGALIB.defaultNextVersion( lastVersion );
		var releaseVersion;
		rl.question('請問本次要release的版本號為？(' + defaultNextVersion + ')', function( userVersion ) {
			// console.log(userVersion);
			if ( typeof userVersion === 'string' && userVersion.length === 0 ) {
				releaseVersion = defaultNextVersion;
			} else {
				releaseVersion = userVersion;
			}
			// console.log(releaseVersion);
			if ( self.versionMatchRegex.test( releaseVersion ) ) {
				if ( self.versionCompare( lastVersion.slice(1), releaseVersion.slice(1) ) === -1 ) {
					resolve( releaseVersion );
				} else {
					reject( '你所輸入的版本號不可小於' + lastVersion );
				}
			} else {
				reject( '你所輸入的版本號錯誤，格式為：v0.0.0' );
			}
			// console.log(lastVersion, defaultNextVersion, userVersion);
		});
	});
};



var MAGALIB = new MAGAELESVNLIB( function( EXTENDEDOPTS, DEFAULTS, NEW ){
	deepExtend( EXTENDEDOPTS, DEFAULTS, NEW );
	return EXTENDEDOPTS;
}({}, MAGAELESVNLIB.DEFAULTS, {}) );

module.exports = MAGALIB;

/*program
	.version('0.0.1')
	.option('-p, --publish', 'publish module', function() {
		var prepareRelease = function() {
			MAGALIB.questionReadyRelease()
			.then(function( developPath ) {
				console.log('你的remote develop目錄為：', developPath.remote);
				console.log('你的local develop目錄為：', developPath.local);
				MAGALIB.moduleRemoteDevelopPath = developPath.remote;
				MAGALIB.moduleLocalDevelopPath = developPath.local;
				if ( MAGALIB.hasPackageJson() ) {
					return MAGALIB.questionReleasePath();
				} else {
					MAGALIB.logError('沒有發現package.json檔，請執行npm init');
				}
			})
			.then(function( releasePath ) {
				console.log('你的remote release目錄為：', releasePath.remote);
				console.log('你的local release目錄為：', releasePath.local);
				MAGALIB.moduleRemoteReleasePath = releasePath.remote;
				MAGALIB.moduleLocalReleasePath = releasePath.local;
				return MAGALIB.svnGetList( MAGALIB.moduleRemoteReleasePath );
			})
			.then(function( versionArray ) {
				// console.log(versionArray);
				if ( versionArray.length > 0 ) {
					MAGALIB.moduleReleaseVersionList = versionArray;
					MAGALIB.moduleReleaseLastVersion = versionArray[versionArray.length - 1];
				} else {
					MAGALIB.moduleReleaseVersionList = [];
					MAGALIB.moduleReleaseLastVersion = 'v0.0.0';
				}
				startRelease();
				// console.log(MAGALIB.moduleReleaseVersionList, MAGALIB.moduleReleaseLastVersion);
			});
		};
		var startRelease = function() {
			MAGALIB.questionReleaseVersion()
			.then(function( releaseVersion ) {
				console.log('你的release版本號為：', releaseVersion);
				MAGALIB.moduleReleaseNextVersion = releaseVersion;
				return MAGALIB.packageJsonEditor( {
					version: MAGALIB.moduleReleaseNextVersion,
					repository: {
						type: 'svn',
						url: urljoin( MAGALIB.moduleRemoteReleasePath, MAGALIB.moduleReleaseNextVersion )
					}
				} );
			}, function( errString ) {
				console.log( errString );
				startRelease();
			})
			.then(function( packageData ) {
				// console.log( packageData );
				return MAGALIB.packageJsonSaver( packageData );
			}, function( errString ) {
				MAGALIB.logError( errString );
			})
			.then(function( successBoolean ) {
				// console.log( successBoolean );
				return MAGALIB.svnCommit('package.json modified before magaele publish');
			})
			.then(function() {
				// console.log( successBoolean );
				return MAGALIB.svnRelease( urljoin( MAGALIB.moduleRemoteReleasePath, MAGALIB.moduleReleaseNextVersion ) );
			}, function( err ) {
				MAGALIB.logError(3);
			})
			.then(function() {
				return MAGALIB.svnUpdate( MAGALIB.moduleLocalReleasePath );
			})
			.then(function() {
				console.log('svn發佈操作完成，開始npm發佈…');
				return MAGALIB.npmPublish();
			}, function( err ) {
				console.log( err );
			})
			.then(function( successBoolean ) {
				console.log('npm發佈完成！');
				process.exit(1);
			});
		};
		var startCommit = function( status ) {
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
				prepareRelease();
			});
		};
		var startInit = function() {
			MAGALIB.svnGetModuleRoot().then(function( returnPath ) {
				// console.log('ROOTPATH:',returnPath);
				MAGALIB.moduleLocalRoot = returnPath.localPath;
				MAGALIB.moduleRemoteRoot = returnPath.remotePath;
				return MAGALIB.svnGetList( MAGALIB.moduleRemoteRoot );
			})
			.then(function( remoteList ) {
				// console.log('remoteList:', remoteList);
				if ( remoteList.indexOf('develop') !== -1 ) {
					MAGALIB.moduelDevelopRelativeRoot = '/develop';
					MAGALIB.moduelReleaseRelativeRoot = '/release';
					MAGALIB.standardSvnFlow = true;
				} else {
					MAGALIB.moduelDevelopRelativeRoot = '/';
					MAGALIB.moduelReleaseRelativeRoot = '/release';
				}
				return MAGALIB.svnGetLocalStatus();
			})
			.then(function( status ) {
				// console.log('status:', status);
				if ( status.status === 'hasUnversioned' ) {
					MAGALIB.logError(4, status.files);
				} else if ( status.status === 'hasDeleted' ) {
					MAGALIB.logError(4, status.files);
				} else if ( status.status === 'hasModified' ) {
					startCommit( status );
				} else if ( status.status === 'READY' ) {
					prepareRelease();
				} else {
					MAGALIB.logError(3, status.files);
				}
			});
		}();
	})
	.option('-l, --list', 'module list', function() {
		MAGALIB.svnGetList( MAGALIB.repositoryUrl ).then(function( moduleList ) {
			console.log('moduleList:\n' + moduleList.join('\n'));
		});
	})
	.option('-c, --create', 'create module', function() {
		MAGALIB.svnGetList( MAGALIB.repositoryUrl ).then(function( moduleList ) {
			console.log('moduleList:\n', moduleList);
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
}*/