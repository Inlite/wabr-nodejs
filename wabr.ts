import Http = require('http');

export interface delReaderCallback { (evnt: string, value, obj): void }

export class WAUtils {

    // http://ixti.net/development/node.js/2011/10/26/get-utf-8-string-from-array-of-bytes-in-node-js.html
    //   Convert UTF16 internal string to 
    static stringToByteArrayUTF8(str: string) {
        var bytes = [], char;
        str = encodeURI(str);

        while (str.length) {
            char = str.slice(0, 1);
            str = str.slice(1);

            if ('%' !== char) {
                bytes.push(char.charCodeAt(0));
            } else {
                char = str.slice(0, 2);
                str = str.slice(2);

                bytes.push(parseInt(char, 16));
            }
        }

        return bytes;
    }

    static signature(obj) {
        var image: string = "";
        if (obj == null || (typeof (obj) != "string"))
            return "";
        if (obj == "") return "";

        if (WAUtils.startsWith(obj, "data:image") && obj.indexOf(":::") > 0) {
            var s = obj.substring(0, Math.min(40, obj.length)) +
                obj.substring(obj.indexOf(":::"));
            image = s;
        }
        else
            image = obj.substring(0, Math.min(80, obj.length));
        return " [" + image + "]";
    }

    static stringToByteArray(str: string) {
        var bytes = [];
        for (var i = 0; i < str.length; ++i) {
            bytes.push(str.charCodeAt(i));
        }
        return bytes;
    }


    static pause() {
        process.stdin.resume();
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', function (text) {
            return;
        });
    }

    static ReadFileText(path: string): any {
        var fs = require('fs');
        var data = fs.readFileSync(path, 'utf8'); // Read the contents of the file into memory.
        var text: string = data.toString(); // logData is a Buffer, convert to string.
        return text;

    }



    static FileToBase64(file: string) {
        try
        {
            var base64: string = "";
            var fs = require('fs');
            var data = fs.readFileSync(file);
            base64 = new Buffer(data).toString('base64');

            var path = require('path');
            var ext: string = path.extname(file);
            if (ext.length > 1) ext = ext.substring(1);
        
            // Optionally attach suffix with reference file name to be placed in Barcode.File property
            base64 = "data:image/" + ext + ";base64," + base64 + ":::" + path.basename(file);
            return base64;
        }
        catch (ex) {
            return ("EXCEPTION: " + ex.message);
        }
    }

    static FileExists(file: string): boolean {
        var fs = require('fs');
        return fs.existsSync(file);
    }

    static printLine(msg: string = "") {
        console.log(msg);
    }

    static startsWith(str: string, target: string): boolean {
        if (str.length < target.length) return false;
        return str.slice(0, target.length) == target
    }

    static decodeBase64(base64: string): any {
        var data: Buffer = new Buffer(base64, 'base64');
        return data;
    }


    static isBase64(value: string): boolean // IsBase64String
    {
        var v: string = value;
        // replace formating characters
        v = v.replace("\r\n", "");
        v = v.replace("\r", "");
        // remove reference file name, if  present
        var ind: number = v.indexOf(":::");
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
    }

    static IsInvalidBase64char(intValue: number): boolean {
        if (intValue >= 48 && intValue <= 57)
            return false;
        if (intValue >= 65 && intValue <= 90)
            return false;
        if (intValue >= 97 && intValue <= 122)
            return false;
        return intValue != 43 && intValue != 47;
    }

    static dictionaryLength(dict): number {
        var i: number = 0;
        for (var o in dict) {
            i++;
        }
        return i;
    }
}

class WACallback {
    callback: delReaderCallback = null;
    obj = null;
    constructor(_callback: delReaderCallback, _obj) {
        this.callback = _callback;
        this.obj = _obj;
    }
    call(evnt, value) {
        if (this.callback != null)
            this.callback(evnt, value, this.obj);
    }
}

class WAHttpRequest {
    static _method = "post";
    static bytesToString(bytes): string {
        var str = "";
        for (var i = 0; i < bytes.length; i += 1) {
            var char = bytes[i];
            str += String.fromCharCode(char);
        }
        return str;
    }

    static timeoutSec = 0;

    static performRequest(reqUrl: string, authorization: string, method: string, cont_type: string, data, cb: WACallback, retries: number) {
        var https = require('https');
        var http = require('http');
        var url = require("url");

        if (authorization == "") {
            var env_auth = 'WABR_AUTH';
            authorization = process.env[env_auth];
            if (authorization == undefined) authorization = "";
        }
 
        var requester = http;
        var sRetries: string = (((retries == 0) ? "" : "[RETRY:" + retries + "] "));
        if (WAUtils.startsWith(reqUrl, 'https:'))
            requester = https;
        if (retries > 0)
            cb.call("retry", sRetries);

        if (data == undefined)
            data = "";
        var headers = {};
        var s: string = "";
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
            host: url.parse(reqUrl).host, // 'graph.facebook.com',
            path: url.parse(reqUrl).path, // 'graph.facebook.com',
            rejectUnauthorized: false,  // suppress UNABLE_TO_VERIFY_LEAF_SIGNATURE error
            method: method,
            headers: headers,
            keepAlive: false,
        };

        var req = requester.request(options, function (res) {

            var statusCode = res.statusCode;
            var statusMessage = res.statusMessage


            if (res.statusCode > 300 && res.statusCode < 400 && res.headers.location) {
                // The location for some (most) redirects will only contain the path,  not the hostname;
                // detect this and add the host to the path.
                var newUrl: string = "";
                if (url.parse(res.headers.location).hostname) {   // Hostname included; make request to res.headers.location
                    newUrl = res.headers.location;
                } else { // Hostname not included; get host from requested URL (url.parse()) and prepend to location
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
                })
                res.on('end', function () {
                    var body = Buffer.concat(bodyChunks);
                    var txtResponse = body.toString('utf-8');
                    if (statusCode == 200) {
                        cb.call("response", "SUCCESS " + sRetries + "- status: " + statusCode + "  " + ((statusMessage == undefined) ? "" : ". " + statusMessage));
                        var barcodes: WABarcode[] = WABarcodeReader.ParseResponse(txtResponse);
                        cb.call("barcodes", barcodes);
                        //                        process.stdout.write(".");

                    }
                    else {
                        cb.call("response", "FAILURE - status: " + statusCode + "  " + ((statusMessage == undefined) ? "" : ". " + statusMessage));
                        var err: string = "HTTP Error " + statusCode + ((statusMessage == undefined) ? "" : ". " + statusMessage);
                        if (txtResponse != null && !WAUtils.startsWith(txtResponse, "<!DOCTYPE")) err += ".  " + txtResponse;
                        cb.call("error", err);
                    }
                });
            }
        }
            ); // https:request

        req.on('error', function (e) {
            // Receive failure can be result of Server closing without notifying connection
            // e.g. if Server stopped than started or W3WP.exe was killed  
            var msg: string = e.message;
            if (msg.indexOf("ECONNRESET") > 0 && retries < 2) {
                // WAUtils.printLine("------------------------- RETRYING");
                WAHttpRequest.performRequest(reqUrl, authorization, method, cont_type, data, cb, retries + 1);

            }
            else {
                var err: string = 'HttpRequest Error: ' + e.message; //  + "   " + queries["url"];
                cb.call("error", err);
            }
        });

        req.on('socket', function (socket) {
            if (reqUrl.indexOf("adobe") > 0) {
                var i = 3;
            }
            if (WAHttpRequest.timeoutSec != 0)
                socket.setTimeout(WAHttpRequest.timeoutSec * 1000);  //  'error' even is raised with a message "Socket hang up"
            socket.setMaxListeners(0);
            socket.on('timeout', function () {
                // var err: string = 'HttpRequest TIMEOUT from ' + queries["url"];
                // console.log(err);
                req.abort();
            });
        });

        req.write(data);
        req.end();

    }


    ExecRequest(serverUrl: string, authorization: string, files: string[], queries: { [key: string]: string }, cb: WACallback) {
        var method: string = "";
        var cont_type: string = "";
        var data: any;
        var reqUrl: string = "";
        var query: string = "";
        if (WAHttpRequest._method == 'get') {
            method = 'GET';
            var querystring = require('querystring');
            query = querystring.stringify(queries);
            var reqUrl = serverUrl + "?" + query;
        }

        else if (WAHttpRequest._method == 'post') {
            method = 'POST';
            var formDataBoundary: string = "------------" + Math.random().toString(16);
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
    }



    GetMultipartFormData(postParameters: { [key: string]: string }, files: string[], boundary: string): Buffer {
        var fs = require("fs");
        var postData = [];
        var formData = [];
        var needsCLRF: boolean = false;
        var str: string;
        var postData = [];
        for (var key in postParameters) {
            if (needsCLRF) {
                str = "\r\n"; postData = WAUtils.stringToByteArray(str); formData = formData.concat(postData);
            }
            needsCLRF = true;
            if (postParameters[key] != "") {
                str = "--" + boundary + "\r\nContent-Disposition: form-data; name=\"" + key + "\"\r\n\r\n";
                postData = WAUtils.stringToByteArray(str); formData = formData.concat(postData);
                postData = WAUtils.stringToByteArrayUTF8(postParameters[key]); formData = formData.concat(postData);
            }
        }

        var path = require('path');
        for (var i = 0; i < files.length; i++) {
            var file = files[i];
            if (needsCLRF) {
                str = "\r\n"; postData = WAUtils.stringToByteArray(str); formData = formData.concat(postData);
            }
            str = "--" + boundary + "\r\nContent-Disposition: form-data; name=\"" + "file" + "\"; filename=\"" + path.basename(file) + "\"\r\n\r\n";
            var postData = WAUtils.stringToByteArray(str); formData = formData.concat(postData);
            // Add file content
            var data: Buffer = fs.readFileSync(file);
            postData = Array.prototype.slice.call(data, 0);  // Convert to byte array
            formData = formData.concat(postData);
        }
    
        // Add the end of the request.
        str = "\r\n--" + boundary + "--\r\n";
        postData = WAUtils.stringToByteArray(str); formData = formData.concat(postData);
        var buffer: Buffer = new Buffer(formData);
        // var s = buffer.toString('utf-8');  // TEST
        return buffer;
    }
}

export class WABarcode {
    constructor() {
    }
    Text: string = "";
    Data: any[] = [];   // byte array
    Type: string = "";
    Length: number = 0;
    Page: number = 0;
    Rotation: string = "";
    Left: number = 0;
    Top: number = 0;
    Right: number = 0;
    Bottom: number = 0;
    File: string = "";
    Meta = null;   // Object parsed from JSON
    Values: { [key: string]: string } = {};      // associative array (string, string)
}

export class WABarcodeReader {
    _serverUrl: string = "wabr.inliteresearch.com";
    _authorization: string = "";


    constructor(serverUrl: string, authorization: string = "") {
        this._serverUrl = serverUrl;
        this._authorization = authorization;
    }


    static validtypes: string = "1d,Code39,Code128,Code93,Codabar,Ucc128,Interleaved2of5," +
    "Ean13,Ean8,Upca,Upce," +
    "2d,Pdf417,DataMatrix,QR," +
    "DrvLic," +
    "postal,imb,bpo,aust,sing,postnet," +
    "Code39basic,Patch";


    ReadAsync(image: string, callback: delReaderCallback, obj: any, types?:string, directions?:string, tbr_code?:number) {
        if (callback != null)
            callback("image", image, obj);
        if (types == undefined) types = "";
        if (directions == undefined) directions = "";
        if (tbr_code == undefined) tbr_code = 0;
        var names: string[] = image.split('|');
        var urls: string[] = [], files: string[] = [], images: string[] = [];
        var isGet: boolean = WAHttpRequest._method == "get";
        for (var i = 0; i < names.length; i++) {
            var name1: string = names[i]
            var name: string = name1.trim();
            var s: string = name.toLowerCase();
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

    }

    static ParseResponse(txtResponse: string): WABarcode[] {
        var barcodes: WABarcode[] = [];

        if (WAUtils.startsWith(txtResponse, "{")) {    // JSON parsing
            var obj = JSON.parse(txtResponse);
            for (var i = 0; i < obj.Barcodes.length; i++) {
                var objBarcode = obj.Barcodes[i];
                var barcode: WABarcode = new WABarcode();
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
                        var obj2 = objValues[keys[0]]
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
    }

    ReadLocalAsync(urls: string[], files: string[], images: string[], types_: string, dirs_: string, tbr_: number, callback: delReaderCallback, obj) {

        var cb: WACallback = new WACallback(callback, obj);
        var server: string = this._serverUrl;
        if (server == "")
            server = "https://wabr.inliteresearch.com"; // default server
        var queries: { [key: string]: string } = {};

        var url: string = "";
        for (var i = 0; i < urls.length; i++) {
            var s: string = urls[i];
            if (url != "") url += "|";
            url += s;
        }
        if ("url" != "")
            queries["url"] = url;

        var image: string = "";
        for (var i = 0; i < images.length; i++) {
            var s: string = images[i];
            if (image != "") image += "|";
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

        var serverUrl: string = server + "/barcodes";
        var request: WAHttpRequest = new WAHttpRequest()
        request.ExecRequest(serverUrl, this._authorization, files, queries, cb);
    }

}

