const express = require("express");
const app = express();

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

app.use(express.json());

const path = require("path");
const dbpath = path.join(__dirname, "covid19IndiaPortal.db");

let db = null;

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbpath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();

// API 1

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const getUserAPI1 = `select * from user where username like '${username}';`;
  const dbUserAPI1Response = await db.get(getUserAPI1);
  if (dbUserAPI1Response === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(
      password,
      dbUserAPI1Response.password
    );
    if (isPasswordMatched === false) {
      response.status(400);
      response.send("Invalid password");
    } else {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "SECRET_TOKEN");
      response.send({ jwtToken });
    }
  }
});

const getObj = (item) => {
  return {
    stateId: item.state_id,
    stateName: item.state_name,
    population: item.population,
  };
};

const getDistrictObj = (item) => {
  return {
    districtId: item.district_id,
    districtName: item.district_name,
    stateId: item.state_id,
    cases: item.cases,
    cured: item.cured,
    active: item.active,
    deaths: item.deaths,
  };
};

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authToken = request.headers["authorization"];
  if (authToken !== undefined) {
    jwtToken = authToken.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "SECRET_TOKEN", (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

// API 2

app.get("/states/", authenticateToken, async (request, response) => {
  const getAPI2Query = `select * from state ;`;
  const dbAPI2Response = await db.all(getAPI2Query);
  let a = dbAPI2Response.map((eachObj) => getObj(eachObj));
  response.send(a);
});

// API 3

app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getAPI3Query = `select * from state where state_id = ${stateId};`;
  const dbAPI3Response = await db.get(getAPI3Query);
  response.send(getObj(dbAPI3Response));
});

// API 4

app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const getAPI4Query = `insert into district (district_name, state_id, cases, cured, active, deaths) 
    values ('${districtName}', ${stateId}, ${cases}, ${cured}, ${active}, ${deaths});`;
  await db.run(getAPI4Query);
  response.send("District Successfully Added");
});

// API 5

app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getAPI5Query = `select * from district where district_id = ${districtId};`;
    const dbAPI5Response = await db.get(getAPI5Query);
    response.send(getDistrictObj(dbAPI5Response));
  }
);

// API 6

app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getAPI6Query = `delete from district where district_id = ${districtId};`;
    await db.get(getAPI6Query);
    response.send("District Removed");
  }
);

// API 7

app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const getAPI7Query = `update district set district_name='${districtName}', state_id=${stateId}, cases=${cases}, cured=${cured}, active=${active}, deaths=${deaths};`;
    await db.run(getAPI7Query);
    response.send("District Details Updated");
  }
);

// API 8

app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getAPI8Query = `select sum(cases) as totalCases, sum(cured) as totalCured, sum(active) as totalActive, sum(deaths) as totalDeaths from district left join state on district.state_id = state.state_id where district.state_id = ${stateId};`;
    const dbAPI8Response = await db.get(getAPI8Query);
    response.send(dbAPI8Response);
  }
);

module.exports = app;
