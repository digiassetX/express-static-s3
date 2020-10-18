const AWS=require('aws-sdk');
const Limiter=require('limit-parallel');

/**
 * Converts a stream to a Buffer
 * @param stream
 * @return {Promise<Buffer>}
 */
const streamToBuffer=async (stream)=>{
    return new Promise(resolve => {
        const chunks = [];
        stream.on("data", (chunk) => chunks.push(chunk));
        stream.on("end", () => resolve(Buffer.concat(chunks)));
    });
}


class ExpressStaticS3 {
    /**
     * @param {{
     *     accessKeyId:     string,
     *     secretAccessKey: string,
     *     bucket:          string,
     *     folder:          string,
     *     prefix:          string
     * }} options
     */
    constructor(options) {
        //create bucket link
        this._s3= new AWS.S3({
            accessKeyId:        options.accessKeyId,
            secretAccessKey:    options.secretAccessKey
        });
        this._bucket=options.bucket;
        this._folder=options.folder||"";

        //make sure folder ends with / or is blank
        if ((this._folder!=="")&&(!this._folder.endsWith("/"))) this._folder+='/';

        //make sure prefix starts with / or is blank
        this._prefix=options.prefix||"";
        if ((this._prefix!=="")&&(!this._prefix.startsWith("/"))) this._prefix='/'+this._prefix;

        //clone bucket to cache
        this._ready=[];
        this.resync().then(()=>{}); //sets ready when done
    }

    /**
     * Returns when the class is ready
     * @return {Promise<void>}
     */
    async ready() {
        return new Promise(async (resolve, reject) => {
            if (typeof this._ready == "object") {
                this._ready.push([resolve,reject]);
            } else if (typeof this._ready==="string") {
                reject(this._ready);
            } else {
                resolve();
            }
        });
    }

    async *_listAllKeys() {
        let opts={
            Bucket: this._bucket,
            Prefix: this._folder
        };
        do {
            const data = await this._s3.listObjectsV2(opts).promise();
            opts.ContinuationToken = data.NextContinuationToken;
            yield data;
        } while (opts.ContinuationToken)
    }

    /**
     * @param {string}  path
     * @return {Promise<Buffer>}
     * @private
     */
    async _readFile(path) {
        return new Promise(async (resolve, reject) => {
            let stream = (await this._s3.getObject({
                Bucket: this._bucket,
                Key: path
            })).createReadStream();
            stream.on('error', (error) => {
                return reject(error);
            });
            this._cache[path.substr(this._folder.length)]=await streamToBuffer(stream);
            resolve();
        });
    };


    /**
     * Resyncs to the buckets content
     * @return {Promise<void>}
     */
    async resync() {
        //reset the ready flag
        if (typeof this._ready!=="object") this._ready=[];

        //create the cache
        this._cache = {};
        let limiter=new Limiter(10);
        for await (const data of this._listAllKeys()) {
            for (let {Key} of data.Contents) {
                await limiter.add(this._readFile(Key));
            }
        }
        await limiter.finish();

        //tell new calls we are done
        let list=this._ready;
        this._ready=true;

        //tell waiting we are done
        for (let [resolve,reject] of list) {
            resolve();
        }
    }

    get express() {
        let me=this;
        let cutLength=this._prefix.length+1;
        return function(req, res, next) {
            if (req.method !== "GET") return next();
            if (!req.path.startsWith(me._prefix + '/')) return next();

            //get the path
            let path=req.path;
            if (path.endsWith('/')) path+='index.html';
            path=path.substr(cutLength);

            //look up file
            me.ready().then(()=> {
                if (me._cache[path] === undefined) {
                    if (me._cache["error/404.html"] === undefined) next();  //if no error file then go to next
                    res.status(404).end(me._cache["error/404.html"]);
                } else {
                    res.status(200).end(me._cache[path]);
                }
            });

        }
    }
}
module.exports=ExpressStaticS3;