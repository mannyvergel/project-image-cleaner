var ProjectImageCleaner = require('../');

// var opts = ProjectImageCleaner.DEFAULT_IOS_OPTS;

var iosCleaner = new ProjectImageCleaner(
  '/Users/manny/progs/workspace2/eMeeting/eMeetingUIRevamp2', 
  {debug: true,
    deleteFiles: false,}
);


iosCleaner.search();