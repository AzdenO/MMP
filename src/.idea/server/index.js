/*Create API Object and constant for port it listens on*/
const api = require("express");
const PORT = 32765;

/*Create https object for secure connections and instantiate object to hold asymetric parameters*/
const https = require("https");



api.listen(PORT, () => {
    console.log("Server running on port: " + PORT);
})

api.get('/act_sug_build', (req, res) => {
    const parameters = req.query;
})

