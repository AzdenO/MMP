/**
 * @module BungieEndpointConstants
 * @description Module to hold constants related to API endpoints, such as valid query paramater options
 * @author Declan Roy Alan Wadsworth (drw8)
 * @bungieApiVersion 1.20.1
 * @version 0.1.0
 */
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Constant to hold valid values for the components query parameter at the Destiny2.GetCharacter endpoint
 * @relatedEndpoint Destiny2.getCharacter. This is maily for reference as it is easier and more readable to place these manually
 * in the functions that use them
 * @type {{}}
 */
export const characterComponents = {
    Equipped: 205,
    Inventory: 201,
    CurrentActivity: 204,
    ItemInstanceData: 300,
    VaultItems: 102,
    ItemSockets: 305,
    ItemStats: 304,
    ItemPerks: 302,
    Characters: 200
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////