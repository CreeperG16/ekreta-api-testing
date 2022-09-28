const axios = require("axios");
const qs = require("qs");
const crypto = require("crypto");

const loginData = require("./config.json");

(async () => {
  // const { data: urls } = await axios({
  //   method: "get",
  //   url: "https://kretamobile.blob.core.windows.net/configuration/ConfigurationDescriptor.json",
  //   headers: {},
  // });

  // const kretaUrl = urls.GlobalMobileApiUrlPROD;

  // // console.log({ urls, kretaUrl });

  // // List of all schools
  // const schools = await axios({
  //   method: "get",
  //   url: kretaUrl + "/api/v3/Institute",
  //   headers: { apiKey: "7856d350-1fda-45f5-822d-e1a2f3f1acf0" },
  // });

  // Stuff for getting access token
  const { data: nonce } = await axios.get("https://idp.e-kreta.hu/nonce");

  const hmac = crypto.createHmac(
    "sha512",
    Buffer.from([98, 97, 83, 115, 120, 79, 119, 108, 85, 49, 106, 77])
  );

  hmac.write(
    loginData.institute_code.toUpperCase() +
      nonce +
      loginData.userName.toUpperCase()
  );

  const generated = Buffer.from(hmac.digest()).toString("base64");

  // Actually getting the access token
  const { data: token } = await axios({
    method: "post",
    url: "https://idp.e-kreta.hu/connect/token",
    headers: {
      Accept: "application/json",
      "User-Agent": "Kreta.Ellenorzo",
      "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
      "X-AuthorizationPolicy-Version": "v2",
      "X-AuthorizationPolicy-Key": generated,
      "X-AuthorizationPolicy-Nonce": nonce,
    },
    data: qs.stringify({
      ...loginData,
      grant_type: "password",
      client_id: "kreta-ellenorzo-mobile-android",
    }),
  }).catch((err) => console.error("ERROR", err.code, err.response.data));

  console.log(token);

  // Get student data
  const { data: studentInfo } = await axios({
    method: "get",
    url: `https://${loginData.institute_code}.e-kreta.hu/ellenorzo/V3/Sajat/TanuloAdatlap`,
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      "User-Agent": "Kreta.Ellenorzo",
    },
  }).catch((err) => console.error("ERROR", err));

  console.dir(studentInfo, { depth: null });

  //Ertekelesek/Mulasztasok/OrarendElemek
  //?datumTol=2020-09-01T00-00-00&datumIg=2020-09-08T00-00-00 (wrong, time uses ":")

  const monday = new Date();
  while (monday.getDay() !== 1) monday.setDate(monday.getDate() + 1);
  monday.setHours(0, 0, 0, 0);

  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  friday.setHours(23, 59, 59, 999);

  console.log(monday.toDateString(), "to", friday.toDateString());

  const { data: orarend } = await axios({
    method: "get",
    url: `https://${
      loginData.institute_code
    }.e-kreta.hu/ellenorzo/V3/Sajat/OrarendElemek?datumTol=${monday.toISOString()}&datumIg=${friday.toISOString()}`,
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      "User-Agent": "Kreta.Ellenorzo",
    },
  });

  console.log(
    orarend.map((x) => ({
      name: x.Nev,
      teacher: x.TanarNeve,
      room: x.TeremNeve,
      group: x.OsztalyCsoport.Nev,
      time: {
        start: `${new Date(x.KezdetIdopont).toDateString()}, ${new Date(
          x.KezdetIdopont
        ).toLocaleTimeString()}`,
        end: `${new Date(x.VegIdopont).toDateString()}, ${new Date(
          x.VegIdopont
        ).toLocaleTimeString()}`,
      },
    }))
  );
  await require("fs/promises").writeFile(
    "./orarend_pelda.json",
    JSON.stringify(orarend, null, 2)
  );
})();
