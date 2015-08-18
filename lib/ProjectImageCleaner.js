var method = ProjectImageCleaner.prototype;

var fileUtils = require('./utils/fileUtils.js');
var stringUtils = require('./utils/stringUtils.js');
var fs = require('fs');
var path = require('path');

function ProjectImageCleaner(projectDir, opts) {
  //default opts
  this.opts = {
    deleteFiles: false
  };
  this.imagesForRemoval = [];
  this.imagesWithReference = [];
  this.projectDir = projectDir;
  this.listeners = {};

  this.searchCfgs();

  this.opts = this.extend(this.opts, opts);

  if (this.opts.debug) {
    console.log('Configuration', this.opts);
  }
}

method.search = function() {
  console.log('Searching', this.projectDir);
  var self = this;
  var matchRegex = new RegExp('(.' + this.opts.imageFormats.join('|.') + ')$', 'i');
  var searchImageOpts = {
    match: matchRegex,
    exclude: /^\./,
    toLowerCase: true,
    bothNames: true,
  };

  if (this.opts.searchImageOpts) {
    searchImageOpts = this.extend(searchImageOpts, this.opts.searchImageOpts);
    if (this.opts.debug) {
      console.log('Found searchImageOpts, extending ', searchImageOpts);
    }
  }
  fileUtils.searchDirForFiles(this.projectDir, searchImageOpts, 
    function(err, files){
        if (err) throw err;

        self.imagesForRemoval = files;
        if (self.opts.debug) {
          console.log('finished reading images :', files.length);
        }

        self._searchReferencedImages();
    });
}



method.addImageWithReference = function(matchedImage) {
  var index = this._imagesIndexOf(matchedImage);
  if (index > -1) {
    if (this.opts.debug) {
      console.log(matchedImage, 'has reference.');
    }
    var matchedImageObj = this.imagesForRemoval[index];
    this.imagesForRemoval.splice(index, 1);
    this.imagesWithReference.push(matchedImageObj);

    this.emit('foundReference', [matchedImageObj]);
  }
}

method._searchReferencedImages = function() {
  var self = this;
  var matchRegex = new RegExp('(.' + this.opts.fileFormats.join('|.') + ')$', 'i');
  fileUtils.readFiles(this.projectDir, {
    match: matchRegex,
    exclude: /^\./,
  }, function(err, content, file, next) {
    if (err) throw err;

    var imagesForRemovalRegex = [];
    for (var i in self.imagesForRemoval) {
      var imageObj = self.imagesForRemoval[i];
      //TODO: make searchStr cfgable
      imageObj.searchStr = imageObj.filename;
      imageObj.regexp = stringUtils.escapeRegExp(imageObj.searchStr)
      imagesForRemovalRegex.push(imageObj.regexp); 
    }
    //console.log('!!!',imagesForRemovalRegex.join('|'))
    var imageSearchRegex = new RegExp('(' + imagesForRemovalRegex.join('|') + ')', 'i');
    var hasReference = imageSearchRegex.exec(content);

    self.miniCb([hasReference, file], function(hasReference, file, done) {
      if (hasReference) {
        //console.log('Searching ', file, ' ::: ', hasReference[0]);
        var matchedImage = hasReference[0];
        //console.log('Found match', matchedImage, 'from', file);
        this.emit('match', [matchedImage, file]);
        self.opts.doAfterMatch.apply(self, [file, matchedImage, done]);
      } else {
        done();
      }
    }, function() {
      next();
    });
    
    
  }, function(err, files) {
    if (err) throw err;

    if (self.opts.debug) {
      console.log('Has references:', imagesToArrayString(self.imagesWithReference, 'filename').join(', ').substr(0, 888), '...', self.imagesWithReference.length, 'files')
      console.log('No references:', imagesToArrayString(self.imagesForRemoval,'filename').join(', ').substr(0, 888), '...', self.imagesForRemoval.length, 'files');
    }
 
    if (self.opts.deleteFiles) {
      console.log('deleteFiles option is enabled. Deleting...');
      for (var i in self.imagesForRemoval) {
        var imageObj = self.imagesForRemoval[i];
        fs.unlink(imageObj.file);
        if (self.opts.debug) {
          console.log('Deleted', imageObj.file);
        }
      }
      console.log('Done deleting', self.imagesForRemoval.length, 'files');
    }

    console.log('Done. Has references:', self.imagesWithReference.length + '. No references:', self.imagesForRemoval.length);

    self.emit('done', [self.imagesForRemoval, self.imagesWithReference]);
  }
  );
}

method.miniCb = function(params, func, done) {
  params = params || [];
  params.push(done);
  func.apply(this, params);
}

function imagesToArrayString(imgObjArray, attr) {
  return imgObjArray.map(function(e) { 
    return e[attr]; 
  })
}

method._imagesIndexOf = function(matchedImage) {
  return imagesToArrayString(this.imagesForRemoval, 'searchStr').indexOf(matchedImage);
}

method.searchCfgs = function() {
  var self = this;
  var node_modules_dir = path.resolve(process.cwd(), 'node_modules');
  var list = fs.readdirSync(node_modules_dir);
  for (var i in list) {
    var dirName = list[i];
    
    if (dirName.indexOf('pic-cfg') == 0) {
      console.log('Found configuration ' + dirName);
      var opts = require(dirName)(self);
      self.opts = self.extend(self.opts, opts);
    }
  }

}

method.on = function(eventName, func) {
  if (!this.listeners[eventName]) {
    this.listeners[eventName] = [];
  }
  this.listeners[eventName].push(func);
}

method.emit = function(eventName, params) {
  var eventListeners = this.listeners[eventName];
  if (eventListeners) {
    for (var i in eventListeners) {
      var eventListener = eventListeners[i];
      eventListener.apply(this, params);
    }
  }
}

function extend(target, source, modify) {
    var result = target ? modify ? target : extend({}, target, true) : {};
    if (!source) return result;
    for (var key in source) {
        if (source.hasOwnProperty(key) && source[key] !== undefined) {
            result[key] = source[key];
        }
    }
    return result;
}

method.extend = extend;

module.exports = ProjectImageCleaner;