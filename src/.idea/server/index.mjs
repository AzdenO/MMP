import express from "express";//express module that allows for easier creation of rest server, and easier integration of middleware

import api_https from "https";//https server module, allows for communication over https instead of http

import fs from "node:fs";//for reading files on the system the server runs on

import cors from "cors";//cross origin resource sharing module

import dayjs from "dayjs";//time module

import cookieParser from "cookie-parser";

////////////////////////////////////////////////SERVER-WIDE DEPENDENCY CONFIGURATION////////////////////////////////////
/*Main Server File Dependencies*/
import {invalidParamsBody,invalidTokenBody, ServerErrorBody} from "./modules/constants/responseConstants.mjs";

/*Secondary dependencies*/

import mysql from "mysql2/promise";

import prompts from "prompts";

/*Primary dependencies*/

import Reasoner from "./modules/reasoner.mjs";//import reasoner class that generates all coach content

import Coach from "./modules/coach.mjs";//import coach class, one object for each user

import UserService from "./modules/UserServices.mjs";

import UserPool from "./modules/UserPool.mjs";
const active_pool = new UserPool();

const destiny = (await import("./modules/bungie_access.mjs"));

const destinyBase = destiny.destiny_full;
const destinyAuth = destiny.bungieAuth;

const db = await(import("./modules/user_database.mjs"));

const dbBaseServices = db.dbBaseServices;
const dbAuthServices = db.dbAuthServices;


/*
 * Initialise the database module, catching any error that might occur and safely exiting server startup if so
 */
try{
    await dbBaseServices.initialise(mysql,destiny,prompts,false);
}catch(error){
    console.log("Server:// Database initialisation failed, exiting server startup...");
    console.log(error);
    process.exit(400);
}

UserService.initialise(destinyBase,dbBaseServices);

import * as authServices from "./modules/userAuthentication.mjs";//import authentication module
import * as tokenManager from "./modules/TokenManager.mjs";//import token managemtn module
tokenManager.setDB(dbAuthServices);//pass token manager its database object dependency
authServices.setDependencies(tokenManager, destinyAuth, dbAuthServices);//pass auth service the token manager and object containing bungie auth methods

import * as ServerErrors from "./modules/utils/errors.mjs";
///////////////////////////////////////////////EXPRESS CONFIGURATION////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var api = express();//instantiate rest server
api.use(cors({
    origin: "*",//only allow requests from the github page
    methods: ["GET", "POST", "OPTIONS"],//allow only get, post and options requests on the server
    allowedHeaders: ["Content-Type","activity-id","character-id","x-access-token","skills-type"],//define list of header attributes that are allowed in all requests
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
api.get("/server/coach/characterAnalysis",async (req,res)=>{
    const token = req.headers["x-access-token"];
    const charid = req.headers["character-id"];

    if(!token || !charid){
        console.log("Server (GetCharacterAnalysis):// Invalid parameters")
        res.status(400);
        res.json(invalidParamsBody);
    }else{
        try{
            const userid = await authServices.authorize(token);
            console.log("Server (GetCharacterAnalysis):// Request authenticated, processing request");
            const generated = active_pool.process(userid, 3, [charid]);
            res.json({
                status:"success",
                message: "I`m initiating Operation Ahamkara",
                generated: generated
            })
        }catch(error){
            if(err instanceof ServerErrors.InvalidTokenError){
                res.status(401);
                res.json(invalidTokenBody);
            }
        }
    }
});
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
api.get("/server/bungie/knowledge",async (req,res)=>{
    res.status(200);
    res.json({
        success: true,
        content: UserService.getKnowledgeBase()
    })
});
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
api.get("/server/coach/activity_skills",async (req,res)=>{

});
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
api.get("/server/coach/weapon_skills", async (req, res) => {

    const token = req.headers["x-access-token"];
    const type = req.headers["skills-type"];
    if(!token | !type){
        console.log("Server (GetWeaponSkills):// Invalid parameters")
        res.status(400);
        res.json(invalidParamsBody);
    }else{

        try{
            const userid = await authServices.authorize(token);
            console.log("Server (GetWeaponSkills):// Request authenticated, processing request");
            const generated = await active_pool.process(userid, 2, [charid]);
            res.json({
                success: true,
                message: "You`re a wall around these zones guardian, take that iron will beyond the crucible",
                content: generated
            });

        }catch(err){

            if(err instanceof ServerErrors.InvalidTokenError){
                res.status(401);
                res.json(invalidTokenBody);
            }

        }
    }

});
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
api.get('/server/bungie/getrecentactivities',async(req, res) => {
    const token = req.headers["x-access-token"];
    const charid = req.headers["character-id"];

    if(!token){
        console.log("Server (GetRecentActivities):// Invalid parameters")
        res.status(400);
        res.json(invalidParamsBody);
    }else{

        try{
            const userid = await authServices.authorize(token);
            console.log("Server (GetRecentActivities):// Request authenticated, fetching past 30 activities");
            const generated = await active_pool.process(userid, 4,[charid]);
            res.status(200);
            res.json({
                success: true,
                message: "Devotion inspires bravery, bravery inspires sacrifice, sacrifice leads to...",
                content: generated
            })
        }catch(err){
            if(err instanceof ServerErrors.InvalidTokenError){
                res.status(401);
                res.json(invalidTokenBody);
            }
        }
    }
});
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
api.get("/server/coach/data",async (req,res)=>{
    const token = req.headers["x-access-token"];

    if(!token){
        res.status(400);
        res.json(invalidParamsBody);
    }else{

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

    }else{

        try{
            const userid = await authServices.authorize(token);
            const generated = await active_pool.process(userid, 1,[characterId,activityId]);
            res.status(200);
            res.json({
                status: "success",
                test: "successful",
                generated: generated
            });
            console.log("Processed");


        }catch(err){

            if(err.constructor.name == "InvalidTokenError"){
                res.status(401);
                res.json(invalidTokenBody);
            }else{
                res.status(500);
                res.json(ServerErrorBody);
            }

        }
    }
})
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
api.post('server/authorize/reauth', async (req, res) => {
    console.log("Server:// New access token request");
    const refresh = req.headers["x-refresh-token"];

    if(!refresh){
        res.status(400);
        res.json(invalidParamsBody);
        res.send();
    }else{
        try{
            const tokens = authServices.reAuthorise(refresh);
            res.status(200);
            res.json({
               status: "success",
               message: "//Siva-ctrl-access: granted",
               tokens: tokens
            });
        }catch(error){
            if(err instanceof InvalidTokenError){
                res.status(401);
                res.json(invalidTokenBody);
            }
        }
    }
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

            await authServices.baseAuthentication(newuser,req.body.code);

            active_pool.appendUser(newuser);
            /*
             * MANUAL TESTING AREA, INSERT CODE HERE
             */
            destiny.destiny_full.getCharacterItems(
                newuser.getCharacterIds(),
                newuser.getMembershipId(),
                newuser.getMemberType(),
                newuser.getAccessToken(),
                true)
            /*
             * END OF MANUAL TESTING AREA
             */
            res.status(200);//return ok http status code
            console.log("Server:// Logged new user at: "+dayjs().format("HH:mm:ss"));
            const response = {
                success: true,
                access_token: newuser.getAccessToken(),
                refresh_token: newuser.getRefreshToken(),
                characters: newuser.getCharacters().characters,//page init data
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


