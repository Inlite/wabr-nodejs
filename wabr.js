var WAUtils = (function () {
    function WAUtils() {
    }
    // http://ixti.net/development/node.js/2011/10/26/get-utf-8-string-from-array-of-bytes-in-node-js.html
    //   Convert UTF16 internal string to 
    WAUtils.stringToByteArrayUTF8 = function (str) {
        var bytes = [], char;
        str = encodeURI(str);
        while (str.length) {
            char = str.slice(0, 1);
            str = str.slice(1);
            if ('%' !== char) {
                bytes.push(char.charCodeAt(0));
            }
            else {
                char = str.slice(0, 2);
                str = str.slice(2);
                bytes.push(parseInt(char, 16));
            }
        }
        return bytes;
    };
    WAUtils.signature = function (obj) {
        var image = "";
        if (obj == null || (typeof (obj) != "string"))
            return "";
        if (obj == "")
            return "";
        if (WAUtils.startsWith(obj, "data:image") && obj.indexOf(":::") > 0) {
            var s = obj.substring(0, Math.min(40, obj.length)) + obj.substring(obj.indexOf(":::"));
            image = s;
        }
        else
            image = obj.substring(0, Math.min(80, obj.length));
        return " [" + image + "]";
    };
    WAUtils.stringToByteArray = function (str) {
        var bytes = [];
        for (var i = 0; i < str.length; ++i) {
            bytes.push(str.charCodeAt(i));
        }
        return bytes;
    };
    WAUtils.pause = function () {
        process.stdin.resume();
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', function (text) {
            return;
        });
    };
    WAUtils.ReadFileText = function (path) {
        var fs = require('fs');
        var data = fs.readFileSync(path, 'utf8'); // Read the contents of the file into memory.
        var text = data.toString(); // logData is a Buffer, convert to string.
        return text;
    };
    WAUtils.FileToBase64 = function (file) {
        try {
            var base64 = "";
            var fs = require('fs');
            var data = fs.readFileSync(file);
            base64 = new Buffer(data).toString('base64');
            var path = require('path');
            var ext = path.extname(file);
            if (ext.length > 1)
                ext = ext.substring(1);
            // Optionally attach suffix with reference file name to be placed in Barcode.File property
            base64 = "data:image/" + ext + ";base64," + base64 + ":::" + path.basename(file);
            return base64;
        }
        catch (ex) {
            return ("EXCEPTION: " + ex.message);
        }
    };
    WAUtils.FileExists = function (file) {
        var fs = require('fs');
        return fs.existsSync(file);
    };
    WAUtils.printLine = function (msg) {
        if (msg === void 0) { msg = ""; }
        console.log(msg);
    };
    WAUtils.startsWith = function (str, target) {
        if (str.length < target.length)
            return false;
        return str.slice(0, target.length) == target;
    };
    WAUtils.decodeBase64 = function (base64) {
        var data = new Buffer(base64, 'base64');
        return data;
    };
    WAUtils.isBase64 = function (value) {
        var v = value;
        // replace formating characters
        v = v.replace("\r\n", "");
        v = v.replace("\r", "");
        // remove reference file name, if  present
        var ind = v.indexOf(":::");
        if (ind > 0)
            v = v.substr(0, ind);
        if (v == null || v.length == 0 || (v.length % 4) != 0)
            return false;
        var index = v.length - 1;
        if (v[index] == '=')
            index--;
        if (v[index] == '=')
            index--;
        for (var i = 0; i <= index; i++)
            if (WAUtils.IsInvalidBase64char(v.charCodeAt(i)))
                return false;
        return true;
    };
    WAUtils.IsInvalidBase64char = function (intValue) {
        if (intValue >= 48 && intValue <= 57)
            return false;
        if (intValue >= 65 && intValue <= 90)
            return false;
        if (intValue >= 97 && intValue <= 122)
            return false;
        return intValue != 43 && intValue != 47;
    };
    WAUtils.dictionaryLength = function (dict) {
        var i = 0;
        for (var o in dict) {
            i++;
        }
        return i;
    };
    return WAUtils;
})();
exports.WAUtils = WAUtils;
var WACallback = (function () {
    function WACallback(_callback, _obj) {
        this.callback = null;
        this.obj = null;
        this.callback = _callback;
        this.obj = _obj;
    }
    WACallback.prototype.call = function (evnt, value) {
        if (this.callback != null)
            this.callback(evnt, value, this.obj);
    };
    return WACallback;
})();
var WAHttpRequest = (function () {
    function WAHttpRequest() {
    }
    WAHttpRequest.bytesToString = function (bytes) {
        var str = "";
        for (var i = 0; i < bytes.length; i += 1) {
            var char = bytes[i];
            str += String.fromCharCode(char);
        }
        return str;
    };
    WAHttpRequest.performRequest = function (reqUrl, authorization, method, cont_type, data, cb, retries) {
        var https = require('https');
        var http = require('http');
        var url = require("url");
        if (authorization == "") {
            var env_auth = 'WABR_AUTH';
            authorization = process.env[env_auth];
            if (authorization == undefined)
                authorization = "";
        }
        var requester = http;
        var sRetries = (((retries == 0) ? "" : "[RETRY:" + retries + "] "));
        if (WAUtils.startsWith(reqUrl, 'https:'))
            requester = https;
        if (retries > 0)
            cb.call("retry", sRetries);
        if (data == undefined)
            data = "";
        var headers = {};
        var s = "";
        if (data instanceof Buffer) {
            headers['Content-Length'] = data.length;
            headers['Content-type'] = cont_type;
        }
        else {
            if (cont_type != "")
                headers['Content-type'] = cont_type;
            headers['Content-Length'] = data.length;
        }
        if (authorization != "")
            headers['Authorization'] = authorization;
        var options = {
            host: url.parse(reqUrl).host,
            path: url.parse(reqUrl).path,
            rejectUnauthorized: false,
            method: method,
            headers: headers,
            keepAlive: false,
        };
        var req = requester.request(options, function (res) {
            var statusCode = res.statusCode;
            var statusMessage = res.statusMessage;
            if (res.statusCode > 300 && res.statusCode < 400 && res.headers.location) {
                // The location for some (most) redirects will only contain the path,  not the hostname;
                // detect this and add the host to the path.
                var newUrl = "";
                if (url.parse(res.headers.location).hostname) {
                    newUrl = res.headers.location;
                }
                else {
                    newUrl = url.parse(reqUrl).protocol + "//" + url.parse(reqUrl).hostname + url.parse(res.headers.location).path;
                }
                if (newUrl != "" && newUrl.toLowerCase() != reqUrl.toLowerCase() && retries < 3)
                    WAHttpRequest.performRequest(newUrl, authorization, method, cont_type, data, cb, retries + 1);
                else
                    cb.call("response", "FAILURE - redirect: " + statusCode + "  " + ((statusMessage == undefined) ? "" : ". " + statusMessage));
                // this dummy function to address Node.JS issue where maximum 5 asynchronous retries are made.
                //   see: http://stackoverflow.com/questions/29000484/node-js-http-get-in-a-loop-get-status-codes-for-all-the-requests
                res.on('data', function (data) {
                });
                res.on('end', function (data) {
                });
                res.on('close', function (data) {
                });
            }
            else {
                var bodyChunks = [];
                res.on('data', function (chunk) {
                    // Process streamed parts here
                    bodyChunks.push(chunk);
                });
                res.on('end', function () {
                    var body = Buffer.concat(bodyChunks);
                    var txtResponse = body.toString('utf-8');
                    if (statusCode == 200) {
                        cb.call("response", "SUCCESS " + sRetries + "- status: " + statusCode + "  " + ((statusMessage == undefined) ? "" : ". " + statusMessage));
                        var barcodes = WABarcodeReader.ParseResponse(txtResponse);
                        cb.call("barcodes", barcodes);
                    }
                    else {
                        cb.call("response", "FAILURE - status: " + statusCode + "  " + ((statusMessage == undefined) ? "" : ". " + statusMessage));
                        var err = "HTTP Error " + statusCode + ((statusMessage == undefined) ? "" : ". " + statusMessage);
                        if (txtResponse != null && !WAUtils.startsWith(txtResponse, "<!DOCTYPE"))
                            err += ".  " + txtResponse;
                        cb.call("error", err);
                    }
                });
            }
        }); // https:request
        req.on('error', function (e) {
            // Receive failure can be result of Server closing without notifying connection
            // e.g. if Server stopped than started or W3WP.exe was killed  
            var msg = e.message;
            if (msg.indexOf("ECONNRESET") > 0 && retries < 2) {
                // WAUtils.printLine("------------------------- RETRYING");
                WAHttpRequest.performRequest(reqUrl, authorization, method, cont_type, data, cb, retries + 1);
            }
            else {
                var err = 'HttpRequest Error: ' + e.message; //  + "   " + queries["url"];
                cb.call("error", err);
            }
        });
        req.on('socket', function (socket) {
            if (reqUrl.indexOf("adobe") > 0) {
                var i = 3;
            }
            if (WAHttpRequest.timeoutSec != 0)
                socket.setTimeout(WAHttpRequest.timeoutSec * 1000); //  'error' even is raised with a message "Socket hang up"
            socket.setMaxListeners(0);
            socket.on('timeout', function () {
                // var err: string = 'HttpRequest TIMEOUT from ' + queries["url"];
                // console.log(err);
                req.abort();
            });
        });
        req.write(data);
        req.end();
    };
    WAHttpRequest.prototype.ExecRequest = function (serverUrl, authorization, files, queries, cb) {
        var method = "";
        var cont_type = "";
        var data;
        var reqUrl = "";
        var query = "";
        if (WAHttpRequest._method == 'get') {
            method = 'GET';
            var querystring = require('querystring');
            query = querystring.stringify(queries);
            var reqUrl = serverUrl + "?" + query;
        }
        else if (WAHttpRequest._method == 'post') {
            method = 'POST';
            var formDataBoundary = "------------" + Math.random().toString(16);
            data = this.GetMultipartFormData(queries, files, formDataBoundary);
            var s = WAHttpRequest.bytesToString(data);
            cont_type = 'multipart/form-data; boundary=' + formDataBoundary;
            var reqUrl = serverUrl;
        }
        else if (WAHttpRequest._method == 'postenc') {
            method = 'POST';
            var querystring = require('querystring');
            query = querystring.stringify(queries);
            data = query;
            cont_type = 'application/x-www-form-urlencoded';
            var reqUrl = serverUrl;
        }
        if (reqUrl != "")
            WAHttpRequest.performRequest(reqUrl, authorization, method, cont_type, data, cb, 0);
    };
    WAHttpRequest.prototype.GetMultipartFormData = function (postParameters, files, boundary) {
        var fs = require("fs");
        var postData = [];
        var formData = [];
        var needsCLRF = false;
        var str;
        var postData = [];
        for (var key in postParameters) {
            if (needsCLRF) {
                str = "\r\n";
                postData = WAUtils.stringToByteArray(str);
                formData = formData.concat(postData);
            }
            needsCLRF = true;
            if (postParameters[key] != "") {
                str = "--" + boundary + "\r\nContent-Disposition: form-data; name=\"" + key + "\"\r\n\r\n";
                postData = WAUtils.stringToByteArray(str);
                formData = formData.concat(postData);
                postData = WAUtils.stringToByteArrayUTF8(postParameters[key]);
                formData = formData.concat(postData);
            }
        }
        var path = require('path');
        for (var i = 0; i < files.length; i++) {
            var file = files[i];
            if (needsCLRF) {
                str = "\r\n";
                postData = WAUtils.stringToByteArray(str);
                formData = formData.concat(postData);
            }
            str = "--" + boundary + "\r\nContent-Disposition: form-data; name=\"" + "file" + "\"; filename=\"" + path.basename(file) + "\"\r\n\r\n";
            var postData = WAUtils.stringToByteArray(str);
            formData = formData.concat(postData);
            // Add file content
            var data = fs.readFileSync(file);
            postData = Array.prototype.slice.call(data, 0); // Convert to byte array
            formData = formData.concat(postData);
        }
        // Add the end of the request.
        str = "\r\n--" + boundary + "--\r\n";
        postData = WAUtils.stringToByteArray(str);
        formData = formData.concat(postData);
        var buffer = new Buffer(formData);
        // var s = buffer.toString('utf-8');  // TEST
        return buffer;
    };
    WAHttpRequest._method = "post";
    WAHttpRequest.timeoutSec = 0;
    return WAHttpRequest;
})();
var WABarcode = (function () {
    function WABarcode() {
        this.Text = "";
        this.Data = []; // byte array
        this.Type = "";
        this.Length = 0;
        this.Page = 0;
        this.Rotation = "";
        this.Left = 0;
        this.Top = 0;
        this.Right = 0;
        this.Bottom = 0;
        this.File = "";
        this.Meta = null; // Object parsed from JSON
        this.Values = {}; // associative array (string, string)
    }
    return WABarcode;
})();
exports.WABarcode = WABarcode;
var WABarcodeReader = (function () {
    function WABarcodeReader(serverUrl, authorization) {
        if (authorization === void 0) { authorization = ""; }
        this._serverUrl = "wabr.inliteresearch.com";
        this._authorization = "";
        this._serverUrl = serverUrl;
        this._authorization = authorization;
    }
    WABarcodeReader.prototype.ReadAsync = function (image, callback, obj, types, directions, tbr_code) {
        if (callback != null)
            callback("image", image, obj);
        if (types == undefined)
            types = "";
        if (directions == undefined)
            directions = "";
        if (tbr_code == undefined)
            tbr_code = 0;
        var names = image.split('|');
        var urls = [], files = [], images = [];
        var isGet = WAHttpRequest._method == "get";
        for (var i = 0; i < names.length; i++) {
            var name1 = names[i];
            var name = name1.trim();
            var s = name.toLowerCase();
            if (WAUtils.startsWith(s, "http://") || WAUtils.startsWith(s, "https://") || WAUtils.startsWith(s, "ftp://") || WAUtils.startsWith(s, "file://"))
                urls.push(name);
            else if (!isGet && name.length < 1000 && WAUtils.FileExists(name))
                files.push(name);
            else if (!isGet && (WAUtils.startsWith(name, "data:") || WAUtils.isBase64(name)))
                images.push(name);
            else {
                if (callback != null) {
                    callback("error", "Invalid image source" + (isGet ? " for GET" : "") + ": " + name.substring(0, Math.min(256, name.length)), obj);
                    return;
                }
            }
        }
        this.ReadLocalAsync(urls, files, images, types, directions, tbr_code, callback, obj);
    };
    WABarcodeReader.ParseResponse = function (txtResponse) {
        var barcodes = [];
        if (WAUtils.startsWith(txtResponse, "{")) {
            var obj = JSON.parse(txtResponse);
            for (var i = 0; i < obj.Barcodes.length; i++) {
                var objBarcode = obj.Barcodes[i];
                var barcode = new WABarcode();
                barcode.Text = objBarcode.Text;
                barcode.Left = objBarcode.Left;
                barcode.Right = objBarcode.Right;
                barcode.Top = objBarcode.Top;
                barcode.Bottom = objBarcode.Bottom;
                barcode.Length = objBarcode.Length;
                barcode.Data = WAUtils.decodeBase64(objBarcode.Data);
                barcode.Page = objBarcode.Page;
                barcode.File = objBarcode.File;
                barcode.Meta = objBarcode.Meta;
                barcode.Type = objBarcode.Type;
                barcode.Rotation = objBarcode.Rotation;
                if (objBarcode.Values != undefined) {
                    var objValues = objBarcode.Values;
                    var keys = Object.keys(objValues);
                    if (keys.length == 1) {
                        var obj2 = objValues[keys[0]];
                        var keys2 = Object.keys(obj2);
                        for (var j = 0; j < keys2.length; j++) {
                            var obj3 = obj2[keys2[j]];
                            barcode.Values[keys2[j]] = obj3.toString();
                        }
                    }
                }
                barcodes.push(barcode);
            }
        }
        return barcodes;
    };
    WABarcodeReader.prototype.ReadLocalAsync = function (urls, files, images, types_, dirs_, tbr_, callback, obj) {
        var cb = new WACallback(callback, obj);
        var server = this._serverUrl;
        if (server == "")
            server = "https://wabr.inliteresearch.com"; // default server
        var queries = {};
        var url = "";
        for (var i = 0; i < urls.length; i++) {
            var s = urls[i];
            if (url != "")
                url += "|";
            url += s;
        }
        if ("url" != "")
            queries["url"] = url;
        var image = "";
        for (var i = 0; i < images.length; i++) {
            var s = images[i];
            if (image != "")
                image += "|";
            image += s;
        }
        if ("image" != "")
            queries["image"] = image;
        //        queries["format"] = "xml";
        queries["fields"] = "meta";
        if (types_ != "")
            queries["types"] = types_;
        if (dirs_ != "")
            queries["options"] = dirs_;
        if (tbr_ != 0)
            queries["tbr"] = tbr_.toString();
        var serverUrl = server + "/barcodes";
        var request = new WAHttpRequest();
        request.ExecRequest(serverUrl, this._authorization, files, queries, cb);
    };
    WABarcodeReader.validtypes = "1d,Code39,Code128,Code93,Codabar,Ucc128,Interleaved2of5," + "Ean13,Ean8,Upca,Upce," + "2d,Pdf417,DataMatrix,QR," + "DrvLic," + "postal,imb,bpo,aust,sing,postnet," + "Code39basic,Patch";
    return WABarcodeReader;
})();
exports.WABarcodeReader = WABarcodeReader;
//# sourceMappingURL=wabr.js.map