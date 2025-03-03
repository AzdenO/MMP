/*Create API Object and constant for port it listens on*/
const express = require("express");

const api_https = require("https");

const reasoner = require('./modules/reasoner');//Gemini 2.0 flash Model wrapper module

require("./modules/coach");//Coach module for coach objects created for each user

const requester = require('axios');

const fs = require("node:fs");

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/*Create all necessary global variables*/

const PORT = 32765;

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/*Create https object for secure connections and instantiate object to hold asymetric parameters*/
const httpsOptions = {
    key: fs.readFileSync('O:/Dev/Level_4/OryxDashboard/src/.idea/server/encryption/server.key'),
    cert: fs.readFileSync('O:/Dev/Level_4/OryxDashboard/src/.idea/server/encryption/server.cert')
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

api = express();
api_https.createServer(httpsOptions, api).listen(PORT, () =>{
    console.log("Server Initialised at https:localhost");
    console.log(`Listening on port ${PORT}`);
})

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

api.get('/server/coach/act_sug_build', (req, res) => {
    const parameters = req.query;
})

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

api.post('/server/authorize', (req, res) => {
    console.log("Request success");
    const incoming = req.body;
    console.log(incoming);-
    res.json({message:"Test Successful"});
});

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

