import express from "express";//express module that allows for easier creation of rest server, and easier integration of middleware

import api_https from "https";//https server module, allows for communication over https instead of http

import fs from "node:fs";//for reading files on the system the server runs on

import cors from "cors";//cross origin resource sharing module

import dayjs from "dayjs";//time module

import cookieParser from "cookie-parser";

////////////////////////////////////////////////SERVER-WIDE DEPENDENCY CONFIGURATION////////////////////////////////////
/*Main Server File Dependencies*/
import {invalidParamsBody,invalidTokenBody} from "./modules/constants/responseConstants.mjs";

/*Secondary dependencies*/

import mysql from "mysql2/promise";

import prompts from "prompts";

/*Primary dependencies*/

import Reasoner from "./modules/reasoner.mjs";//import reasoner class that generates all coach content

import Coach from "./modules/coach.mjs";//import coach class, one object for each user

import UserService from "./modules/UserServices.mjs";

import UserPool from "./modules/UserPool.mjs";
const active_pool = new UserPool();

const destiny = (await import("./modules/bungie_access.mjs")).destiny_full;

const db = (await import("./modules/user_database.mjs")).db;

try{
    await db.initialise(mysql,destiny,prompts,false);
}catch(error){
    console.log("Server:// Database initialisation failed, exiting server startup...");
    console.log(error);
    process.exit(400);
}

UserService.initialise(destiny,db);

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
    console.log("Server:// Request "+req.method +" at endpoint " + req.url);//log request method and its target endpoint on the server
    next();//Allows request to move onto correct endpoint after logging
})

api.use(express.json());//allows for easier parsking of request jsons

api.use(cookieParser());//allows for parsing of incoming cookies for retrieivng refresh tokens stored in HTTP only browser cookies
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
api.get("/server/coach/WeaponSkills", async (req, res) => {

    const token = req.headers["x-access-token"];
    if(!token){
        res.status(501);
        res.json(invalidParamsBody);
        res.send();
        return;
    }else{

        try{

            const generated = await active_pool.process(token, 2);

        }catch(err){

            if(typeof err === "InvalidTokenError"){
                res.status(401);
                res.json(invalidTokenBody);
                res.send();
            }

        }
    }

});
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

api.get('/server/coach/act_sug_build', async(req, res) => {

    const characterId = req.headers["character-id"];
    const token = req.headers["x-access-token"];
    const activityId = req.headers["activity-id"];

    if(!characterId || !token || !activityId){
        res.status(400);
        res.json(invalidParamsBody);
        res.send();
        return;

    }else{

        try{

            const generated = await active_pool.process(token, 1,[characterId,activityId]);

        }catch(err){

            if(err.constructor.name == "InvalidTokenError"){
                res.status(401);
                res.json(invalidTokenBody);
                res.send();
            }

        }
    }
})
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
api.post('server/authorize/reauth', async (req, res) => {
    console.log("Server:// New access token request");


})

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

api.post('/server/authorize', async (req, res) => {

    console.log("Server:// Processing authorisation request...");

    var newuser = new Coach(generativeModel, UserService);//create new object with default values, synchronous

    (async () => {

        try{

            if(!req.body.code && !req.body.refresh){//if neither a body nor auth cookie is present

                console.log("Server:// Authorisation could not find an auth code or refresh token, likely pre-auth for new user");
                newuser=null;
                res.status(408);
                res.json({
                    message: "No auth code or refresh token present",
                    success: false,
                    ErrorCode: 408,
                    status: "Failed",
                });
                res.send();
                return;

            }

            await UserService.authorizeUser(newuser,req.body.code,req.body.refresh);

            var userToken = active_pool.appendUser(newuser);
            res.status(200);//return ok http status code
            console.log("Server:// Logged new user at: "+dayjs().format("HH:mm:ss"));
            const response = {
                success: true,
                access_token: userToken,
                refresh_token: newuser.getRefreshToken(),
                characters: newuser.getCharacters(),//page init data
                bungiename: newuser.getDisplayName(),//page init data
                message: "I`ve taken entire worlds, you think you`re worthy to face me?"//fun message because why not, whats stopping me, society?
            }
            res.json(response);//convert response variable into json object to be sent as the requests response
            res.send();



        }catch(err){
            console.log(err);
            newuser = null;//make applicable for garbage collection
            console.log("Server:// Error in creating new user\n\t"+err.stack);
            res.status(401);//return http status error code
            res.json({
                success: false,
                message: "Error in authenticating user",
                ErrorCode: 401,//sticking to standard http codes where applicable, this being authentication error
                status: "error",
                data:{
                    errmsg:err.message
                }
            });


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


