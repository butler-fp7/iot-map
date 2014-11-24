#!/usr/bin/env node
 
var port = 8000;
var http = require('http');
var fs = require('fs');
var server = http.createServer();
var publicDirectory = '.';
var mime;

try{
	mime = require('mime');
}
catch(e){
	console.error('mime not installed please run: npm install mime');
}

server.on('request', function(request, response){
	var r = require('url').parse(request.url, true);
	var pathname = r.pathname;
	var query = r.query;

	try{
		
		// proxying ? 
		if ( pathname == "/proxy" ) {
			console.log("acting as a proxy...");
			var options = {}
			console.log("url: " + r.query.url);
			resource = require('url').parse(r.query.url, true);
			options = {
			    hostname: resource.hostname,
			    port: resource.port,
			    path: resource.path,
			    headers: {
			    	"Authorization": request.headers['authorization'],
			    	"Content-Encoding": request.headers['content-encoding']
			    },
			    method: 'GET' //r.query.method
			  };
			var proxy = http.request(options, function (res) {
			  res.pipe(response, {
			    end: true
			  });
			});
			
			request.pipe(proxy, {
			  end: true
			});
		} else {

			var filePath;
			if (pathname == "/") {
				filePath = "./index.html";
			} else {
				filePath = '.' + pathname;
			}
				

			if ( fs.existsSync(filePath) ){
				response.writeHead(200, {
					'content-type': mime.lookup(filePath),
					'cache-control': 'no-cache'
				});
				response.write(fs.readFileSync(filePath));
				response.end();
			} 
			else{
				response.writeHead(404);
				response.write("Not found, sorry :-( Happy 404 ;-)")
				response.end();
			}

		
			if (pathname != '/favicon.ico') {
				console.log(pathname);
			}

			response.writeHead(200, {'content-type': 'text/plain'});
			response.end();
			return;
			}
	
	}
	catch(e){
		console.log("Exception catched: " + e);
		response.writeHead(500);
		response.end();
	}
});

server.listen(port);
console.log('Server running on port ' + port);

