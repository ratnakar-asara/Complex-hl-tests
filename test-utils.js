const crypto = require('crypto');
var config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
function fileExists(filePath) {
    try {
        return fs.statSync(filePath).isFile();
    } catch (err) {
        return false;
    }
}

function deleteDir(path) {
    try {
        if (fs.existsSync(path)) {
            fs.readdirSync(path).forEach(function(file, index) {
                fs.unlinkSync(path + "/" + file);
            });
            fs.rmdirSync(path);
        }
    } catch (err) {
        return err;
    }
};

function getArgs(request) {
    var args = [];
    for (var i = 0; i < request.args.length; i++) {
        args.push(request.args[i]);
    }
    return args;
}

function getRandomPayload(){
      //TODO: Make it configurable
    	// random payload: 1kb - 2kb
    	var min = parseInt(config.payload.min);
    	var max = parseInt(config.payload.max);
    	var r = Math.floor(Math.random() * (max - min)) + min;
	    //var r = min;
    	var buf = crypto.randomBytes(r);
      return  buf.toString('hex');
}

module.exports = {
  fileExists:fileExists,
  deleteDir:deleteDir,
  getArgs:getArgs,
  getRandomPayload:getRandomPayload
};
