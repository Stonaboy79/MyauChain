const https = require('https');

const data = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "sui_getNormalizedMoveModulesByPackage",
    params: ["0x2eac4c0866124f40e8f6335f1d2348efbda702ea3470269bab359877e8d184a7"]
});

const options = {
    hostname: 'fullnode.devnet.sui.io',
    port: 443,
    path: '/',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = https.request(options, res => {
    let body = '';
    res.on('data', d => body += d);
    res.on('end', () => {
        try {
            const parsed = JSON.parse(body);
            if (parsed.result && parsed.result.MeowToken) {
                console.log("Structs:", Object.keys(parsed.result.MeowToken.structs));
            } else {
                console.log("Modules found:", Object.keys(parsed.result));
            }
        } catch (e) {
            console.log("Parse error:", e, body);
        }
    });
});

req.on('error', error => {
    console.error(error);
});

req.write(data);
req.end();
