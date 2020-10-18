require('nodeunit');
const ExpressStaticS3 = require('../index');
const express = require('express');
const bodyParser = require("body-parser");
const got = require("got");



module.exports = {
    'Test Limit': async function(test) {
        const options={
            accessKeyId:     'REDACTED',
            secretAccessKey: 'REDACTED',
            bucket:          'REDACTED',
            folder:          'REDACTED',
            prefix:          'test'
        };
        let staticServer=new ExpressStaticS3(options);

        //create express server
        const app = express();
        app.use(bodyParser.urlencoded({ extended: false }));
        app.use(bodyParser.json());
        app.use(staticServer.express);
        app.listen(8080, () => console.log(`API Server running on port 8080`));

        //try loading a file that should exist
        let response=await got.get('http://127.0.0.1:8080/test/');
        console.log(response.body);

        //not a true test but a really good demo for testing
        test.done();
    }

};

