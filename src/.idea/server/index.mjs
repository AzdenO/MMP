import express from "express";//express module that allows for easier creation of rest server, and easier integration of middleware

import api_https from "https";//https server module, allows for communication over https instead of http

import Reasoner from "./modules/reasoner.mjs";//import reasoner class
const Coach = (await import("./modules/coach.mjs")).default;//import coach class, one created for each user of the server, need to wait for module initialisation on server startup

import fs from "node:fs";//for reading files on the system the server runs on

import cors from "cors";//cross origin resource sharing module

import dayjs from "dayjs";//time module

///////////////////////////////////////////////EXPRESS CONFIGURATION////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var api = express();//instantiate rest server
api.use(cors({
    origin: "https://azdeno.github.io",//only allow requests from the github page
    methods: ["GET", "POST", "OPTIONS"],//allow only get, post and options requests on the server
    allowedHeaders: ["Content-Type"],//define list of header attributes that are allowed in all requests
    credentials: true//not applicable yet, but will be used in later version for authenticating a user with our server before authenticating with bungie
}));

//Request logging, every request to the server is logged at stdout, before proceeding to its target endpoint
api.use((req, res,next) => {
    console.log("Server Request: "+req.method +" at endpoint: " + req.url);//log request method and its target endpoint on the server
    next();//Allows request to move onto correct endpoint after logging
})

api.use(express.json());//allows for easier parsking of request jsons
//////////////////////////////////////////////////////GLOBAL VARIABLES//////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/*Create all necessary global variables*/
var users = [];
const PORT = 3000;//Port the server will listen on
const generativeModel = new Reasoner();//Wrapper class for google gemini. Singleton (object loads prompts from storage so saves on server memory use) passed to every coach object


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/*Create https object for secure connections and instantiate object to hold asymetric parameters*/
const httpsOptions = {
    key: fs.readFileSync('O:/Dev/Level_4/VanguardMentorServer/src/.idea/server/encryption/server.key','utf8'),//read files in synchronous
    cert: fs.readFileSync('O:/Dev/Level_4/VanguardMentorServer/src/.idea/server/encryption/server.cert','utf8')
};
///////////////////////////////////////////////ROUTE DEFINITIONS////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

api.get('/server/coach/act_sug_build', (req, res) => {
    const parameters = req.query;
})

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

api.post('/server/authorize', (req, res) => {
    console.log("Processing authorisation request...");
    (async () => {
        var newuser = new Coach(generativeModel, req.body.code);//create new object with default values, synchronous
        const success = await newuser.initialise(req.body.code);//gain authorisation from bungie, asynchronous, await success

        if(success=="error"){//request unsuccessful
            newuser = null;//make applicable for garbage collection
            console.log("Server:// Error in creating new user");
            res.status(401);//return http status error code
            res.json({
                message: "Error in authenticating user",
                ErrorCode: 401,//sticking to standard http codes where applicable, this being authentication error
                status: "error",
                data:{
                    //typical to leave empty if not applicable, further development will include more detail however
                }
            });
        }else{//request successful
            users.push(newuser);//append new user to list of active users held in main memory
            res.status(200);//return ok http status code
            console.log("Server:// Created new user at: "+dayjs().format("HH:mm:ss"));
            const response = {
                characters: newuser.characters,//page init data
                bungiename: newuser.displayname,//page init data
                message: "I`ve taken entire worlds, you think you`re worthy to face me?"//fun message because why not, whats stopping me, society?
            }
            res.json(response);//convert response variable into json object to be sent as the requests response
        }
    })();
    ////////////////////////////////////////////////////
});
/////////////////////////////////////INITIALIZE SERVER//////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
api_https.createServer(httpsOptions, api).listen(PORT, "0.0.0.0",() =>{//create server, providing https options and request listener
    console.log("Server Initialised for all network interfaces");//server listens on all machine network interfaces by defining hostname as 0.0.0.0
    console.log(`Listening on port ${PORT}\n/////////////////////////////////////////////////////////////////////////`);
});

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


