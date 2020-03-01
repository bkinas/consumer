const express = require("express");
const request = require("superagent");
const server = express();

const getApiEndpoint = () => process.env.API_HOST || "http://localhost:8081";
const authHeader = {
    Authorization: "Bearer 1234",
};

// Find users by their ID from the User Service
const getUserById = id => {
    return request
        .get(`${getApiEndpoint()}/users/${id}`)
        .set(authHeader)
        .then(res => res.body, () => null)
};

const calculateAge = birthday => {
    var ageDifMs = Date.now() - birthday.getTime();
    var ageDate = new Date(ageDifMs); // miliseconds from epoch
    return Math.abs(ageDate.getUTCFullYear() - 1970);
};

// Age function
const age = user => {
    return {
        id: user.id,
        name: user.name,
        age: calculateAge(new Date(user.birth)),
        available: user.available
    }
};

// Age API
server.get("/age/:userId", (req, res) => {
    if (!req.params.userId) {
        res.writeHead(400);
        res.end()
    }

    request
        .get(`${getApiEndpoint()}/users/${req.params.userId}`)
        .set(authHeader)
        .then(r => {
            if (r.statusCode === 200) {
                res.json(age(r.body));
                res.end()
            } else if (r && r.statusCode === 404) {
                res.writeHead(404);
                res.end()
            } else {
                res.writeHead(500);
                res.end()
            }
        })
        .catch(e => console.error(e))
});

module.exports = {
    server,
    age,
    getUserById,
};
