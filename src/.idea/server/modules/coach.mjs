const destiny = (await import("./bungie_access.mjs")).default;//wait for module to instantiate, needed for flow to main server module

export default class Coach{

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    constructor(reasoner, auth_token=null,refresh_token=null) {
        this.reasoner = reasoner;//gemini api wrapper class/object
        this.membershipid = null;
        this.accountID = null;
        this.access_token = null;
        this.refresh_token = refresh_token;
    }
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    async initialise(auth_token){
        const success = await this.#initBungieAccess(auth_token);
        return success;
    }
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    async #initBungieAccess(auth) {
        ///////////////////////////Get Access and Refresh tokens////////////////////////////////////////////////////////
        console.log("Initializing Bungie Access");
        const data = await destiny.getUserAccess(null,auth);
        if(data=="error"){
            return "error";
        }
        console.log("Destiny access granted\n////////////////////////////////////////")
        /////////////////////////////////////////////Get account specific data//////////////////////////////////////////
        this.accountID = data.membership_id;
        console.log("Member ID: "+this.accountID);
        this.access_token = data.access_token;
        this.refresh_token = data.refresh_token;
        const accountdata = await destiny.getAccountSpecificData(this.access_token);
        if(accountdata=="error"){
            return "error";
        }
        this.membershipid = accountdata.Response.destinyMemberships[0].membershipId;
        this.membertype = accountdata.Response.destinyMemberships[0].membershipType;
        this.displayname = accountdata.Response.destinyMemberships[0].bungieGlobalDisplayName+accountdata.Response.destinyMemberships[0].bungieGlobalDisplayNameCode.toString();
        console.log("Primary Membership ID: "+this.membershipid);
        /////////////////////////////////////////////Get User Characters////////////////////////////////////////////////
        const characterlist = await destiny.getAccountCharacters(this.access_token,this.membershipid,this.membertype);
        if(characterlist=="error"){
            return "error";
        }
        this.characters = characterlist;
        console.log(this.characters);
        this.items = destiny.getCharacterInventoryItemsAndVault(this.access_token,this.characters[0][0],this.membershipid,this.membertype);
        //this.get_suggestions_by_activity("Nether, Private Explore");
        return "success";

    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    async get_suggestions_by_activity(activity_id) {
        this.reasoner.act_build(activity_id, this.#parseUserItems(), "Warlock");
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /*
    * PARSE USER ITEMS FOR USE IN GEMINI
    * Private class method for taking the necessary parts for every item (so excluding hashid, instanceid, etc.) to be used
    * in a prestructured prompt
    */
    #parseUserItems(){
        var parsed = "";

        for(const item in this.items){
            if(this.items[item].item_type==="Subclass"){//subclass compatibility not currently implemented
                continue;
            }
            var parseditem = this.items[item];
            delete parseditem.instance;
            delete parseditem.itemId;
            if(this.items[item].perks.length == 0){
                delete parseditem.perks;
            }
            parsed+=JSON.stringify(parseditem,null, 4);
        }
        return parsed;
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}