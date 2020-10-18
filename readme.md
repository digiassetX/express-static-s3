# Express Static S3 Page


## Installation
``` bash
npm install express-static-s3
```

## Usage
``` javascript
//initialize express
const api = express();

//initialize body parser
const bodyParser = require("body-parser");
api.use(bodyParser.urlencoded({ extended: false }));
api.use(bodyParser.json());

//initialize express-static-s3
let staticServer=new ExpressStaticS3({
  accessKeyId:     'REDACTED',
  secretAccessKey: 'REDACTED',
  bucket:          'REDACTED'
});
api.use(staticServer.express);
```

Page will run entirely out of ram only updating from bucket on boot or when you call the .resync() function.
You can use the prefix and folder option perameters to have more then one static page on the same server.